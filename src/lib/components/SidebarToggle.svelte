<script lang="ts">
	import { MenuIcon, PanelLeftIcon, PanelLeftCloseIcon } from '@lucide/svelte';
	import { sidebar } from '$lib/sidebar.svelte';

	const btn =
		'flex size-8 flex-none cursor-pointer items-center justify-center text-ink-muted transition-colors hover:bg-hover hover:text-command';
</script>

<button type="button" onclick={() => sidebar.openDrawer()} aria-label="Open navigation" class="{btn} -ml-1.5 md:hidden">
	<MenuIcon class="size-5" />
</button>

<button
	type="button"
	onclick={() => sidebar.toggleCollapsed()}
	aria-label={sidebar.collapsed ? 'Show sidebar' : 'Hide sidebar'}
	title={sidebar.collapsed ? 'Show sidebar' : 'Hide sidebar'}
	class="{btn} -ml-1.5 hidden md:inline-flex"
>
	{#if sidebar.collapsed}
		<PanelLeftIcon class="size-5" />
	{:else}
		<PanelLeftCloseIcon class="size-5" />
	{/if}
</button>
