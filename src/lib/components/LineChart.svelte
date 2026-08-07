<script lang="ts">
	import { Axis, Chart, Grid, Highlight, Spline, Svg, Tooltip } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { fmtAxisTime, fmtClockMinute } from '$lib/format';
	import ChartFrame from '$lib/components/ChartFrame.svelte';
	import GapBands from '$lib/components/GapBands.svelte';
	import SeriesPoints from '$lib/components/SeriesPoints.svelte';
	import { buildMetricMultiChartModel, type MetricSeriesPoint, type MetricSeriesRow } from '$lib/metricChart';

	type Series = { label: string; color: string; points: MetricSeriesPoint[] };

	let {
		series,
		from,
		to,
		bucketMs,
		format
	}: {
		series: Series[];
		from: Date;
		to: Date;
		bucketMs: number;
		format: (value: number) => string;
	} = $props();

	const model = $derived(
		buildMetricMultiChartModel(
			series.map((s) => s.points),
			from,
			to,
			bucketMs
		)
	);

	const yMax = $derived.by(() => {
		let m = 0;
		for (const s of series) {
			for (const p of s.points) {
				if (p.value != null && p.value > m) m = p.value;
			}
		}
		return m;
	});
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
			{#each series as s, i (s.label)}
				<Spline
					y={(d: MetricSeriesRow) => d.values[i]}
					defined={(d: MetricSeriesRow) => d.values[i] != null}
					curve={curveLinear}
					stroke={s.color}
					stroke-width={2}
				/>
			{/each}
			<Highlight lines motion="none" />
			<SeriesPoints colors={series.map((s) => s.color)} values={(d: MetricSeriesRow) => d.values} />
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
				<div class="flex flex-col gap-1 font-mono text-xs leading-[1.4] whitespace-nowrap">
					<div class="text-ink/70">{fmtClockMinute(point.at)}</div>
					{#each series as s, i (s.label)}
						<div class="flex items-center justify-between gap-3.5">
							<span class="flex items-center gap-1.5 text-ink/70">
								<span class="h-0.5 w-3" style:background={s.color}></span>{s.label}
							</span>
							<span class="font-semibold text-ink"
								>{point.values[i] == null ? '—' : format(point.values[i] as number)}</span
							>
						</div>
					{/each}
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
