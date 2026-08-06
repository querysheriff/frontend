<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { timestampFromDate, timestampDate } from '@bufbuild/protobuf/wkt';
	import type {
		QueryStatementCallsSeriesResponse,
		QueryStatementPercentileSeriesResponse,
		StatementMetric,
		StatementStat
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/statement_pb';
	import { StatementSortColumn } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/statement_pb';
	import { statementClient } from '$lib/connect';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import { ctx, serversState } from '$lib/state.svelte';
	import { urlSync } from '$lib/urlState.svelte';
	import { QueryFilterState, parseDisplayTag } from '$lib/queryFilter.svelte';
	import { fmtDuration, fmtBucketSize, sevByMean, kvTags, errMsg } from '$lib/format';
	import type { MetricSeriesPoint } from '$lib/metricChart';
	import Button from '$lib/components/Button.svelte';
	import CallsChart from '$lib/components/CallsChart.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import StatementTable, { type StatementRow, type StatementSortCol } from '$lib/components/StatementTable.svelte';
	import TagFilterBar from '$lib/components/TagFilterBar.svelte';

	const PAGE_SIZE = 50;

	const sortColumnProto: Record<StatementSortCol, StatementSortColumn> = {
		query: StatementSortColumn.QUERY,
		usr: StatementSortColumn.USER,
		meanMs: StatementSortColumn.AVG,
		calls: StatementSortColumn.CALLS,
		rowsPerCall: StatementSortColumn.ROWS_PER_CALL,
		pctIo: StatementSortColumn.PCT_IO,
		pctTime: StatementSortColumn.PCT_TIME
	};

	let rows = $state<StatementRow[]>([]);
	let hasMore = $state(false);
	let tableLoading = $state(true);
	let loadingMore = $state(false);
	let tableError = $state<string | null>(null);
	let sort = $state<{ col: StatementSortCol; dir: 'asc' | 'desc' }>({ col: 'pctTime', dir: 'desc' });

	// Fetched separately so the volume chart can paint without waiting on percentiles.
	let callsSeries = $state<QueryStatementCallsSeriesResponse | undefined>(undefined);
	let percentileSeries = $state<QueryStatementPercentileSeriesResponse | undefined>(undefined);
	let chartRange = $state<{ from: Date; to: Date } | null>(null);
	let chartLoading = $state(true);
	let chartError = $state<string | null>(null);

	const sql = new SqlPopoverState((id) => statementClient.getStatementText({ id }).then((r) => r.query));
	const filters = new QueryFilterState();

	// Registration must happen during init, not in a $effect: AppShell rebuilds the
	// whole query string from the registered providers, and its effect would
	// otherwise run first and strip ?q=/?tag= off a deep link before we appear.
	filters.applyQuery(new URLSearchParams(page.url.search));
	onDestroy(urlSync.register(filters));

	let search = $state(filters.text);

	$effect(() => {
		const term = search;
		const id = setTimeout(() => {
			filters.text = term.trim();
		}, 250);
		return () => clearTimeout(id);
	});

	function toRow(s: StatementStat): StatementRow {
		const calls = Number(s.calls);
		return {
			id: s.id.toString(),
			query: s.preview,
			usr: s.userName,
			meanMs: s.avgExecTime,
			calls,
			rowsPerCall: calls > 0 ? Number(s.rows) / calls : 0,
			pctIo: s.pctIo,
			pctTime: s.pctOfTotal,
			sev: sevByMean(s.avgExecTime),
			tags: kvTags(s.tags)
		};
	}

	let chartGen = 0;
	let chartAc: AbortController | null = null;
	$effect(() => {
		const { from, to } = ctx.timeRange();
		chartRange = { from, to };
		if (!ctx.server) {
			chartLoading = !serversState.loaded;
			if (serversState.loaded) {
				callsSeries = undefined;
				percentileSeries = undefined;
				chartError = null;
			}
			return;
		}
		const gen = ++chartGen;
		chartAc?.abort();
		chartAc = new AbortController();
		const ac = chartAc;
		chartLoading = true;
		chartError = null;
		callsSeries = undefined;
		percentileSeries = undefined;

		const scope = {
			serverName: ctx.server,
			databaseName: ctx.db,
			from: timestampFromDate(from),
			to: timestampFromDate(to)
		};

		const calls = statementClient.queryStatementCallsSeries({ scope }, { signal: ac.signal }).then((res) => {
			if (gen === chartGen) callsSeries = res;
		});

		const percentiles = statementClient.queryStatementPercentileSeries({ scope }, { signal: ac.signal }).then((res) => {
			if (gen === chartGen) percentileSeries = res;
		});

		// Each chart paints as its own request lands.
		Promise.allSettled([calls, percentiles]).then((results) => {
			if (gen !== chartGen) return;
			const failed = results.find((r) => r.status === 'rejected');
			chartError = failed ? errMsg((failed as PromiseRejectedResult).reason) : null;
			chartLoading = false;
		});
	});

	function tableRequest(offset: number) {
		const { from, to } = ctx.timeRange();
		return {
			serverName: ctx.server,
			databaseName: ctx.db,
			from: timestampFromDate(from),
			to: timestampFromDate(to),
			queryText: filters.text,
			tagFilters: filters.toProto(),
			kinds: filters.kindsProto(),
			sortColumn: sortColumnProto[sort.col],
			sortDesc: sort.dir === 'desc',
			limit: PAGE_SIZE,
			offset
		};
	}

	let tableGen = 0;
	let tableAc: AbortController | null = null;
	$effect(() => {
		if (!ctx.server) {
			tableLoading = !serversState.loaded;
			if (serversState.loaded) {
				rows = [];
				hasMore = false;
				tableError = null;
			}
			return;
		}
		const request = tableRequest(0);
		const gen = ++tableGen;
		tableAc?.abort();
		tableAc = new AbortController();
		const ac = tableAc;
		tableLoading = true;
		tableError = null;
		// Keep the existing rows on screen while re-fetching (sort/filter/range
		// changes) and swap them in atomically — clearing here would collapse the
		// table to an empty body and jump the layout before the new data lands.

		statementClient
			.queryStatements(request, { signal: ac.signal })
			.then((res) => {
				if (gen !== tableGen) return;
				rows = res.statements.map(toRow);
				hasMore = res.hasMore;
			})
			.catch((e: unknown) => {
				if (gen !== tableGen) return;
				tableError = errMsg(e);
				rows = [];
				hasMore = false;
			})
			.finally(() => {
				if (gen === tableGen) tableLoading = false;
			});
	});

	async function loadMore() {
		if (loadingMore || tableLoading || !hasMore) return;
		const gen = tableGen;
		loadingMore = true;
		try {
			const res = await statementClient.queryStatements(tableRequest(rows.length), { signal: tableAc?.signal });
			if (gen !== tableGen) return;
			const seen = new Set(rows.map((r) => r.id));
			rows = [...rows, ...res.statements.map(toRow).filter((r) => !seen.has(r.id))];
			hasMore = res.hasMore;
		} catch (e: unknown) {
			if (gen === tableGen) tableError = errMsg(e);
		} finally {
			loadingMore = false;
		}
	}

	function toPoints(m?: StatementMetric): MetricSeriesPoint[] {
		return (m?.series ?? []).flatMap((p) => (p.at ? [{ at: timestampDate(p.at), value: p.value }] : []));
	}

	const bucketMs = $derived(Number(callsSeries?.bucketMs ?? percentileSeries?.bucketMs ?? 0n));
	const callsPoints = $derived(toPoints(callsSeries?.calls));
	const volumeDescription = $derived(
		callsPoints.length > 0
			? `How many times queries ran · ${fmtBucketSize(bucketMs)} buckets`
			: 'How many times queries ran'
	);
	const latency = $derived([
		{ label: 'p90', color: 'var(--color-steel)', points: toPoints(percentileSeries?.p90) },
		{ label: 'p95', color: 'var(--color-warn)', points: toPoints(percentileSeries?.p95) },
		{ label: 'p99', color: 'var(--color-danger)', points: toPoints(percentileSeries?.p99) }
	]);

	// The tag sits inside a row that navigates on click.
	function filterByTag(e: MouseEvent, text: string) {
		e.stopPropagation();
		const filter = parseDisplayTag(text);
		if (filter) filters.add(filter);
	}
</script>

<div class="mb-6 grid gap-4">
	<ChartPanel docId="q-volume" title="Query volume over time" description={volumeDescription}>
		{#if chartRange && callsPoints.length > 0}
			<CallsChart
				data={callsPoints}
				from={chartRange.from}
				to={chartRange.to}
				{bucketMs}
				fill="var(--color-steel)"
				label="calls"
			/>
		{:else}
			<ChartEmpty message={chartLoading ? 'Loading…' : (chartError ?? 'No data')} />
		{/if}
	</ChartPanel>

	<ChartPanel
		docId="q-speed"
		title="Query speed over time"
		description="How long queries took — p90 means roughly 9 in 10 finished faster"
	>
		{#if chartRange && latency.some((s) => s.points.length > 0)}
			<LineChart series={latency} from={chartRange.from} to={chartRange.to} {bucketMs} format={fmtDuration} />
		{:else}
			<ChartEmpty message={chartLoading ? 'Loading…' : (chartError ?? 'No data')} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="q-table">
	<header class="pt-3.5 pr-11 pb-0 pl-4">
		<SectionHeader title="Queries" description="Grouped by shape, with the most time-consuming first" />
	</header>
	<TagFilterBar bind:searchText={search} tags={filters} />

	<StatementTable
		{rows}
		bind:sort
		{sql}
		href={(id) => `/queries/${id}`}
		onFilterTag={filterByTag}
		loading={tableLoading && rows.length > 0}
	/>

	{#if tableLoading && rows.length === 0}
		<StateBlock class="px-4 py-7" message="Loading…" />
	{:else if tableError}
		<StateBlock kind="error" class="px-4 py-7" message={tableError} />
	{:else if rows.length === 0}
		<StateBlock class="px-4 py-7" message="No queries found" />
	{:else if hasMore}
		<div class="border-t border-line-soft p-3 text-center">
			<Button variant="ghost" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</Button>
		</div>
	{/if}
</DocCard>

<SqlPopover state={sql} />
