<script lang="ts">
	import { timestampFromDate, timestampDate } from '@bufbuild/protobuf/wkt';
	import {
		TransactionSortColumn,
		type QueryTransactionAgeSeriesResponse,
		type Transaction
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/activity_pb';
	import { activityClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { errMsg, fmtDuration } from '$lib/format';
	import { MIN_TRANSACTION_MS, durationMs, toDate, tsKey } from '$lib/activity';
	import type { MetricSeriesPoint } from '$lib/metricChart';
	import Button from '$lib/components/Button.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import TransactionTable, {
		type TransactionRow,
		type TransactionSortCol
	} from '$lib/components/TransactionTable.svelte';

	const PAGE_SIZE = 10;

	let series = $state<QueryTransactionAgeSeriesResponse | undefined>(undefined);
	let chartRange = $state<{ from: Date; to: Date } | null>(null);
	let chartLoading = $state(true);
	let chartError = $state<string | null>(null);

	let txnRows = $state<TransactionRow[]>([]);
	let txnLoading = $state(true);
	let txnError = $state<string | null>(null);
	let hasMore = $state(false);
	let loadingMore = $state(false);
	let sort = $state<{ col: TransactionSortCol; dir: 'asc' | 'desc' }>({ col: 'open', dir: 'desc' });

	// The full text is already on the wire, so no lazy loader.
	const sql = new SqlPopoverState();

	function scope() {
		const { from, to } = ctx.timeRange();
		return {
			serverName: ctx.server,
			databaseName: ctx.db,
			from: timestampFromDate(from),
			to: timestampFromDate(to)
		};
	}

	const sortColumnProto: Record<TransactionSortCol, TransactionSortColumn> = {
		started: TransactionSortColumn.STARTED,
		open: TransactionSortColumn.OPEN
	};

	// Sorting and paging are the server's job, exactly as on Queries: ordering a
	// page client-side would only ever reorder the page, not the result set.
	function tableRequest(offset: number) {
		return {
			...scope(),
			minOpenMs: BigInt(MIN_TRANSACTION_MS),
			sortColumn: sortColumnProto[sort.col],
			sortDesc: sort.dir === 'desc',
			limit: PAGE_SIZE,
			offset
		};
	}

	function toRow(t: Transaction): TransactionRow {
		return {
			key: `${t.pid}-${tsKey(t.start)}`,
			pid: t.pid,
			// application_name is whatever the client set — an opaque string, never parsed.
			app: t.applicationName,
			openMs: durationMs(t.start, t.end),
			start: toDate(t.start),
			startTs: t.start,
			events: t.events
		};
	}

	let chartGen = 0;
	let chartAc: AbortController | null = null;
	$effect(() => {
		const request = scope();
		const { from, to } = ctx.timeRange();
		chartRange = { from, to };
		if (!ctx.server) {
			chartLoading = !serversState.loaded;
			if (serversState.loaded) {
				series = undefined;
				chartError = null;
			}
			return;
		}
		const gen = ++chartGen;
		chartAc?.abort();
		chartAc = new AbortController();
		chartLoading = true;
		chartError = null;
		series = undefined;

		activityClient
			.queryTransactionAgeSeries(request, { signal: chartAc.signal })
			.then((res) => {
				if (gen !== chartGen) return;
				series = res;
			})
			.catch((e: unknown) => {
				if (gen !== chartGen) return;
				chartError = errMsg(e);
			})
			.finally(() => {
				if (gen === chartGen) chartLoading = false;
			});
	});

	let txnGen = 0;
	let txnAc: AbortController | null = null;
	$effect(() => {
		if (!ctx.server) {
			txnLoading = !serversState.loaded;
			if (serversState.loaded) {
				txnRows = [];
				hasMore = false;
				txnError = null;
			}
			return;
		}
		const request = tableRequest(0);
		const gen = ++txnGen;
		txnAc?.abort();
		txnAc = new AbortController();
		txnLoading = true;
		txnError = null;
		// Rows stay on screen while re-fetching and swap in atomically.

		activityClient
			.queryTransactions(request, { signal: txnAc.signal })
			.then((res) => {
				if (gen !== txnGen) return;
				txnRows = res.transactions.map(toRow);
				hasMore = res.hasMore;
			})
			.catch((e: unknown) => {
				if (gen !== txnGen) return;
				txnError = errMsg(e);
				txnRows = [];
				hasMore = false;
			})
			.finally(() => {
				if (gen === txnGen) txnLoading = false;
			});
	});

	async function loadMore() {
		if (loadingMore || txnLoading || !hasMore) return;
		const gen = txnGen;
		loadingMore = true;
		try {
			const res = await activityClient.queryTransactions(tableRequest(txnRows.length), { signal: txnAc?.signal });
			if (gen !== txnGen) return;
			const seen = new Set(txnRows.map((r) => r.key));
			txnRows = [...txnRows, ...res.transactions.map(toRow).filter((r) => !seen.has(r.key))];
			hasMore = res.hasMore;
		} catch (e: unknown) {
			if (gen === txnGen) txnError = errMsg(e);
		} finally {
			loadingMore = false;
		}
	}

	// Seconds on the wire, milliseconds in the chart, so fmtDuration can label it.
	const points = $derived<MetricSeriesPoint[]>(
		(series?.series ?? []).flatMap((p) => (p.at ? [{ at: timestampDate(p.at), value: p.ageSeconds * 1000 }] : []))
	);
	const bucketMs = $derived(Number(series?.bucketMs ?? 0n));
	const ageSeries = $derived([{ label: 'max transaction age', color: 'var(--color-warn)', points }]);
</script>

<div class="mb-4 grid gap-4">
	<ChartPanel
		docId="t-age"
		title="Oldest open transaction"
		description="How old the longest-running open transaction was"
	>
		{#if chartRange && points.length > 0}
			<!-- Same 1s floor as the Locks chart, so an idle range reads as a flat
			     line at the bottom of a seconds axis instead of a millisecond one. -->
			<LineChart
				series={ageSeries}
				from={chartRange.from}
				to={chartRange.to}
				{bucketMs}
				format={fmtDuration}
				minYMax={1000}
			/>
		{:else}
			<ChartEmpty message={chartLoading ? 'Loading…' : (chartError ?? 'No open transactions')} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="t-longest">
	<div class="border-b border-line py-3.5 pr-11 pl-4">
		<SectionHeader
			title="Long transactions"
			description="Transactions open for 5 seconds or more — open one to see what it was doing"
		/>
	</div>

	<TransactionTable rows={txnRows} bind:sort {sql} loading={txnLoading && txnRows.length > 0} />

	{#if txnLoading && txnRows.length === 0}
		<StateBlock class="px-4 py-6" message="Loading…" />
	{:else if txnError}
		<StateBlock kind="error" class="px-4 py-6" message={txnError} />
	{:else if txnRows.length === 0}
		<StateBlock
			class="px-4 py-6"
			message="No transaction stayed open for {fmtDuration(MIN_TRANSACTION_MS)} or more in this range"
		/>
	{:else if hasMore}
		<div class="border-t border-line-soft p-3 text-center">
			<Button variant="ghost" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</Button>
		</div>
	{/if}
</DocCard>

<SqlPopover state={sql} />
