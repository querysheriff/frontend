<script lang="ts">
	import { timestampFromDate } from '@bufbuild/protobuf/wkt';
	import {
		StatementSortColumn,
		type GetLatencySeriesResponse,
		type GetStatementSeriesResponse,
		type StatementStat
	} from '$lib/gen/querysheriff/v1/statement_pb';
	import { statementClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { QueryFilterState } from '$lib/queryFilter.svelte';
	import { Loader, PagedLoader } from '$lib/loader.svelte';
	import { fmtDuration, fmtBucketSize } from '$lib/format';
	import { toSeriesPoints } from '$lib/metricChart';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import LoadMoreFooter from '$lib/components/LoadMoreFooter.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import type { Sort } from '$lib/components/SortHeader.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import StatementTable from '$lib/components/StatementTable.svelte';
	import TagFilterBar from '$lib/components/TagFilterBar.svelte';

	const PAGE_SIZE = 50;

	let sort = $state<Sort<StatementSortColumn>>({ column: StatementSortColumn.PCT_TIME, desc: true });
	let chartRange = $state(ctx.timeRange());

	// Fetched separately so the volume chart can paint without waiting on percentiles.
	const calls = new Loader<GetStatementSeriesResponse>();
	const latency = new Loader<GetLatencySeriesResponse>();
	const statements = new PagedLoader<StatementStat>((s) => s.id);

	const sql = new SqlPopoverState((id) => statementClient.getStatement({ id }).then((r) => r.query));
	const filters = new QueryFilterState();

	let search = $state('');

	$effect(() => {
		const term = search;
		const id = setTimeout(() => {
			filters.text = term.trim();
		}, 250);
		return () => clearTimeout(id);
	});

	function scope({ from, to } = ctx.timeRange()) {
		return { serverName: ctx.server, databaseName: ctx.db, from: timestampFromDate(from), to: timestampFromDate(to) };
	}

	$effect(() => {
		const range = ctx.timeRange();
		chartRange = range;
		const request = scope(range);
		if (!ctx.server || !ctx.db) {
			calls.reset(!serversState.loaded, serversState.error);
			latency.reset(!serversState.loaded, serversState.error);
			return;
		}
		const stopCalls = calls.load((signal) => statementClient.getStatementSeries(request, { signal }));
		const stopLatency = latency.load((signal) => statementClient.getLatencySeries(request, { signal }));
		return () => {
			stopCalls();
			stopLatency();
		};
	});

	$effect(() => {
		const request = {
			...scope(),
			...filters.toRequest(),
			sortColumn: sort.column,
			sortDesc: sort.desc,
			limit: PAGE_SIZE
		};
		if (!ctx.server || !ctx.db) return statements.reset(!serversState.loaded, serversState.error);
		return statements.load((offset, signal) =>
			statementClient
				.listStatements({ ...request, offset }, { signal })
				.then((res) => ({ rows: res.statements, hasMore: res.hasMore }))
		);
	});

	const bucketMs = $derived(Number(calls.data?.bucketMs ?? latency.data?.bucketMs ?? 0n));
	const callsPoints = $derived(toSeriesPoints(calls.data?.calls));
	const volumeDescription = $derived(
		callsPoints.length > 0
			? `How many times queries ran · ${fmtBucketSize(bucketMs)} buckets`
			: 'How many times queries ran'
	);
	const latencySeries = $derived([
		{ label: 'p90', color: 'var(--color-steel)', points: toSeriesPoints(latency.data?.p90Ms) },
		{ label: 'p95', color: 'var(--color-warn)', points: toSeriesPoints(latency.data?.p95Ms) },
		{ label: 'p99', color: 'var(--color-danger)', points: toSeriesPoints(latency.data?.p99Ms) }
	]);
	const latencyMessage = $derived.by(() => {
		if (calls.loading || latency.loading) return 'Loading…';
		if (latency.error) return latency.error;
		return callsPoints.length > 0 ? 'No queries took 10 ms or more' : 'No data';
	});
</script>

<div class="mb-6 grid gap-4">
	<ChartPanel docId="q-volume" title="Query volume over time" description={volumeDescription}>
		{#if callsPoints.length > 0}
			<AreaChart
				data={callsPoints}
				from={chartRange.from}
				to={chartRange.to}
				{bucketMs}
				fill="var(--color-steel)"
				label="calls"
				unit="calls"
			/>
		{:else}
			<ChartEmpty message={calls.loading ? 'Loading…' : (calls.error ?? 'No data')} />
		{/if}
	</ChartPanel>

	<ChartPanel
		docId="q-speed"
		title="Query speed over time"
		description="How long queries of 10 ms or more took — p90 means roughly 9 in 10 finished faster"
	>
		{#if latencySeries.some((s) => s.points.length > 0)}
			<LineChart series={latencySeries} from={chartRange.from} to={chartRange.to} {bucketMs} format={fmtDuration} />
		{:else}
			<ChartEmpty message={latencyMessage} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="q-table">
	<header class="pt-3.5 pr-11 pb-0 pl-4">
		<SectionHeader title="Queries" description="Grouped by shape, with the most time-consuming first" />
	</header>
	<TagFilterBar bind:searchText={search} {filters} />

	<StatementTable rows={statements.rows} bind:sort {sql} loading={statements.loading && statements.rows.length > 0} />

	<LoadMoreFooter list={statements} empty="No queries found" />
</DocCard>

<SqlPopover state={sql} />
