<script lang="ts">
	import { getChartContext } from 'layerchart';
	import type { MetricSeriesRow } from '$lib/metricChart';

	let { colors }: { colors: string[] } = $props();

	const c = getChartContext();

	const points = $derived.by(() => {
		const row = c.tooltip.data as MetricSeriesRow | undefined;
		if (row == null) return [];
		const cx = Number(c.xGet(row));
		if (!Number.isFinite(cx)) return [];
		return row.values.map((v, i) => ({ key: i, cx, cy: Number(c.yScale(v)), fill: colors[i] }));
	});
</script>

{#each points as p (p.key)}
	<circle cx={p.cx} cy={p.cy} r={3.5} style:fill={p.fill} class="stroke-card" stroke-width={1.5} />
{/each}
