<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import AppShell from '$lib/components/AppShell.svelte';
	import DocsDrawer from '$lib/components/DocsDrawer.svelte';
	import { docs } from '$lib/docs.svelte';

	// The shell for a section whose cards carry docs. `dbSwitch` is forwarded because a
	// section can have docs and still be server-wide, as LOGS is.
	let { children, dbSwitch = true }: { children: Snippet; dbSwitch?: boolean } = $props();

	// `docs` is a module singleton, so a panel left open would follow you to the
	// next screen and show that card's entry beside cards that never had one.
	// This covers moving between sections and between a list and its detail alike.
	afterNavigate(() => docs.close());
</script>

<AppShell {dbSwitch}>
	{#snippet rightPanel()}
		<DocsDrawer />
	{/snippet}
	{@render children()}
</AppShell>
