<script lang="ts">
	import { timestampFromDate } from '@bufbuild/protobuf/wkt';
	import {
		TransactionSortColumn,
		type GetTransactionAgeSeriesResponse,
		type Transaction
	} from '$lib/gen/querysheriff/v1/activity_pb';
	import { activityClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { Loader, PagedLoader } from '$lib/loader.svelte';
	import { fmtDuration } from '$lib/format';
	import { MIN_TRANSACTION_MS, durationMs, toDate, tsKey } from '$lib/activity';
	import { toSeriesPoints } from '$lib/metricChart';
	import LineChart from '$lib/components/LineChart.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LoadMoreFooter from '$lib/components/LoadMoreFooter.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import type { Sort } from '$lib/components/SortHeader.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import TransactionTable, { type TransactionRow } from '$lib/components/TransactionTable.svelte';

	const PAGE_SIZE = 10;

	let sort = $state<Sort<TransactionSortColumn>>({ column: TransactionSortColumn.OPEN, desc: true });
	let chartRange = $state(ctx.timeRange());

	const series = new Loader<GetTransactionAgeSeriesResponse>();
	const transactions = new PagedLoader<TransactionRow>((r) => r.key);

	// The full text is already on the wire, so no lazy loader.
	const sql = new SqlPopoverState();

	function scope({ from, to } = ctx.timeRange()) {
		return { serverName: ctx.server, databaseName: ctx.db, from: timestampFromDate(from), to: timestampFromDate(to) };
	}

	function toRow(t: Transaction): TransactionRow {
		return {
			key: `${t.pid}-${tsKey(t.startedAt)}`,
			pid: t.pid,
			app: t.applicationName,
			openMs: durationMs(t.startedAt, t.lastSeenAt),
			start: toDate(t.startedAt),
			events: t.events
		};
	}

	$effect(() => {
		const range = ctx.timeRange();
		chartRange = range;
		const request = scope(range);
		if (!ctx.server || !ctx.db) return series.reset(!serversState.loaded, serversState.error);
		return series.load((signal) => activityClient.getTransactionAgeSeries(request, { signal }));
	});

	$effect(() => {
		const request = {
			...scope(),
			minOpenMs: BigInt(MIN_TRANSACTION_MS),
			sortColumn: sort.column,
			sortDesc: sort.desc,
			limit: PAGE_SIZE
		};
		if (!ctx.server || !ctx.db) return transactions.reset(!serversState.loaded, serversState.error);
		return transactions.load((offset, signal) =>
			activityClient
				.listTransactions({ ...request, offset }, { signal })
				.then((res) => ({ rows: res.transactions.map(toRow), hasMore: res.hasMore }))
		);
	});

	// Seconds on the wire, milliseconds in the chart, so fmtDuration can label it.
	const points = $derived(toSeriesPoints(series.data?.ageSeconds, 1000));
	const bucketMs = $derived(Number(series.data?.bucketMs ?? 0n));
	const ageSeries = $derived([{ label: 'max transaction age', color: 'var(--color-warn)', points }]);
</script>

<div class="mb-4 grid gap-4">
	<ChartPanel
		docId="t-age"
		title="Oldest open transaction"
		description="How old the longest-running open transaction was"
	>
		{#if points.length > 0}
			<LineChart
				series={ageSeries}
				from={chartRange.from}
				to={chartRange.to}
				{bucketMs}
				format={fmtDuration}
				minYMax={1000}
			/>
		{:else}
			<ChartEmpty message={series.loading ? 'Loading…' : (series.error ?? 'No open transactions')} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="t-longest">
	<div class="border-b border-line py-3.5 pr-11 pl-4">
		<SectionHeader
			title="Long transactions"
			description="Transactions open for {fmtDuration(MIN_TRANSACTION_MS)} or more — open one to see what it was doing"
		/>
	</div>

	<TransactionTable
		rows={transactions.rows}
		bind:sort
		{sql}
		loading={transactions.loading && transactions.rows.length > 0}
	/>

	<LoadMoreFooter
		list={transactions}
		empty="No transaction stayed open for {fmtDuration(MIN_TRANSACTION_MS)} or more in this range"
	/>
</DocCard>

<SqlPopover state={sql} />
