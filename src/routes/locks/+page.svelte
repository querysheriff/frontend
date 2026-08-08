<script lang="ts">
	import { timestampFromDate, timestampDate } from '@bufbuild/protobuf/wkt';
	import {
		LockWaitSortColumn,
		type LockParty,
		type LockWait,
		type QueryLockWaitSeriesResponse
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/activity_pb';
	import { activityClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { errMsg, fmtBucketSize, fmtDuration, kvTags } from '$lib/format';
	import { durationMs, toDate, tsKey } from '$lib/activity';
	import type { MetricSeriesPoint } from '$lib/metricChart';
	import Button from '$lib/components/Button.svelte';
	import CallsChart from '$lib/components/CallsChart.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LockWaitTable, { type LockWaitRow, type LockWaitSortCol } from '$lib/components/LockWaitTable.svelte';

	const PAGE_SIZE = 10;

	let series = $state<QueryLockWaitSeriesResponse | undefined>(undefined);
	let chartRange = $state<{ from: Date; to: Date } | null>(null);
	let chartLoading = $state(true);
	let chartError = $state<string | null>(null);

	let waitRows = $state<LockWaitRow[]>([]);
	let waitsLoading = $state(true);
	let waitsError = $state<string | null>(null);
	let hasMore = $state(false);
	let loadingMore = $state(false);
	let sort = $state<{ col: LockWaitSortCol; dir: 'asc' | 'desc' }>({ col: 'waited', dir: 'desc' });

	// Both sides' full text is already on the wire, so no lazy loader.
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

	const sortColumnProto: Record<LockWaitSortCol, LockWaitSortColumn> = {
		started: LockWaitSortColumn.STARTED,
		waited: LockWaitSortColumn.WAITED
	};

	// Sorting and paging are the server's job: ordering a page client-side would
	// only ever reorder the page, not the result set.
	function tableRequest(offset: number) {
		return {
			...scope(),
			sortColumn: sortColumnProto[sort.col],
			sortDesc: sort.dir === 'desc',
			limit: PAGE_SIZE,
			offset
		};
	}

	function toParty(p: LockParty | undefined) {
		return {
			pid: p?.pid ?? 0,
			// application_name is whatever the client set — an opaque string, never parsed.
			app: p?.applicationName ?? '',
			query: p?.query ?? '',
			tags: kvTags(p?.queryTags ?? {})
		};
	}

	function toRow(w: LockWait): LockWaitRow {
		return {
			// Everything that identifies an episode server-side, so two waits by one
			// pid on different lock modes stay two rows instead of colliding on one key.
			key: `${w.waiting?.pid ?? 0}-${tsKey(w.startedWaiting)}-${w.blocking?.pid ?? 0}-${w.lockMode}`,
			waiting: toParty(w.waiting),
			blocking: toParty(w.blocking),
			lockMode: w.lockMode,
			waitMs: durationMs(w.startedWaiting, w.lastSeen),
			startedWaiting: toDate(w.startedWaiting)
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
			.queryLockWaitSeries(request, { signal: chartAc.signal })
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

	let waitsGen = 0;
	let waitsAc: AbortController | null = null;
	$effect(() => {
		if (!ctx.server) {
			waitsLoading = !serversState.loaded;
			if (serversState.loaded) {
				waitRows = [];
				hasMore = false;
				waitsError = null;
			}
			return;
		}
		const request = tableRequest(0);
		const gen = ++waitsGen;
		waitsAc?.abort();
		waitsAc = new AbortController();
		waitsLoading = true;
		waitsError = null;
		// Rows stay on screen while re-fetching and swap in atomically.

		activityClient
			.queryLockWaits(request, { signal: waitsAc.signal })
			.then((res) => {
				if (gen !== waitsGen) return;
				waitRows = res.waits.map(toRow);
				hasMore = res.hasMore;
			})
			.catch((e: unknown) => {
				if (gen !== waitsGen) return;
				waitsError = errMsg(e);
				waitRows = [];
				hasMore = false;
			})
			.finally(() => {
				if (gen === waitsGen) waitsLoading = false;
			});
	});

	async function loadMore() {
		if (loadingMore || waitsLoading || !hasMore) return;
		const gen = waitsGen;
		loadingMore = true;
		try {
			const res = await activityClient.queryLockWaits(tableRequest(waitRows.length), { signal: waitsAc?.signal });
			if (gen !== waitsGen) return;
			const seen = new Set(waitRows.map((r) => r.key));
			waitRows = [...waitRows, ...res.waits.map(toRow).filter((r) => !seen.has(r.key))];
			hasMore = res.hasMore;
		} catch (e: unknown) {
			if (gen === waitsGen) waitsError = errMsg(e);
		} finally {
			loadingMore = false;
		}
	}

	// Seconds on the wire, milliseconds in the chart, so fmtDuration can label it.
	const points = $derived<MetricSeriesPoint[]>(
		(series?.series ?? []).flatMap((p) => (p.at ? [{ at: timestampDate(p.at), value: p.waitSeconds * 1000 }] : []))
	);
	const bucketMs = $derived(Number(series?.bucketMs ?? 0n));
	const chartDescription = $derived(
		points.length > 0
			? `Time queries spent waiting instead of running · ${fmtBucketSize(bucketMs)} buckets`
			: 'Time queries spent waiting instead of running'
	);
</script>

<div class="mb-4 grid gap-4">
	<ChartPanel docId="l-wait-time" title="Lock wait time" description={chartDescription}>
		{#if chartRange && points.length > 0}
			<CallsChart
				data={points}
				from={chartRange.from}
				to={chartRange.to}
				{bucketMs}
				fill="var(--color-warn)"
				label="waiting"
				format={fmtDuration}
				formatFull={fmtDuration}
				unit=""
				minYMax={1000}
			/>
		{:else}
			<ChartEmpty message={chartLoading ? 'Loading…' : (chartError ?? 'No lock waits')} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="l-waits">
	<div class="border-b border-line py-3.5 pr-11 pl-4">
		<SectionHeader title="Lock waits" description="Each query that got stuck, and the query that blocked it" />
	</div>

	<LockWaitTable rows={waitRows} bind:sort {sql} loading={waitsLoading && waitRows.length > 0} />

	{#if waitsLoading && waitRows.length === 0}
		<StateBlock class="px-4 py-6" message="Loading…" />
	{:else if waitsError}
		<StateBlock kind="error" class="px-4 py-6" message={waitsError} />
	{:else if waitRows.length === 0}
		<StateBlock class="px-4 py-6" message="No lock waits in this range" />
	{:else if hasMore}
		<div class="border-t border-line-soft p-3 text-center">
			<Button variant="ghost" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</Button>
		</div>
	{/if}
</DocCard>

<SqlPopover state={sql} />
