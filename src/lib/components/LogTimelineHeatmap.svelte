<script module lang="ts">
	/** What a hovered cell breaks down into, e.g. the classifications behind a category. */
	export type HeatmapDetail = { label: string; count: number };

	// Room for the swatch, its gap, the right-aligned total and the padding either side.
	const LABEL_CHROME = 68;
	const LABEL_CHAR = 6.3;

	/** The gutter the row labels need. A caller showing more than one heatmap passes the same
	 *  value to all of them, computed across every label, so the plots line up. */
	export function heatmapLabelWidth(labels: string[]): number {
		const widest = Math.max(0, ...labels.map((l) => Math.ceil(l.length * LABEL_CHAR)));

		return Math.min(220, Math.max(84, widest + LABEL_CHROME));
	}
</script>

<script lang="ts">
	import { Axis, Chart, Highlight, Svg, Tooltip } from 'layerchart';
	import { scaleTime } from 'd3-scale';
	import { fmtAxisTime, fmtBucketRange, fmtCount, fmtCountFull } from '$lib/format';
	import GapBands from '$lib/components/GapBands.svelte';
	import HeatmapCells, { type HeatmapRow } from '$lib/components/HeatmapCells.svelte';
	import { buildMetricMultiChartModel, type MetricSeriesRow } from '$lib/metricChart';
	import { createTimeBrush } from '$lib/chartBrush.svelte';

	let {
		rows,
		buckets,
		from,
		to,
		bucketMs,
		labelWidth,
		message = null,
		detail
	}: {
		rows: HeatmapRow[];
		/** Bucket start instants; every row's `values` is aligned with this. */
		buckets: Date[];
		from: Date;
		to: Date;
		bucketMs: number;
		/** The row-label gutter, from `heatmapLabelWidth`. */
		labelWidth: number;
		/** Loading, error or empty text, rendered *inside* the plot so the card keeps its
		 *  height and the page below it does not jump. */
		message?: string | null;
		/** Extra lines for the tooltip, for a row whose cell is an aggregate. */
		detail?: (rowKey: string, bucketIndex: number) => HeatmapDetail[];
	} = $props();

	const ROW_HEIGHT = 22;
	const BOTTOM_AXIS = 26;
	const DETAIL_LINES = 6;

	// The same builder as every other timeline chart, so buckets and collection gaps line up
	// with the QUERIES charts over the same range.
	const model = $derived(
		buildMetricMultiChartModel(
			rows.map((row) => buckets.map((at, i) => ({ at, value: row.values[i] ?? null }))),
			from,
			to,
			bucketMs
		)
	);

	const height = $derived(rows.length * ROW_HEIGHT + BOTTOM_AXIS);

	const brush = createTimeBrush(() => model.step);

	const bucketCenter = $derived((d: MetricSeriesRow) => new Date(d.at.getTime() - model.step / 2));

	// The model can insert null rows for gaps, so its row index is not the caller's bucket
	// index. Map back by instant.
	function bucketIndexOf(at: Date): number {
		return buckets.findIndex((b) => b.getTime() === at.getTime());
	}

	function hovered(at: Date) {
		const index = bucketIndexOf(at);

		return rows
			.map((row) => ({ row, count: index < 0 ? 0 : (row.values[index] ?? 0), index }))
			.filter((entry) => entry.count > 0);
	}
</script>

<!-- select-none and the swallowed double-click are ChartFrame's job for the fixed-height
     charts; this one sizes to its rows, so it carries them itself. See ChartFrame for why. -->
<div class="relative select-none" style:height="{height}px" ondblclickcapture={(e) => e.stopPropagation()}>
	<Chart
		data={model.rows}
		x={bucketCenter}
		xScale={scaleTime()}
		xDomain={[model.xFrom, model.xTo]}
		y={() => 0}
		yDomain={[0, 1]}
		padding={{ left: labelWidth, right: 16, bottom: BOTTOM_AXIS }}
		tooltipContext={{ mode: 'bisect-x' }}
		brush={brush.props}
	>
		<Svg>
			<GapBands gaps={model.gaps} />
			<Axis
				placement="bottom"
				rule
				ticks={6}
				format={fmtAxisTime}
				tickLabelProps={{ class: 'fill-ink/45 font-mono text-2xs', stroke: 'none' }}
			/>
			<HeatmapCells {rows} bucketAt={model.rows} step={model.step} rowHeight={ROW_HEIGHT} />
			{#if !brush.brushing && !message}
				<Highlight lines motion="none" />
			{/if}
		</Svg>

		<!-- Hidden mid-drag, like the crosshair. -->
		<Tooltip.Root
			x="data"
			y="pointer"
			anchor="top-left"
			xOffset={18}
			yOffset={10}
			variant="none"
			class={brush.brushing ? 'hidden' : 'border border-line-card bg-card px-3 py-2 shadow-chart'}
		>
			{#snippet children({ data: point }: { data: MetricSeriesRow })}
				{@const entries = hovered(point.at)}
				<div class="flex flex-col gap-1 font-mono text-xs leading-[1.4] whitespace-nowrap">
					<div class="text-ink/70">{fmtBucketRange(point.at, model.step)}</div>
					{#if entries.length === 0}
						<div class="text-ink/70">No events</div>
					{:else}
						{#each entries as entry (entry.row.key)}
							<div class="flex items-center gap-1.5">
								<span class="size-2 flex-none" style:background={entry.row.color}></span>
								<span class="flex-1 text-ink/70">{entry.row.label}</span>
								<span class="font-semibold text-ink">{fmtCountFull(entry.count)}</span>
							</div>
							{#if detail}
								{@const lines = detail(entry.row.key, entry.index)}
								{#each lines.slice(0, DETAIL_LINES) as line (line.label)}
									<div class="flex items-center gap-2.5 pl-3.5 text-ink/55">
										<span class="flex-1">{line.label}</span>
										<span>{fmtCountFull(line.count)}</span>
									</div>
								{/each}
								{#if lines.length > DETAIL_LINES}
									<div class="pl-3.5 text-ink/45">+{lines.length - DETAIL_LINES} more</div>
								{/if}
							{/if}
						{/each}
					{/if}
				</div>
			{/snippet}
		</Tooltip.Root>
	</Chart>

	{#if message}
		<div
			class="pointer-events-none absolute flex items-center justify-center font-mono text-sm text-ink/70"
			style:left="{labelWidth}px"
			style:right="16px"
			style:top="0px"
			style:bottom="{BOTTOM_AXIS}px"
		>
			{message}
		</div>
	{/if}

	<!-- In the chart's left padding as HTML, so they use the app's type scale rather than
	     SVG text. pointer-events-none keeps the brush and tooltip reachable. -->
	<div class="pointer-events-none absolute inset-0">
		{#each rows as row, r (row.key)}
			<div
				class="absolute flex items-center gap-1.5 pr-2 font-condensed text-2xs font-semibold tracking-[0.5px] uppercase {row.total >
				0
					? 'text-ink/70'
					: 'text-ink/35'}"
				style:top="{r * ROW_HEIGHT}px"
				style:height="{ROW_HEIGHT}px"
				style:width="{labelWidth}px"
			>
				<span class="size-2 flex-none" style:background={row.color} style:opacity={row.total > 0 ? 1 : 0.3}></span>
				<span class="truncate" title={row.label}>{row.label}</span>
				<span class="ml-auto font-mono tracking-normal">{row.total > 0 ? fmtCount(row.total) : ''}</span>
			</div>
		{/each}
	</div>
</div>
