<script module lang="ts">
	/** One row of the heatmap: a label, a colour, and a count per bucket. */
	export type HeatmapRow = {
		key: string;
		label: string;
		color: string;
		/** Aligned with the model's rows; null for a bucket with no collection. */
		values: (number | null)[];
		total: number;
	};

	// Discrete rather than a continuous ramp: the eye reads "darker than its neighbour" far
	// better than it reads a 7% opacity difference.
	const HEATMAP_STEPS = [0.28, 0.5, 0.72, 1] as const;

	/** Which step a count falls in, scaled against that row's own busiest bucket rather than
	 *  the chart's. One routine severity can outnumber the errors by four orders of magnitude,
	 *  so a global maximum would leave every row but the busiest blank. A row therefore shows
	 *  *when* something happened and the tooltip gives the magnitude. */
	function heatmapStep(value: number, rowMax: number): number {
		if (value <= 0) return -1;
		if (rowMax <= 1) return HEATMAP_STEPS.length - 1;

		const ratio = value / rowMax;
		const index = Math.ceil(ratio * HEATMAP_STEPS.length) - 1;

		return Math.min(Math.max(index, 0), HEATMAP_STEPS.length - 1);
	}
</script>

<script lang="ts">
	import { getChartContext } from 'layerchart';
	import type { MetricSeriesRow } from '$lib/metricChart';

	let {
		rows,
		bucketAt,
		step,
		rowHeight,
		gap = 1
	}: {
		rows: HeatmapRow[];
		/** The bucket grid, shared with every other timeline chart. */
		bucketAt: MetricSeriesRow[];
		step: number;
		rowHeight: number;
		gap?: number;
	} = $props();

	const c = getChartContext();

	type Cell = { x: number; y: number; w: number; h: number; fill: string; opacity: number };

	const cells = $derived.by(() => {
		const out: Cell[] = [];

		rows.forEach((row, r) => {
			const rowMax = Math.max(0, ...row.values.map((v) => v ?? 0));
			const y = r * rowHeight;

			bucketAt.forEach((bucket, i) => {
				const value = row.values[i] ?? 0;
				const intensity = heatmapStep(value, rowMax);
				// Nothing is drawn for an empty bucket, so a row reads as a timeline of
				// occurrences rather than a bar of varying shade.
				if (intensity < 0) return;

				// The same full-slot geometry as every other timeline chart: [at - step, at],
				// clamped to the plot so a partial edge bucket clips.
				const left = Math.max(0, Math.min(c.width, Number(c.xScale(new Date(bucket.at.getTime() - step)))));
				const right = Math.max(0, Math.min(c.width, Number(c.xScale(bucket.at))));
				const w = right - left - gap;
				if (w <= 0) return;

				out.push({
					x: left,
					y: y + gap,
					w,
					h: Math.max(1, rowHeight - gap * 2),
					fill: row.color,
					opacity: HEATMAP_STEPS[intensity]
				});
			});
		});

		return out;
	});
</script>

{#each rows as row, r (row.key)}
	<!-- A hairline per row, so a category that produced nothing reads as an empty track
	     rather than as missing from the chart. -->
	<rect x={0} y={r * rowHeight + rowHeight / 2} width={c.width} height={1} class="fill-ink/8" />
{/each}

{#each cells as cell, i (i)}
	<rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} style:fill={cell.fill} fill-opacity={cell.opacity} />
{/each}
