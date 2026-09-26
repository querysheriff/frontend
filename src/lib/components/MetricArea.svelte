<script lang="ts">
	import { getChartContext } from 'layerchart';
	import type { MetricSeriesRow } from '$lib/metricChart';

	let {
		rows,
		step,
		fill,
		lineStyle
	}: {
		rows: MetricSeriesRow[];
		step: number;
		fill: string;
		lineStyle: string;
	} = $props();

	const c = getChartContext();

	// One flat top per bucket, spanning [at-step, at] with a vertical jump between them. x is clamped
	// to the plot so a half-visible edge bucket is cut off.
	const linePath = $derived(
		rows
			.map((r, i) => {
				const left = Math.max(0, Math.min(c.width, Number(c.xScale(new Date(r.at.getTime() - step)))));
				const right = Math.max(0, Math.min(c.width, Number(c.xScale(r.at))));
				const y = Number(c.yScale(r.values[0]));
				return `${i ? 'L' : 'M'} ${left} ${y} L ${right} ${y}`;
			})
			.join(' ')
	);

	const areaPath = $derived.by(() => {
		if (!rows.length) return '';
		const y0 = Number(c.yScale(0));
		const first = Math.max(0, Math.min(c.width, Number(c.xScale(new Date(rows[0].at.getTime() - step)))));
		const last = Math.max(0, Math.min(c.width, Number(c.xScale(rows[rows.length - 1].at))));
		return `M ${first} ${y0} ${linePath.replace(/^M/, 'L')} L ${last} ${y0} Z`;
	});
</script>

<path class="metric-area" d={areaPath} style="fill: {fill}" />
<path class="metric-area-line" d={linePath} fill="none" style={lineStyle} />
