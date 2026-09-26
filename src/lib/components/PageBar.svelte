<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { screenFor } from '$lib/nav';
	import SidebarToggle from '$lib/components/SidebarToggle.svelte';

	type Props = {
		actions?: Snippet;
	};

	let { actions }: Props = $props();

	const screen = $derived(screenFor(page.url.pathname));
</script>

<div
	class="sticky top-0 z-30 flex min-h-[4.25rem] flex-wrap items-center gap-2.5 border-b border-line bg-paper/70 px-4 py-3 backdrop-blur-[3px] backdrop-saturate-[1.1] sm:px-5 md:gap-5 md:px-7"
>
	<SidebarToggle />

	<div class="flex min-w-0 flex-1 flex-col gap-0.5">
		<div class="flex items-baseline gap-2.5">
			<h1 class="truncate font-sans text-xl leading-[1.15] font-bold text-ink">
				{screen.title}
			</h1>
		</div>
		<p class="truncate text-xs leading-[1.2] text-ink/70">{screen.description}</p>
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2.5">
			{@render actions()}
		</div>
	{/if}
</div>
