<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ContextBar from '$lib/components/ContextBar.svelte';
	import { serversState } from '$lib/state.svelte';
	import { urlSync } from '$lib/urlState.svelte';
	import { session } from '$lib/session.svelte';

	type Props = {
		children: Snippet;
		/** Optional panel docked to the right of the content, in the layout flow (not overlaid). */
		rightPanel?: Snippet;
		contextBar?: boolean;
		/** LOGS disables this because log events are server-wide, not per-database. */
		dbSwitch?: boolean;
		requireSuperAdmin?: boolean;
	};

	let { children, rightPanel, contextBar = true, dbSwitch = true, requireSuperAdmin = false }: Props = $props();

	const REFRESH_MS = 30_000;

	const allowed = $derived(session.isAuthenticated && (!requireSuperAdmin || session.isSuperAdmin));

	// Wait until the session loads, then redirect anyone not allowed here.
	const superAdminOnlyPath = /^\/(locks|transactions|logs|alerts)(\/|$)/;

	$effect(() => {
		if (!session.loaded) return;
		if (!session.isAuthenticated) goto('/login');
		else if (requireSuperAdmin && !session.isSuperAdmin) goto('/queries');
		else if (!session.isSuperAdmin && superAdminOnlyPath.test(page.url.pathname)) goto('/queries');
	});

	$effect(() => {
		if (!contextBar || !allowed) return;
		serversState.load();
		const id = setInterval(() => serversState.load(), REFRESH_MS);
		return () => clearInterval(id);
	});

	let urlSynced = $state(false);
	afterNavigate(() => {
		if (!urlSynced && contextBar) urlSync.applyQuery(page.url.search);
		urlSynced = true;
	});

	// Gating on `allowed` is load-bearing, not just an optimisation: children only
	// render once the session resolves, and the query string is rebuilt from the
	// providers they register. Writing any earlier strips a deep link's page-scoped
	// params before the page that owns them exists.
	$effect(() => {
		if (!urlSynced || !contextBar || !allowed) return;
		const qs = urlSync.queryString();
		if (qs !== page.url.search.replace(/^\?/, '')) replaceState(`?${qs}`, page.state);
	});
</script>

{#if allowed}
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:border focus:border-command focus:bg-paper focus:px-3 focus:py-2 focus:font-condensed focus:text-sm focus:font-semibold focus:tracking-[0.6px] focus:text-command focus:uppercase"
	>
		Skip to content
	</a>
	<div class="flex min-h-screen flex-row bg-paper text-ink">
		<Sidebar />
		<div class="flex min-w-0 flex-1 flex-col">
			{#if contextBar}
				<ContextBar {dbSwitch} />
				<main
					id="main-content"
					tabindex="-1"
					class="mx-auto w-full max-w-[120rem] min-w-0 flex-1 px-4 pt-7 pb-16 focus:outline-none sm:px-5 md:px-7"
				>
					{@render children()}
				</main>
			{:else}
				<main id="main-content" tabindex="-1" class="flex min-w-0 flex-1 flex-col focus:outline-none">
					{@render children()}
				</main>
			{/if}
		</div>
		{@render rightPanel?.()}
	</div>
{/if}
