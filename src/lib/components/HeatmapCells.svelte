<script module lang="ts">
	export type HeatmapRow = {
		key: string;
		label: string;
		color: string;
		/** Aligned with `buckets`. */
		values: number[];
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

	let {
		rows,
		buckets,
		step,
		rowHeight
	}: {
		rows: HeatmapRow[];
		buckets: Date[];
		step: number;
		rowHeight: number;
	} = $props();

	const GAP = 1;

	const c = getChartContext();

	type Cell = { x: number; y: number; w: number; h: number; fill: string; opacity: number };

	const cells = $derived.by(() => {
		const out: Cell[] = [];

		rows.forEach((row, r) => {
			const rowMax = Math.max(0, ...row.values);
			const y = r * rowHeight;

			buckets.forEach((at, i) => {
				const value = row.values[i];
				const intensity = heatmapStep(value, rowMax);
				if (intensity < 0) return;

				// A cell covers its whole bucket, from at-step to at, cut off at the edges of the plot.
				const left = Math.max(0, Math.min(c.width, Number(c.xScale(new Date(at.getTime() - step)))));
				const right = Math.max(0, Math.min(c.width, Number(c.xScale(at))));
				const w = right - left - GAP;
				if (w <= 0) return;

				out.push({
					x: left,
					y: y + GAP,
					w,
					h: Math.max(1, rowHeight - GAP * 2),
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
