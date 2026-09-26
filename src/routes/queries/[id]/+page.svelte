<script lang="ts">
	import { ArrowLeftIcon } from '@lucide/svelte';
	import { page } from '$app/state';
	import { timestampFromDate } from '@bufbuild/protobuf/wkt';
	import {
		SampleSortColumn,
		type GetStatementResponse,
		type GetStatementSeriesResponse,
		type StatementSample
	} from '$lib/gen/querysheriff/v1/statement_pb';
	import { statementClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { Loader, PagedLoader } from '$lib/loader.svelte';
	import { fmtDuration, fmtBucketSize, kvTags } from '$lib/format';
	import { toSeriesPoints } from '$lib/metricChart';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import LoadMoreFooter from '$lib/components/LoadMoreFooter.svelte';
	import QueryTextBlock from '$lib/components/QueryTextBlock.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import type { Sort } from '$lib/components/SortHeader.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import SamplesTable from '$lib/components/SamplesTable.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import TagRow from '$lib/components/TagRow.svelte';

	const PAGE_SIZE = 50;

	let sampleSort = $state<Sort<SampleSortColumn>>({ column: SampleSortColumn.AT, desc: true });
	let chartRange = $state(ctx.timeRange());

	const meta = new Loader<GetStatementResponse>();
	const series = new Loader<GetStatementSeriesResponse>();
	const samples = new PagedLoader<StatementSample>((s) => s.id);

	const sql = new SqlPopoverState((sampleId) =>
		statementClient.getStatementSample({ id: sampleId }).then((r) => r.query)
	);

	const id = $derived(page.params.id ?? '');
	const validId = $derived(/^\d+$/.test(id));
	const metaError = $derived(validId ? meta.error : 'Invalid query id');

	$effect(() => {
		if (!validId) return meta.reset(false);
		const statementId = BigInt(id);
		return meta.load((signal) => statementClient.getStatement({ id: statementId }, { signal }));
	});

	// Charts and samples are scoped to the statement's server and database, known once it loads.
	function scope(statement: GetStatementResponse, { from, to } = ctx.timeRange()) {
		return {
			serverName: statement.serverName,
			databaseName: statement.databaseName,
			statementId: BigInt(id),
			from: timestampFromDate(from),
			to: timestampFromDate(to)
		};
	}

	$effect(() => {
		const statement = meta.data;
		const range = ctx.timeRange();
		chartRange = range;
		if (!statement) return series.reset(meta.loading, metaError);
		const request = scope(statement, range);
		return series.load((signal) => statementClient.getStatementSeries(request, { signal }));
	});

	$effect(() => {
		const statement = meta.data;
		if (!statement) return samples.reset(meta.loading, metaError);
		const request = {
			...scope(statement),
			sortColumn: sampleSort.column,
			sortDesc: sampleSort.desc,
			limit: PAGE_SIZE
		};
		return samples.load((offset, signal) =>
			statementClient
				.listStatementSamples({ ...request, offset }, { signal })
				.then((res) => ({ rows: res.samples, hasMore: res.hasMore }))
		);
	});

	$effect(() => {
		const statement = meta.data;
		if (!statement) return;
		ctx.server = statement.serverName;
		ctx.db = statement.databaseName;
		ctx.scopeLocked = true;
		return () => {
			ctx.scopeLocked = false;
			// Without a fetched list, reconcile would clear the query's still-valid server and db.
			if (serversState.loaded && !serversState.error) serversState.reconcile();
		};
	});

	const baseTags = $derived(meta.data?.tags ?? {});
	const tags = $derived(kvTags(baseTags));

	const bucketMs = $derived(Number(series.data?.bucketMs ?? 0n));
	const callsPoints = $derived(toSeriesPoints(series.data?.calls));
	const volumeDescription = $derived(
		callsPoints.length > 0
			? `How many times this query ran · ${fmtBucketSize(bucketMs)} buckets`
			: 'How many times this query ran'
	);
	const timing = $derived([
		{ label: 'avg total', color: 'var(--color-command)', points: toSeriesPoints(series.data?.avgMs) },
		{ label: 'avg IO', color: 'var(--color-teal)', points: toSeriesPoints(series.data?.avgIoMs) }
	]);
	const chartMessage = $derived(series.loading ? 'Loading…' : (series.error ?? 'No data'));
</script>

<a
	href="/queries"
	class="mb-5 inline-flex items-center gap-2 font-mono text-sm font-semibold text-command hover:underline"
>
	<ArrowLeftIcon class="size-3.5" /><span>Back</span>
</a>

<DocCard id="qd-query" class="px-4 pt-3.5 pb-4">
	<header class="pr-9">
		<SectionHeader title="Query" description="The normalized query — each captured run below fills in real values" />
	</header>

	<div class="mt-3.5">
		<QueryTextBlock text={meta.data?.query} placeholder={meta.loading ? 'Loading…' : (metaError ?? '')} />
	</div>

	{#if tags.length > 0}
		<TagRow class="mt-3">
			{#each tags as t (t)}
				<Tag text={t} title={t} size="md" />
			{/each}
		</TagRow>
	{/if}
</DocCard>

<div class="mt-4 grid gap-4">
	<ChartPanel docId="qd-volume" title="Query volume over time" description={volumeDescription}>
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
			<ChartEmpty message={chartMessage} />
		{/if}
	</ChartPanel>

	<ChartPanel
		docId="qd-speed"
		title="Query speed over time"
		description="How long this query took per run on average, and how much of that was disk I/O"
	>
		{#if timing.some((s) => s.points.length > 0)}
			<LineChart series={timing} from={chartRange.from} to={chartRange.to} {bucketMs} format={fmtDuration} />
		{:else}
			<ChartEmpty message={chartMessage} />
		{/if}
	</ChartPanel>
</div>

<DocCard id="qd-samples" class="mt-4">
	<div class="border-b border-line py-3.5 pr-11 pl-4">
		<SectionHeader
			title="Captured samples"
			description="Individual runs of this query — the real values each one used, and a plan when captured"
		/>
	</div>

	<SamplesTable
		samples={samples.rows}
		bind:sort={sampleSort}
		{sql}
		statementId={id}
		{baseTags}
		loading={samples.loading && samples.rows.length > 0}
	/>

	<LoadMoreFooter list={samples} empty="No samples captured in this range" />
</DocCard>

<SqlPopover state={sql} />
