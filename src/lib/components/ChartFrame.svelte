<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChartLegend from '$lib/components/ChartLegend.svelte';

	let {
		legend = [],
		children
	}: {
		legend?: { label: string; color: string; opacity?: number }[];
		children: Snippet;
	} = $props();
</script>

<div>
	<ChartLegend items={legend} />
	<div class="h-[15rem]">
		{@render children()}
	</div>
</div>
