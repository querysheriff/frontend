<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate, goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ContextBar from '$lib/components/ContextBar.svelte';
	import { ctx, serversState } from '$lib/state.svelte';
	import { urlSync } from '$lib/urlState.svelte';
	import { session } from '$lib/session.svelte';

	type Props = {
		children: Snippet;
		rightPanel?: Snippet;
		contextBar?: boolean;
		dbSwitch?: boolean;
		requireSuperAdmin?: boolean;
	};

	let { children, rightPanel, contextBar = true, dbSwitch = true, requireSuperAdmin = false }: Props = $props();

	const REFRESH_MS = 30_000;

	const allowed = $derived(session.isAuthenticated && (!requireSuperAdmin || session.isSuperAdmin));

	// Runs before the effect that writes the URL, so `db` is already dropped on screens that ignore it.
	$effect(() => {
		ctx.dbScoped = dbSwitch;
	});

	$effect(() => {
		if (!session.loaded) return;
		if (!session.isAuthenticated) goto('/login');
		else if (requireSuperAdmin && !session.isSuperAdmin) goto('/queries');
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

	// Only write once the children have rendered: they register the filter params, and writing before
	// that drops them from a deep link.
	$effect(() => {
		if (!urlSynced || !contextBar || !allowed) return;
		const qs = urlSync.queryString();
		const mode = urlSync.takeMode();
		if (qs === page.url.search.replace(/^\?/, '')) return;
		if (mode === 'push') pushState(`?${qs}`, page.state);
		else replaceState(`?${qs}`, page.state);
	});

	$effect(() => {
		if (!contextBar) return;
		const onPop = () => {
			if (location.pathname !== page.url.pathname) return;
			urlSync.applyQuery(location.search);
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	});
</script>

{#if allowed}
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:border focus:border-command focus:bg-paper focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:font-semibold focus:text-command"
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
