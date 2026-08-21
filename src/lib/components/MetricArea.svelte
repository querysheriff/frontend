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
	// to the plot so a half-visible edge bucket is cut off, and a null value breaks the line.
	const areaPath = $derived.by(() => {
		const y0 = Number(c.yScale(0));
		let d = '';
		let open = false;
		let lastRight = 0;
		for (const r of rows) {
			const v = r.values[0];
			if (v == null) {
				if (open) {
					d += ` L ${lastRight} ${y0} Z`;
					open = false;
				}
				continue;
			}
			const left = Math.max(0, Math.min(c.width, Number(c.xScale(new Date(r.at.getTime() - step)))));
			const right = Math.max(0, Math.min(c.width, Number(c.xScale(r.at))));
			const y = Number(c.yScale(v));
			d += open ? ` L ${left} ${y} L ${right} ${y}` : ` M ${left} ${y0} L ${left} ${y} L ${right} ${y}`;
			open = true;
			lastRight = right;
		}
		if (open) d += ` L ${lastRight} ${y0} Z`;
		return d.trim();
	});

	const linePath = $derived.by(() => {
		let d = '';
		let open = false;
		for (const r of rows) {
			const v = r.values[0];
			if (v == null) {
				open = false;
				continue;
			}
			const left = Math.max(0, Math.min(c.width, Number(c.xScale(new Date(r.at.getTime() - step)))));
			const right = Math.max(0, Math.min(c.width, Number(c.xScale(r.at))));
			const y = Number(c.yScale(v));
			d += open ? ` L ${left} ${y} L ${right} ${y}` : ` M ${left} ${y} L ${right} ${y}`;
			open = true;
		}
		return d.trim();
	});
</script>

<path class="metric-area" d={areaPath} style="fill: {fill}" />
<path class="metric-area-line" d={linePath} fill="none" style={lineStyle} />
