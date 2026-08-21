<script module lang="ts">
	export type HeatmapRow = {
		key: string;
		label: string;
		color: string;
		/** Aligned with the model's rows; null for a bucket with no collection. */
		values: (number | null)[];
		total: number;
	};

	const HEATMAP_STEPS = [0.28, 0.5, 0.72, 1] as const;

	/** Scaled against the row's own busiest bucket; a global maximum would leave every other row blank. */
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
				if (intensity < 0) return;

				// A cell covers its whole bucket, from at-step to at, cut off at the edges of the plot.
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
	<rect x={0} y={r * rowHeight + rowHeight / 2} width={c.width} height={1} class="fill-ink/8" />
{/each}

{#each cells as cell, i (i)}
	<rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} style:fill={cell.fill} fill-opacity={cell.opacity} />
{/each}
