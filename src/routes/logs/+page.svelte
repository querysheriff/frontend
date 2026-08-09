<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { timestampFromDate, timestampDate } from '@bufbuild/protobuf/wkt';
	import {
		LogEvent_LogClassification,
		LogFacetField,
		LogSortColumn,
		type LogFacet,
		type LogHistogram,
		type LogRecord
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';
	import { logClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { urlSync } from '$lib/urlState.svelte';
	import { LogFilterState } from '$lib/logFilter.svelte';
	import { fmtBucketSize, errMsg } from '$lib/format';
	import {
		CATEGORY_ORDER,
		LEVEL_ROWS,
		categoryColor,
		categoryLabel,
		classificationLabel,
		levelColor,
		levelLabel
	} from '$lib/logs';
	import Button from '$lib/components/Button.svelte';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LogTimelineHeatmap, { heatmapLabelWidth, type HeatmapDetail } from '$lib/components/LogTimelineHeatmap.svelte';
	import { type HeatmapRow } from '$lib/components/HeatmapCells.svelte';
	import LogFilterBar from '$lib/components/LogFilterBar.svelte';
	import LogsTable, { type LogPivot, type LogSort, type LogSortCol } from '$lib/components/LogsTable.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import StateBlock from '$lib/components/StateBlock.svelte';

	const PAGE_SIZE = 50;

	const filters = new LogFilterState();

	// Registration must happen during init, not in a $effect: AppShell rebuilds the whole query
	// string from the registered providers, and its effect would otherwise run first and strip
	// the filter params off a deep link before we appear.
	filters.applyQuery(new URLSearchParams(page.url.search));
	onDestroy(urlSync.register(filters));

	let search = $state(filters.text);

	// Page-local rather than in the URL, matching QUERIES: the filters say what you are looking
	// at and belong in a shared link; the ordering is a viewing preference.
	let sort = $state<LogSort>({ col: 'at', dir: 'desc' });

	const sortColumnProto: Record<LogSortCol, LogSortColumn> = {
		at: LogSortColumn.AT,
		level: LogSortColumn.LEVEL,
		event: LogSortColumn.EVENT,
		category: LogSortColumn.CATEGORY,
		database: LogSortColumn.DATABASE,
		user: LogSortColumn.USERNAME
	};

	let records = $state<LogRecord[]>([]);
	let hasMore = $state(false);
	let tableLoading = $state(true);
	let loadingMore = $state(false);
	let tableError = $state<string | null>(null);

	// Fetched from its own RPC on scope alone, so nothing the table does redraws the charts.
	let histogram = $state<LogHistogram | undefined>(undefined);
	let chartLoading = $state(true);
	let chartError = $state<string | null>(null);
	// Seeded rather than null: the first render reads it before the effect below has run, and a
	// null would collapse the cards for a frame.
	let range = $state(ctx.timeRange());

	let facets = $state<LogFacet[] | undefined>(undefined);
	let facetsLoading = $state(true);

	$effect(() => {
		const term = search;
		const id = setTimeout(() => {
			filters.text = term.trim();
		}, 250);

		return () => clearTimeout(id);
	});

	function scope() {
		const { from, to } = ctx.timeRange();

		return {
			serverName: ctx.server,
			from: timestampFromDate(from),
			to: timestampFromDate(to),
			filter: filters.text
		};
	}

	let chartGen = 0;
	let chartAc: AbortController | null = null;

	// Server and time range only. Riding along in the table's response meant every sort
	// recomputed it, and a preset range ending at "now" shifted the bucket grid each time.
	$effect(() => {
		const { from, to } = ctx.timeRange();
		range = { from, to };

		const request = { serverName: ctx.server, from: timestampFromDate(from), to: timestampFromDate(to) };

		if (!ctx.server) {
			chartLoading = !serversState.loaded;
			if (serversState.loaded) {
				histogram = undefined;
				chartError = null;
			}

			return;
		}

		const mine = ++chartGen;
		chartAc?.abort();
		chartAc = new AbortController();
		const signal = chartAc.signal;
		chartLoading = true;
		chartError = null;

		logClient
			.queryLogSeries(request, { signal })
			.then((res) => {
				if (mine === chartGen) histogram = res.histogram;
			})
			.catch((e: unknown) => {
				if (mine !== chartGen) return;
				chartError = errMsg(e);
				histogram = undefined;
			})
			.finally(() => {
				if (mine === chartGen) chartLoading = false;
			});
	});

	function logsRequest(offset: number) {
		return {
			...scope(),
			...filters.toRequest(),
			sortColumn: sortColumnProto[sort.col],
			sortDesc: sort.dir === 'desc',
			limit: PAGE_SIZE,
			offset
		};
	}

	let tableGen = 0;
	let tableAc: AbortController | null = null;

	$effect(() => {
		// Built before the early return so every filter it reads stays tracked.
		const request = logsRequest(0);

		if (!ctx.server) {
			tableLoading = !serversState.loaded;
			if (serversState.loaded) {
				records = [];
				hasMore = false;
				tableError = null;
			}

			return;
		}

		const gen = ++tableGen;
		tableAc?.abort();
		tableAc = new AbortController();
		const ac = tableAc;
		tableLoading = true;
		tableError = null;
		// Rows stay on screen while re-fetching and are swapped in atomically — clearing here
		// would collapse the table and jump the layout. LoadingOverlay signals the refresh.

		logClient
			.queryLogs(request, { signal: ac.signal })
			.then((res) => {
				if (gen !== tableGen) return;
				records = res.records;
				hasMore = res.hasMore;
			})
			.catch((e: unknown) => {
				if (gen !== tableGen) return;
				tableError = errMsg(e);
				records = [];
				hasMore = false;
			})
			.finally(() => {
				if (gen === tableGen) tableLoading = false;
			});
	});

	let facetGen = 0;
	let facetAc: AbortController | null = null;

	// Fetched separately so the counts and the table never wait on each other.
	$effect(() => {
		const request = { ...scope(), ...filters.toFacetRequest() };

		if (!ctx.server) {
			facetsLoading = !serversState.loaded;
			if (serversState.loaded) facets = undefined;

			return;
		}

		const mine = ++facetGen;
		facetAc?.abort();
		facetAc = new AbortController();
		const signal = facetAc.signal;
		facetsLoading = true;

		logClient
			.listLogFacets(request, { signal })
			.then((res) => {
				if (mine === facetGen) facets = res.facets;
			})
			.catch(() => {
				// The picker degrades to categories with no counts; the table reports the error.
				if (mine === facetGen) facets = undefined;
			})
			.finally(() => {
				if (mine === facetGen) facetsLoading = false;
			});
	});

	async function loadMore() {
		if (loadingMore || tableLoading || !hasMore) return;

		const gen = tableGen;
		loadingMore = true;

		try {
			const res = await logClient.queryLogs(logsRequest(records.length), { signal: tableAc?.signal });
			if (gen !== tableGen) return;

			// A live-tail range keeps moving, so an offset page can repeat a row already shown.
			const seen = new Set(records.map((r) => r.id));
			records = [...records, ...res.records.filter((r) => !seen.has(r.id))];
			hasMore = res.hasMore;
		} catch (e: unknown) {
			if (gen === tableGen) tableError = errMsg(e);
		} finally {
			loadingMore = false;
		}
	}

	const buckets = $derived(histogram?.buckets ?? []);
	const bucketMs = $derived(Number(histogram?.bucketMs ?? 0n));
	const levelTotals = $derived(histogram?.levelTotals ?? []);

	const bucketDates = $derived(buckets.map((b) => (b.bucketStart ? timestampDate(b.bucketStart) : new Date(0))));

	// Every severity gets a row whether or not it occurred: a stable row set is what makes two
	// windows comparable, and an empty PANIC row is worth seeing.
	const severityRows = $derived.by((): HeatmapRow[] => {
		const totals = new Map(levelTotals.map((c) => [c.level, Number(c.count)]));

		return LEVEL_ROWS.map((level) => ({
			key: String(level),
			label: levelLabel(level),
			color: levelColor(level),
			total: totals.get(level) ?? 0,
			values: buckets.map((b) => Number(b.counts.find((c) => c.level === level)?.count ?? 0))
		}));
	});

	// Every category gets a row too, Uncategorized included: showing it conditionally would
	// resize the card the moment the collector failed to classify something.
	const categoryRows = $derived.by((): HeatmapRow[] => {
		// A plain record rather than a Map, which the Svelte lint rules reserve for state.
		const totals: Record<number, number> = {};
		for (const bucket of buckets) {
			for (const entry of bucket.categories) {
				totals[entry.category] = (totals[entry.category] ?? 0) + Number(entry.count);
			}
		}

		return CATEGORY_ORDER.map((category) => ({
			key: String(category),
			label: categoryLabel(category),
			color: categoryColor(category),
			total: totals[category] ?? 0,
			values: buckets.map((b) => Number(b.categories.find((c) => c.category === category)?.count ?? 0))
		}));
	});

	// The event types behind one category cell, which is why the histogram nests them.
	function categoryDetail(rowKey: string, bucketIndex: number): HeatmapDetail[] {
		const bucket = buckets[bucketIndex];
		if (!bucket) return [];

		const entry = bucket.categories.find((c) => String(c.category) === rowKey);

		return (
			(entry?.classifications ?? [])
				// The unrecognised classification has no name, and the "Uncategorized" row label
				// already says what it is.
				.filter((c) => c.classification !== LogEvent_LogClassification.UNSPECIFIED)
				.map((c) => ({ label: classificationLabel(c.classification), count: Number(c.count) }))
		);
	}

	// One gutter across both charts, so their plots start at the same x and the two time axes
	// line up column for column.
	const labelWidth = $derived(heatmapLabelWidth([...severityRows, ...categoryRows].map((row) => row.label)));

	// Rendered inside the chart rather than instead of it, so the cards keep their height and
	// nothing below them moves — as ChartEmpty does inside ChartFrame on QUERIES.
	const chartMessage = $derived.by(() => {
		if (buckets.length > 0 && levelTotals.length > 0) return null;
		if (chartLoading) return 'Loading…';

		return chartError ?? 'No log events';
	});

	const bucketNote = $derived(bucketMs > 0 ? ` · ${fmtBucketSize(bucketMs)} buckets` : '');

	function applyPivot(pivot: LogPivot) {
		if (pivot.kind === 'search') {
			search = pivot.value;
			filters.text = pivot.value;

			return;
		}

		if (pivot.field === LogFacetField.LEVEL) {
			filters.toggleLevel(Number(pivot.value));

			return;
		}

		filters.add(pivot.field, pivot.value);
	}
</script>

<div class="mb-6 grid gap-4">
	<ChartPanel
		docId="lg-severity"
		title="Log severity over time"
		description={`When each severity was logged${bucketNote}`}
	>
		<LogTimelineHeatmap
			rows={severityRows}
			buckets={bucketDates}
			from={range.from}
			to={range.to}
			{bucketMs}
			{labelWidth}
			message={chartMessage}
		/>
	</ChartPanel>

	<ChartPanel
		docId="lg-categories"
		title="Log categories over time"
		description={`When each category of event was logged${bucketNote}`}
	>
		<LogTimelineHeatmap
			rows={categoryRows}
			buckets={bucketDates}
			from={range.from}
			to={range.to}
			{bucketMs}
			{labelWidth}
			message={chartMessage}
			detail={categoryDetail}
		/>
	</ChartPanel>
</div>

<DocCard id="lg-table">
	<header class="pt-3.5 pr-11 pb-0 pl-4">
		<SectionHeader
			title="Log events"
			description="Every message PostgreSQL wrote, newest first — expand one for the full text"
		/>
	</header>

	<LogFilterBar {filters} {facets} loading={facetsLoading} bind:searchText={search} />

	<LogsTable {records} bind:sort loading={tableLoading && records.length > 0} onPivot={applyPivot} />

	{#if tableLoading && records.length === 0}
		<StateBlock class="px-4 py-7" message="Loading…" />
	{:else if tableError}
		<StateBlock kind="error" class="px-4 py-7" message={tableError} />
	{:else if records.length === 0}
		<StateBlock class="px-4 py-7" message="No log events match the current filters" />
	{:else if hasMore}
		<div class="border-t border-line-soft p-3 text-center">
			<Button variant="ghost" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</Button>
		</div>
	{/if}
</DocCard>
