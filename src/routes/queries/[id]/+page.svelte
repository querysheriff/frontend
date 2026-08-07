<script lang="ts">
	import { ArrowLeftIcon } from '@lucide/svelte';
	import { page } from '$app/state';
	import { timestampFromDate, timestampDate } from '@bufbuild/protobuf/wkt';
	import type {
		QueryStatementCallsSeriesResponse,
		QueryStatementDetailResponse,
		QueryStatementTimingSeriesResponse,
		StatementMetric,
		StatementSample
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/statement_pb';
	import { statementClient } from '$lib/connect';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import { ctx, scopeLock } from '$lib/state.svelte';
	import { fmtDuration, fmtBucketSize, sevByDuration, fmtTs, kvTags, errMsg } from '$lib/format';
	import type { MetricSeriesPoint } from '$lib/metricChart';
	import Button from '$lib/components/Button.svelte';
	import CallsChart from '$lib/components/CallsChart.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import ChartEmpty from '$lib/components/ChartEmpty.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import QueryTextBlock from '$lib/components/QueryTextBlock.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SqlPopover from '$lib/components/SqlPopover.svelte';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import SamplesTable, { type SampleRow } from '$lib/components/SamplesTable.svelte';
	import Tag from '$lib/components/Tag.svelte';

	const PAGE_SIZE = 50;

	let detail = $state<QueryStatementDetailResponse | undefined>(undefined);
	let metaLoading = $state(true);
	let metaError = $state<string | null>(null);

	// Split so the volume chart paints without waiting on the timing chart.
	let callsSeries = $state<QueryStatementCallsSeriesResponse | undefined>(undefined);
	let timingSeries = $state<QueryStatementTimingSeriesResponse | undefined>(undefined);
	let chartRange = $state<{ from: Date; to: Date } | null>(null);
	let chartLoading = $state(true);
	let chartError = $state<string | null>(null);

	let samples = $state<SampleRow[]>([]);
	let hasMore = $state(false);
	let samplesLoading = $state(true);
	let loadingMore = $state(false);
	let samplesError = $state<string | null>(null);

	const sql = new SqlPopoverState((sampleId) =>
		statementClient.getStatementSampleText({ sampleId }).then((r) => r.query)
	);

	const id = $derived(page.params.id ?? '');
	const validId = $derived(/^\d+$/.test(id));

	let metaGen = 0;
	let metaAc: AbortController | null = null;
	$effect(() => {
		const statementId = id;
		const { from, to } = ctx.timeRange();
		const gen = ++metaGen;
		metaAc?.abort();
		metaAc = new AbortController();
		const ac = metaAc;

		if (!validId) {
			metaError = 'Invalid query id';
			detail = undefined;
			metaLoading = false;
			return;
		}

		metaLoading = true;
		metaError = null;
		detail = undefined;

		statementClient
			.queryStatementDetail(
				{
					id: BigInt(statementId),
					from: timestampFromDate(from),
					to: timestampFromDate(to)
				},
				{ signal: ac.signal }
			)
			.then((res) => {
				if (gen === metaGen) detail = res;
			})
			.catch((e: unknown) => {
				if (gen !== metaGen) return;
				metaError = errMsg(e);
				detail = undefined;
			})
			.finally(() => {
				if (gen === metaGen) metaLoading = false;
			});
	});

	let chartGen = 0;
	let chartAc: AbortController | null = null;
	$effect(() => {
		const statementId = id;
		const { from, to } = ctx.timeRange();
		chartRange = { from, to };
		const gen = ++chartGen;
		chartAc?.abort();
		chartAc = new AbortController();
		const ac = chartAc;

		if (!validId) {
			chartError = 'Invalid query id';
			callsSeries = undefined;
			timingSeries = undefined;
			chartLoading = false;
			return;
		}

		chartLoading = true;
		chartError = null;
		callsSeries = undefined;
		timingSeries = undefined;

		const scope = {
			statementId: BigInt(statementId),
			from: timestampFromDate(from),
			to: timestampFromDate(to)
		};

		const calls = statementClient.queryStatementCallsSeries({ scope }, { signal: ac.signal }).then((res) => {
			if (gen === chartGen) callsSeries = res;
		});

		const timings = statementClient.queryStatementTimingSeries({ scope }, { signal: ac.signal }).then((res) => {
			if (gen === chartGen) timingSeries = res;
		});

		Promise.allSettled([calls, timings])
			.then((results) => {
				if (gen !== chartGen) return;
				const failed = results.find((r) => r.status === 'rejected');
				chartError = failed ? errMsg((failed as PromiseRejectedResult).reason) : null;
			})
			.finally(() => {
				if (gen === chartGen) chartLoading = false;
			});
	});

	function sampleRequest(offset: number) {
		const { from, to } = ctx.timeRange();
		return {
			id: BigInt(id),
			from: timestampFromDate(from),
			to: timestampFromDate(to),
			limit: PAGE_SIZE,
			offset
		};
	}

	function toSampleRow(s: StatementSample): SampleRow {
		return {
			id: s.id.toString(),
			ts: s.occurredAt ? fmtTs(timestampDate(s.occurredAt)) : '—',
			short: s.query,
			tags: s.tags,
			hasPlan: s.hasPlan,
			durFmt: fmtDuration(s.durationMs),
			sev: sevByDuration(s.durationMs)
		};
	}

	let samplesGen = 0;
	let samplesAc: AbortController | null = null;
	$effect(() => {
		const request = validId ? sampleRequest(0) : null;
		const gen = ++samplesGen;
		samplesAc?.abort();
		samplesAc = new AbortController();
		const ac = samplesAc;

		if (!request) {
			samplesError = 'Invalid query id';
			samples = [];
			hasMore = false;
			samplesLoading = false;
			return;
		}

		samplesLoading = true;
		samplesError = null;

		statementClient
			.queryStatementSamples(request, { signal: ac.signal })
			.then((res) => {
				if (gen !== samplesGen) return;
				samples = res.samples.map(toSampleRow);
				hasMore = res.hasMore;
			})
			.catch((e: unknown) => {
				if (gen !== samplesGen) return;
				samplesError = errMsg(e);
				samples = [];
				hasMore = false;
			})
			.finally(() => {
				if (gen === samplesGen) samplesLoading = false;
			});
	});

	async function loadMore() {
		if (loadingMore || samplesLoading || !hasMore) return;
		const gen = samplesGen;
		loadingMore = true;
		try {
			const res = await statementClient.queryStatementSamples(sampleRequest(samples.length), {
				signal: samplesAc?.signal
			});
			if (gen !== samplesGen) return;
			const seen = new Set(samples.map((s) => s.id));
			samples = [...samples, ...res.samples.map(toSampleRow).filter((s) => !seen.has(s.id))];
			hasMore = res.hasMore;
		} catch (e: unknown) {
			if (gen === samplesGen) samplesError = errMsg(e);
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		if (!detail) return;
		scopeLock.lock(detail.serverName, detail.databaseName);
		ctx.server = detail.serverName;
		ctx.db = detail.databaseName;
	});

	$effect(() => () => scopeLock.unlock());

	const baseTags = $derived(detail?.tags ?? {});
	const tags = $derived(kvTags(baseTags));
	const hasBaseTags = $derived(Object.keys(baseTags).length > 0);

	// Samples carry the base tags too; show only the ones that differ from the
	// base so each row isn't a repeat of the tag list shown at the top.
	function extraTags(tagMap: Record<string, string>): string[] {
		return kvTags(Object.fromEntries(Object.entries(tagMap).filter(([k, v]) => baseTags[k] !== v)));
	}

	function toPoints(m?: StatementMetric): MetricSeriesPoint[] {
		return (m?.series ?? []).flatMap((p) => (p.at ? [{ at: timestampDate(p.at), value: p.value }] : []));
	}

	const bucketMs = $derived(Number(callsSeries?.bucketMs ?? timingSeries?.bucketMs ?? 0n));
	const callsPoints = $derived(toPoints(callsSeries?.calls));
	const volumeDescription = $derived(
		callsPoints.length > 0
			? `How many times this query ran · ${fmtBucketSize(bucketMs)} buckets`
			: 'How many times this query ran'
	);
	const timing = $derived([
		{ label: 'avg total', color: 'var(--color-command)', points: toPoints(timingSeries?.avg) },
		{ label: 'avg IO', color: 'var(--color-teal)', points: toPoints(timingSeries?.avgIo) }
	]);
</script>

<a
	href="/queries"
	class="mb-5 inline-flex items-center gap-2 font-mono text-sm font-semibold text-command hover:underline"
>
	<ArrowLeftIcon class="size-3.5" /><span>Back</span>
</a>

<div class="border border-line-card bg-card px-4 pt-3.5 pb-4">
	<header class="pr-9">
		<SectionHeader title="Query" description="The normalized query — each captured run below fills in real values" />
	</header>

	<div class="mt-3.5">
		<QueryTextBlock text={detail?.query} placeholder={metaLoading ? 'Loading…' : (metaError ?? '')} />
	</div>

	{#if tags.length > 0}
		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each tags as t (t)}
				<Tag text={t} size="md" />
			{/each}
		</div>
	{/if}
</div>

<div class="mt-4 grid gap-4">
	<ChartPanel docId="qd-volume" title="Query volume over time" description={volumeDescription}>
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
		docId="qd-speed"
		title="Query speed over time"
		description="How long this query took per run on average, and how much of that was disk I/O"
	>
		{#if chartRange && timing.some((s) => s.points.length > 0)}
			<LineChart series={timing} from={chartRange.from} to={chartRange.to} {bucketMs} format={fmtDuration} />
		{:else}
			<ChartEmpty message={chartLoading ? 'Loading…' : (chartError ?? 'No data')} />
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

	<SamplesTable {samples} {sql} {id} {hasBaseTags} {extraTags} loading={samplesLoading && samples.length > 0} />

	{#if samplesLoading && samples.length === 0}
		<StateBlock class="px-4 py-6" message="Loading…" />
	{:else if samplesError}
		<StateBlock kind="error" class="px-4 py-6" message={samplesError} />
	{:else if samples.length === 0}
		<StateBlock class="px-4 py-6" message="No samples captured in this range" />
	{:else if hasMore}
		<div class="border-t border-line-soft p-3 text-center">
			<Button variant="ghost" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</Button>
		</div>
	{/if}
</DocCard>

<SqlPopover state={sql} />
