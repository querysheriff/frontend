<script lang="ts">
	import { Axis, Chart, Grid, Highlight, LinearGradient, Svg, Tooltip } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { fmtAxisTime, fmtBucketRange, fmtCount, fmtCountFull } from '$lib/format';
	import ChartFrame from '$lib/components/ChartFrame.svelte';
	import GapBands from '$lib/components/GapBands.svelte';
	import MetricArea from '$lib/components/MetricArea.svelte';
	import SeriesPoints from '$lib/components/SeriesPoints.svelte';
	import { buildMetricMultiChartModel, type MetricSeriesPoint, type MetricSeriesRow } from '$lib/metricChart';

	let {
		data,
		from,
		to,
		bucketMs,
		fill,
		label
	}: {
		data: MetricSeriesPoint[];
		from: Date;
		to: Date;
		bucketMs: number;
		fill: string;
		label: string;
	} = $props();

	const model = $derived(buildMetricMultiChartModel([data], from, to, bucketMs));

	// Hover dot / highlight / tooltip anchor to the bucket's center (not its `at`
	// edge) so they sit in the middle of the bucket's slot, as the old bars did.
	const bucketCenter = $derived.by(() => {
		const step = model.step;
		return (d: MetricSeriesRow) => new Date(d.at.getTime() - step / 2);
	});

	// Kept intentionally soft so the outline doesn't dominate the gradient fill;
	// the legend swatch reuses it so the two always match.
	const lineOpacity = 0.5;

	const yMax = $derived.by(() => {
		let m = 0;
		for (const p of data) if (p.value != null && p.value > m) m = p.value;
		return m;
	});
</script>

<ChartFrame legend={[{ label, color: fill, opacity: lineOpacity }]}>
	<Chart
		data={model.rows}
		x={bucketCenter}
		xScale={scaleTime()}
		xDomain={[model.xFrom, model.xTo]}
		y={() => 0}
		yDomain={[0, yMax || 1]}
		yNice
		padding={{ left: 36, right: 16, bottom: 24 }}
		tooltipContext={{ mode: 'bisect-x' }}
	>
		<Svg>
			<Grid y={{ class: 'stroke-ink/10' }} />
			<GapBands gaps={model.gaps} />
			<Axis
				placement="left"
				rule
				ticks={4}
				format={fmtCount}
				tickLabelProps={{ class: 'fill-ink/45 font-mono text-2xs', stroke: 'none' }}
			/>
			<Axis
				placement="bottom"
				rule
				ticks={6}
				format={fmtAxisTime}
				tickLabelProps={{ class: 'fill-ink/45 font-mono text-2xs', stroke: 'none' }}
			/>
			<LinearGradient vertical>
				{#snippet stopsContent()}
					<stop offset="0%" style="stop-color: {fill}; stop-opacity: 0.45" />
					<stop offset="100%" style="stop-color: {fill}; stop-opacity: 0" />
				{/snippet}
				{#snippet children({ gradient })}
					<MetricArea
						rows={model.rows}
						step={model.step}
						fill={gradient}
						lineStyle="stroke: {fill}; stroke-width: 1.5; stroke-opacity: {lineOpacity}"
					/>
				{/snippet}
			</LinearGradient>
			<Highlight lines motion="none" />
			<SeriesPoints colors={[fill]} values={(d: MetricSeriesRow) => d.values} />
		</Svg>
		<Tooltip.Root
			x="data"
			y="pointer"
			anchor="top-left"
			xOffset={18}
			yOffset={10}
			variant="none"
			class="border border-line-card bg-card px-3 py-2 shadow-chart"
		>
			{#snippet children({ data: point }: { data: MetricSeriesRow })}
				{@const value = point.values[0]}
				<div class="flex flex-col gap-1 font-mono text-xs leading-[1.4] whitespace-nowrap">
					<div class="text-ink/70">{fmtBucketRange(point.at, model.step)}</div>
					{#if value == null}
						<div class="text-ink/70">No data</div>
					{:else}
						<div class="font-semibold text-ink">{fmtCountFull(value)} calls</div>
					{/if}
				</div>
			{/snippet}
		</Tooltip.Root>
	</Chart>
</ChartFrame>

<style>
	:global(.lc-axis-tick-label),
	:global(.lc-axis-tick-label tspan) {
		stroke: none;
	}
</style>
