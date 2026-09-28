<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ChartPanel from './ChartPanel.svelte';

	const { Story } = defineMeta({
		title: 'Shared/ChartPanel',
		component: ChartPanel,
		parameters: { layout: 'padded' }
	});
</script>

<script lang="ts">
	import AreaChart from './AreaChart.svelte';
	import ChartEmpty from './ChartEmpty.svelte';
	import LineChart from './LineChart.svelte';
	import { fmtDuration } from '$lib/format';
	import type { MetricSeriesPoint } from '$lib/metricChart';

	const BUCKET_MS = 5 * 60_000;
	const to = new Date(Date.UTC(2026, 8, 18, 12, 0));
	const from = new Date(to.getTime() - 24 * 60 * 60_000);

	const series = (base: number, swing: number, phase: number): MetricSeriesPoint[] =>
		Array.from({ length: 288 }, (_, i) => ({
			at: new Date(from.getTime() + (i + 1) * BUCKET_MS),
			value: Math.max(0, base + swing * Math.sin(i / 23 + phase) + (swing / 3) * Math.sin(i / 3.7 + phase * 2))
		}));

	const calls = series(60_000, 20_000, 0);
	const latency = [
		{ label: 'p90', color: 'var(--color-steel)', points: series(420, 120, 1) },
		{ label: 'p95', color: 'var(--color-warn)', points: series(620, 160, 1.4) },
		{ label: 'p99', color: 'var(--color-danger)', points: series(1600, 260, 2) }
	];
</script>

<Story name="Area chart">
	{#snippet template()}
		<ChartPanel title="Query volume over time" description="How many queries ran · 5-minute buckets">
			<AreaChart data={calls} {from} {to} bucketMs={BUCKET_MS} fill="var(--color-steel)" label="calls" unit="calls" />
		</ChartPanel>
	{/snippet}
</Story>

<Story name="Line chart">
	{#snippet template()}
		<ChartPanel title="Query speed over time" description="How long queries of 10 ms or more took">
			<LineChart series={latency} {from} {to} bucketMs={BUCKET_MS} format={fmtDuration} />
		</ChartPanel>
	{/snippet}
</Story>

<Story name="No data">
	{#snippet template()}
		<ChartPanel title="Query speed over time" description="How long queries of 10 ms or more took">
			<ChartEmpty message="No data" />
		</ChartPanel>
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template()}
		<ChartPanel title="Query volume over time" description="How many queries ran">
			<ChartEmpty message="Failed to fetch" error />
		</ChartPanel>
	{/snippet}
</Story>
