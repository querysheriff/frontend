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
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<DocCard id={docId} class="px-3.5 pt-3.5 pb-3">
	<!-- pr-9 reserves the gutter for DocCard's info button, so `actions` can sit at the row's end. -->
	<header class="mb-3.5 flex items-center justify-between gap-4 pr-9">
		<!-- SectionHeader renders an h2 and a p as siblings: unwrapped they become separate flex items. -->
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
