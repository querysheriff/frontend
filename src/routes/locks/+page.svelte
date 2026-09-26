<script lang="ts">
	import { timestampFromDate } from '@bufbuild/protobuf/wkt';
	import {
		LockWaitSortColumn,
		type LockParty,
		type LockWait,
		type GetLockWaitSeriesResponse
	} from '$lib/gen/querysheriff/v1/activity_pb';
	import { activityClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { Loader, PagedLoader } from '$lib/loader.svelte';
	import { fmtBucketSize, fmtDuration, kvTags } from '$lib/format';
	import { durationMs, toDate, tsKey } from '$lib/activity';
	import { toSeriesPoints } from '$lib/metricChart';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LoadMoreFooter from '$lib/components/LoadMoreFooter.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import type { Sort } from '$lib/components/SortHeader.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LockWaitTable, { type LockWaitRow } from '$lib/components/LockWaitTable.svelte';

	const PAGE_SIZE = 10;

	let sort = $state<Sort<LockWaitSortColumn>>({ column: LockWaitSortColumn.WAITED, desc: true });
	let chartRange = $state(ctx.timeRange());

	const series = new Loader<GetLockWaitSeriesResponse>();
	const waits = new PagedLoader<LockWaitRow>((r) => r.key);

	// Both sides' full text is already on the wire, so no lazy loader.
	const sql = new SqlPopoverState();

	function scope({ from, to } = ctx.timeRange()) {
		return { serverName: ctx.server, databaseName: ctx.db, from: timestampFromDate(from), to: timestampFromDate(to) };
	}

	function toParty(p: LockParty | undefined) {
		return {
			pid: p?.pid ?? 0,
			app: p?.applicationName ?? '',
			query: p?.query ?? '',
			tags: kvTags(p?.queryTags ?? {})
		};
	}

	function toRow(w: LockWait): LockWaitRow {
		return {
			// Everything that identifies an episode, so one pid's waits on two lock modes stay two rows.
			key: `${w.waiting?.pid ?? 0}-${tsKey(w.startedAt)}-${w.blocking?.pid ?? 0}-${w.lockMode}`,
			waiting: toParty(w.waiting),
			blocking: toParty(w.blocking),
			lockMode: w.lockMode,
			waitMs: durationMs(w.startedAt, w.lastSeenAt),
			startedWaiting: toDate(w.startedAt)
		};
	}

	$effect(() => {
		const range = ctx.timeRange();
		chartRange = range;
		const request = scope(range);
		if (!ctx.server || !ctx.db) return series.reset(!serversState.loaded, serversState.error);
		return series.load((signal) => activityClient.getLockWaitSeries(request, { signal }));
	});

	$effect(() => {
		const request = { ...scope(), sortColumn: sort.column, sortDesc: sort.desc, limit: PAGE_SIZE };
		if (!ctx.server || !ctx.db) return waits.reset(!serversState.loaded, serversState.error);
		return waits.load((offset, signal) =>
			activityClient
				.listLockWaits({ ...request, offset }, { signal })
				.then((res) => ({ rows: res.waits.map(toRow), hasMore: res.hasMore }))
		);
	});

	// Seconds on the wire, milliseconds in the chart, so fmtDuration can label it.
	const points = $derived(toSeriesPoints(series.data?.waitSeconds, 1000));
	const bucketMs = $derived(Number(series.data?.bucketMs ?? 0n));
	const chartDescription = $derived(
		bucketMs > 0
			? `Time queries spent waiting instead of running · ${fmtBucketSize(bucketMs)} buckets`
			: 'Time queries spent waiting instead of running'
	);
</script>

<div class="mb-4 grid gap-4">
	<ChartPanel docId="l-wait-time" title="Lock wait time" description={chartDescription}>
		{#if points.length > 0}
			<AreaChart
				data={points}
				from={chartRange.from}
				to={chartRange.to}
				{bucketMs}
				fill="var(--color-warn)"
				label="waiting"
				format={fmtDuration}
				formatFull={fmtDuration}
				minYMax={1000}
			/>
		{:else}
			<ChartEmpty message={series.loading ? 'Loading…' : (series.error ?? 'No lock waits')} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="l-waits">
	<div class="border-b border-line py-3.5 pr-11 pl-4">
		<SectionHeader title="Lock waits" description="Each query that got stuck, and the query that blocked it" />
	</div>

	<LockWaitTable rows={waits.rows} bind:sort {sql} loading={waits.loading && waits.rows.length > 0} />

	<LoadMoreFooter list={waits} empty="No lock waits in this range" />
</DocCard>

<SqlPopover state={sql} />
