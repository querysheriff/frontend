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
	<!-- select-none because every chart is drag-to-zoom: without it a drag text-selects the axis
	     labels. ondblclickcapture swallows the double-click BrushContext answers with selectAll(),
	     which paints a selection nothing then clears. -->
	<div class="h-[15rem] select-none" ondblclickcapture={(e) => e.stopPropagation()}>
		{@render children()}
	</div>
</div>
