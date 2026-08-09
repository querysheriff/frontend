<script lang="ts">
	import type { Snippet } from 'svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';

	let {
		docId,
		title,
		description,
		actions,
		children
	}: {
		docId?: string;
		title: string;
		description: string;
		/** Controls for the chart itself, e.g. a breakdown switch. */
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<DocCard id={docId} class="px-3.5 pt-3.5 pb-3">
	<!-- pr-9 reserves the gutter for DocCard's absolute info button (top-2 right-2, size-7),
	     so `actions` can sit at the row's end without colliding with it. -->
	<header class="mb-3.5 flex items-center justify-between gap-4 pr-9">
		<!-- SectionHeader renders an h2 *and* a p as siblings, so it has to be wrapped: as a
		     direct flex child the two would become separate flex items and the description
		     would land beside the title instead of under it. -->
		<div class="min-w-0">
			<SectionHeader {title} {description} />
		</div>
		{#if actions}
			<div class="flex flex-none items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</header>
	{@render children()}
</DocCard>
