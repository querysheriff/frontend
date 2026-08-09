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
	     tick labels. It belongs here rather than on the brush, which accepts a `classes.root`
	     but never applies it, and here it also covers the axes. ondblclickcapture swallows the
	     double-click that BrushContext answers with selectAll(), painting a selection across the
	     whole plot that nothing then clears. -->
	<div class="h-[15rem] select-none" ondblclickcapture={(e) => e.stopPropagation()}>
		{@render children()}
	</div>
</div>
