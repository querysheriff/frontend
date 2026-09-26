<script lang="ts">
	import type { Snippet } from 'svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';

	let {
		docId,
		title,
		description,
		children
	}: {
		docId?: string;
		title: string;
		description: string;
		children: Snippet;
	} = $props();
</script>

<DocCard id={docId} class="px-3.5 pt-3.5 pb-3">
	<header class="mb-3.5 pr-9">
		<SectionHeader {title} {description} />
	</header>
	{@render children()}
</DocCard>
