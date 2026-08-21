<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import AppShell from '$lib/components/AppShell.svelte';
	import DocsDrawer from '$lib/components/DocsDrawer.svelte';
	import { docs } from '$lib/docs.svelte';

	let {
		children,
		dbSwitch = true,
		contextBar = true
	}: { children: Snippet; dbSwitch?: boolean; contextBar?: boolean } = $props();

	// `docs` is a module singleton, so a panel left open would follow you to the next screen.
	afterNavigate(() => docs.close());
</script>

<AppShell {dbSwitch} {contextBar}>
	{#snippet rightPanel()}
		<DocsDrawer />
	{/snippet}
	{@render children()}
</AppShell>
