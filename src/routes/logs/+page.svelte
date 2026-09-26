<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { timestampFromDate, timestampDate } from '@bufbuild/protobuf/wkt';
	import {
		LogEvent_LogClassification,
		type GetLogSeriesResponse,
		type LogFacet,
		type LogRecord
	} from '$lib/gen/querysheriff/v1/log_pb';
	import { logClient } from '$lib/connect';
	import { ctx, serversState } from '$lib/state.svelte';
	import { urlSync } from '$lib/urlState.svelte';
	import { LogFilterState } from '$lib/logFilter.svelte';
	import { Loader, PagedLoader } from '$lib/loader.svelte';
	import { fmtBucketSize } from '$lib/format';
	import {
		CATEGORY_ORDER,
		LEVEL_ROWS,
		categoryColor,
		categoryLabel,
		classificationLabel,
		levelColor,
		levelLabel
	} from '$lib/logs';
	import ChartPanel from '$lib/components/ChartPanel.svelte';
	import DocCard from '$lib/components/DocCard.svelte';
	import LogTimelineHeatmap, { heatmapLabelWidth, type HeatmapDetail } from '$lib/components/LogTimelineHeatmap.svelte';
	import { type HeatmapRow } from '$lib/components/HeatmapCells.svelte';
	import LoadMoreFooter from '$lib/components/LoadMoreFooter.svelte';
	import LogFilterBar from '$lib/components/LogFilterBar.svelte';
	import LogsTable from '$lib/components/LogsTable.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';

	const PAGE_SIZE = 50;

	const filters = new LogFilterState();

	// During init, not in a $effect, or AppShell would rewrite the URL first and drop the filter params.
	// `location`, not page.url: after back/forward page.url misses the shallow URL updates.
	filters.applyQuery(new URLSearchParams(location.search));
	onDestroy(urlSync.register(filters));

	let search = $state(filters.text);
	let sortDesc = $state(true);
	let range = $state(ctx.timeRange());

	// Fetched on server and time range alone, so nothing the table does redraws the charts.
	const series = new Loader<GetLogSeriesResponse>();
	const records = new PagedLoader<LogRecord>((r) => r.id);
	// Without facets the picker still lists categories, just without counts; only the table shows errors.
	// Kept while reloading, so an open picker keeps its counts.
	const facets = new Loader<LogFacet[]>();

	$effect(() => {
		const term = search;
		const id = setTimeout(() => {
			filters.text = term.trim();
		}, 250);

		return () => clearTimeout(id);
	});

	// Back/forward rewrites the filters under the input.
	$effect(() => {
		const text = filters.text;
		untrack(() => {
			if (search.trim() !== text) search = text;
		});
	});

	function scope({ from, to } = ctx.timeRange()) {
		return { serverName: ctx.server, from: timestampFromDate(from), to: timestampFromDate(to) };
	}

	$effect(() => {
		const timeRange = ctx.timeRange();
		range = timeRange;
		const request = scope(timeRange);
		if (!ctx.server) return series.reset(!serversState.loaded, serversState.error);
		return series.load((signal) => logClient.getLogSeries(request, { signal }));
	});

	$effect(() => {
		const request = { ...scope(), filter: filters.toFilter(), sortDesc, limit: PAGE_SIZE };
		if (!ctx.server) return records.reset(!serversState.loaded, serversState.error);
		return records.load((offset, signal) =>
			logClient
				.listLogs({ ...request, offset }, { signal })
				.then((res) => ({ rows: res.records, hasMore: res.hasMore }))
		);
	});

	$effect(() => {
		const request = { ...scope(), filter: filters.toFilter() };
		if (!ctx.server) return facets.reset(!serversState.loaded);
		return facets.load((signal) => logClient.listLogFacets(request, { signal }).then((res) => res.facets), {
			keepData: true
		});
	});

	const buckets = $derived(series.data?.buckets ?? []);
	const bucketMs = $derived(Number(series.data?.bucketMs ?? 0n));
	const levelTotals = $derived(series.data?.levelTotals ?? []);

	// Bucket ends: HeatmapCells draws each cell across (at - step, at] and labels the same span.
	const bucketDates = $derived(buckets.map((b) => (b.at ? timestampDate(b.at) : new Date(0))));

	const severityRows = $derived.by((): HeatmapRow[] => {
		const totals = new Map(levelTotals.map((c) => [c.level, Number(c.count)]));

		return LEVEL_ROWS.map((level) => ({
			key: String(level),
			label: levelLabel(level),
			color: levelColor(level),
			total: totals.get(level) ?? 0,
			values: buckets.map((b) => Number(b.levels.find((c) => c.level === level)?.count ?? 0))
		}));
	});

	const categoryRows = $derived.by((): HeatmapRow[] => {
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

	function categoryDetail(rowKey: string, bucketIndex: number): HeatmapDetail[] {
		const bucket = buckets[bucketIndex];
		if (!bucket) return [];

		const entry = bucket.categories.find((c) => String(c.category) === rowKey);

		return (entry?.classifications ?? [])
			.filter((c) => c.classification !== LogEvent_LogClassification.UNSPECIFIED)
			.map((c) => ({ label: classificationLabel(c.classification), count: Number(c.count) }));
	}

	// One gutter across both charts, so their plots start at the same x and the time axes line up.
	const labelWidth = $derived(heatmapLabelWidth([...severityRows, ...categoryRows].map((row) => row.label)));

	const chartMessage = $derived.by(() => {
		if (buckets.length > 0 && levelTotals.length > 0) return null;
		if (series.loading) return 'Loading…';

		return series.error ?? 'No log events';
	});

	const bucketNote = $derived(bucketMs > 0 ? ` · ${fmtBucketSize(bucketMs)} buckets` : '');
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

	<LogFilterBar {filters} facets={facets.data} loading={facets.loading} bind:searchText={search} />

	<LogsTable records={records.rows} bind:sortDesc loading={records.loading && records.rows.length > 0} />

	<LoadMoreFooter list={records} empty="No log events match the current filters" />
</DocCard>
