<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { afterNavigate, goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ContextBar from '$lib/components/ContextBar.svelte';
	import DocsDrawer from '$lib/components/DocsDrawer.svelte';
	import { docs } from '$lib/docs.svelte';
	import { ctx, serversState } from '$lib/state.svelte';
	import { session } from '$lib/session.svelte';

	type Props = {
		children: Snippet;
		contextBar?: boolean;
		dbScoped?: boolean;
		requireSuperAdmin?: boolean;
	};

	let { children, contextBar = true, dbScoped = true, requireSuperAdmin = false }: Props = $props();

	const REFRESH_MS = 30_000;

	const allowed = $derived(session.isAuthenticated && (!requireSuperAdmin || session.isSuperAdmin));

	// Once, before the children's effects fetch: the layout's props never change.
	untrack(() => {
		ctx.dbScoped = dbScoped;
		if (contextBar) ctx.applyQuery(new URLSearchParams(location.search));
	});

	// `docs` is a module singleton, so a panel left open would follow you to the next screen.
	afterNavigate(() => docs.close());

	$effect(() => {
		if (!session.loaded) return;
		if (!session.isAuthenticated) goto('/login', { replaceState: true });
		else if (requireSuperAdmin && !session.isSuperAdmin) goto('/queries', { replaceState: true });
	});

	$effect(() => {
		if (!contextBar || !allowed) return;
		serversState.load();
		const id = setInterval(() => serversState.load(), REFRESH_MS);
		return () => clearInterval(id);
	});

	// A navigation within this shell (list → query detail) lands on a bare URL, so it rewrites too.
	const pathname = $derived(page.url.pathname);

	$effect(() => {
		if (!contextBar || !allowed) return;
		const url = `${pathname}?${ctx.queryString()}`;
		const mode = ctx.takeHistoryMode();
		// Not page.url: it misses every shallow pushState/replaceState, also after back/forward.
		if (url === location.pathname + location.search) return;
		if (mode === 'push') pushState(url, page.state);
		else replaceState(url, page.state);
	});

	$effect(() => {
		if (!contextBar) return;
		const onPop = () => {
			if (location.pathname !== page.url.pathname) return;
			ctx.applyQuery(new URLSearchParams(location.search));
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
				<ContextBar />
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
		<DocsDrawer />
	</div>
{/if}
