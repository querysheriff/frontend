<script lang="ts">
	import { Axis, Chart, Grid, Highlight, LinearGradient, Svg, Tooltip } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { fmtAxisTime, fmtBucketRange, fmtCount, fmtCountFull } from '$lib/format';
	import ChartFrame from '$lib/components/ChartFrame.svelte';
	import MetricArea from '$lib/components/MetricArea.svelte';
	import SeriesPoints from '$lib/components/SeriesPoints.svelte';
	import { buildMetricMultiChartModel, type MetricSeriesPoint, type MetricSeriesRow } from '$lib/metricChart';
	import { createTimeBrush } from '$lib/chartBrush.svelte';

	let {
		data,
		from,
		to,
		bucketMs,
		fill,
		label,
		format = fmtCount,
		formatFull = fmtCountFull,
		unit = 'calls',
		minYMax = 1
	}: {
		data: MetricSeriesPoint[];
		from: Date;
		to: Date;
		bucketMs: number;
		fill: string;
		label: string;
		format?: (v: number) => string;
		formatFull?: (v: number) => string;
		unit?: string;
		minYMax?: number;
	} = $props();

	const model = $derived(buildMetricMultiChartModel([data], from, to, bucketMs));

	// Anchored to the bucket's center, not its `at` edge, so they sit in the middle of its slot.
	const bucketCenter = $derived.by(() => {
		const step = model.step;
		return (d: MetricSeriesRow) => new Date(d.at.getTime() - step / 2);
	});

	const lineOpacity = 0.5;

	const yMax = $derived.by(() => {
		let m = 0;
		for (const p of data) if (p.value > m) m = p.value;
		return m;
	});

	// Sized from the widest label the formatter can produce: a fixed gutter overruns on "8.33min".
	const padLeft = $derived(Math.max(36, Math.ceil(format(yMax || 1).length * 7.2) + 12));

	const brush = createTimeBrush(() => model.step);
</script>

<ChartFrame legend={[{ label, color: fill, opacity: lineOpacity }]}>
	<Chart
		data={model.rows}
		x={bucketCenter}
		xScale={scaleTime()}
		xDomain={[model.xFrom, model.xTo]}
		y={() => 0}
		yDomain={[0, Math.max(yMax, minYMax)]}
		yNice
		padding={{ left: padLeft, right: 16, bottom: 24 }}
		tooltipContext={{ mode: 'bisect-x' }}
		brush={brush.props}
	>
		<Svg>
			<Grid y={{ class: 'stroke-ink/10' }} />
			<Axis
				placement="left"
				rule
				ticks={4}
				{format}
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
			{#if !brush.brushing}
				<Highlight lines motion="none" />
				<SeriesPoints colors={[fill]} values={(d: MetricSeriesRow) => d.values} />
			{/if}
		</Svg>
		{#if !brush.brushing}
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
					<div class="flex flex-col gap-1 font-mono text-xs leading-[1.4] whitespace-nowrap">
						<div class="text-ink/70">{fmtBucketRange(point.at, model.step)}</div>
						<div class="font-semibold text-ink">{formatFull(point.values[0])}{unit ? ` ${unit}` : ''}</div>
					</div>
				{/snippet}
			</Tooltip.Root>
		{/if}
	</Chart>
</ChartFrame>

<style>
	:global(.lc-axis-tick-label),
	:global(.lc-axis-tick-label tspan) {
		stroke: none;
	}
</style>
