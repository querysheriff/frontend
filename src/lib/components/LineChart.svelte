<script lang="ts">
	import { Axis, Chart, Grid, Highlight, Spline, Svg, Tooltip } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { fmtAxisTime, fmtClockMinute } from '$lib/format';
	import ChartFrame from '$lib/components/ChartFrame.svelte';
	import SeriesPoints from '$lib/components/SeriesPoints.svelte';
	import { buildMetricChartModel, type MetricSeriesPoint, type MetricSeriesRow } from '$lib/metricChart';
	import { createTimeBrush } from '$lib/chartBrush.svelte';

	type Series = { label: string; color: string; points: MetricSeriesPoint[] };

	let {
		series,
		from,
		to,
		bucketMs,
		format,
		minYMax = 0
	}: {
		series: Series[];
		from: Date;
		to: Date;
		bucketMs: number;
		format: (value: number) => string;
		minYMax?: number;
	} = $props();

	const model = $derived(
		buildMetricChartModel(
			series.map((s) => s.points),
			from,
			to,
			bucketMs
		)
	);

	const yMax = $derived.by(() => {
		let m = minYMax;
		for (const s of series) {
			for (const p of s.points) {
				if (p.value > m) m = p.value;
			}
		}
		return m;
	});

	const padLeft = $derived(Math.max(36, Math.ceil(format(yMax || 1).length * 7.2) + 12));

	const brush = createTimeBrush(() => model.step);
</script>

<ChartFrame legend={series.map((s) => ({ label: s.label, color: s.color }))}>
	<Chart
		data={model.rows}
		x="at"
		xScale={scaleTime()}
		xDomain={[model.xFrom, model.xTo]}
		y={() => 0}
		yDomain={[0, yMax || 1]}
		yNice
		padding={{ left: padLeft, right: 16, bottom: 24 }}
		tooltipContext={{ mode: 'bisect-x' }}
		brush={brush.props}
	>
		<Svg>
			<Grid y={{ class: 'stroke-ink/10' }} />
			<Axis placement="left" rule ticks={4} {format} tickLabelProps={{ class: 'fill-ink/45 font-mono text-2xs' }} />
			<Axis
				placement="bottom"
				rule
				ticks={6}
				format={fmtAxisTime}
				tickLabelProps={{ class: 'fill-ink/45 font-mono text-2xs' }}
			/>
			{#each series as s, i (s.label)}
				<Spline
					y={(d: MetricSeriesRow) => d.values[i]}
					curve={curveLinear}
					style="stroke: {s.color}; stroke-width: 2"
				/>
			{/each}
			{#if !brush.brushing}
				<Highlight lines motion="none" />
				<SeriesPoints colors={series.map((s) => s.color)} />
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
						<div class="text-ink/70">{fmtClockMinute(point.at)}</div>
						{#each series as s, i (s.label)}
							<div class="flex items-center justify-between gap-3.5">
								<span class="flex items-center gap-1.5 text-ink/70">
									<span class="h-0.5 w-3" style:background={s.color}></span>{s.label}
								</span>
								<span class="font-semibold text-ink">{format(point.values[i])}</span>
							</div>
						{/each}
					</div>
				{/snippet}
			</Tooltip.Root>
		{/if}
	</Chart>
</ChartFrame>
