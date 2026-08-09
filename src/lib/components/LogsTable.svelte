<script module lang="ts">
	import { LogFacetField } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';

	/** What a cell can pivot the filter on. `search` covers PID, which the free-text filter
	 *  matches rather than being a facet of its own. */
	export type LogPivot = { kind: 'facet'; field: LogFacetField; value: string } | { kind: 'search'; value: string };

	export type LogSortCol = 'at' | 'level' | 'event' | 'category' | 'database' | 'user';
	export type LogSort = { col: LogSortCol; dir: 'asc' | 'desc' };
</script>

<script lang="ts">
	import { clsx } from 'clsx';
	import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from '@lucide/svelte';
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import type { LogRecord } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';
	import { fmtDuration, fmtTs, sevByDuration, sevText, truncate } from '$lib/format';
	import {
		categoryBadge,
		categoryLabel,
		classificationCode,
		classificationLabel,
		levelBadge,
		levelLabel,
		messageIsSampleText
	} from '$lib/logs';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import QueryTextBlock from '$lib/components/QueryTextBlock.svelte';
	import SortHeader from '$lib/components/SortHeader.svelte';

	let {
		records,
		sort = $bindable(),
		loading = false,
		onPivot
	}: {
		records: LogRecord[];
		sort: LogSort;
		loading?: boolean;
		onPivot: (pivot: LogPivot) => void;
	} = $props();

	let expanded = $state<Record<string, boolean>>({});
	let headHeight = $state(0);

	const rowKey = (r: LogRecord): string => r.id.toString();

	function toggleRow(r: LogRecord) {
		const k = rowKey(r);
		expanded[k] = !expanded[k];
	}

	function onRowKey(e: KeyboardEvent, r: LogRecord) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleRow(r);
		}
	}

	// The row is a click-to-expand target, so every pivot has to stop the click reaching it.
	function pivot(e: MouseEvent, p: LogPivot) {
		e.stopPropagation();
		onPivot(p);
	}

	// Time and severity open newest/worst first; the label columns read better alphabetically.
	const DESC_FIRST: LogSortCol[] = ['at', 'level'];

	function sortBy(col: LogSortCol) {
		if (sort.col === col) sort = { col, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
		else sort = { col, dir: DESC_FIRST.includes(col) ? 'desc' : 'asc' };
	}

	const tsFmt = (r: LogRecord): string => (r.occurredAt ? fmtTs(timestampDate(r.occurredAt)) : '—');

	// Twice what the widest column shows, so CSS still does the visible cutting but no row
	// carries kilobytes of invisible text.
	const PREVIEW_CHARS = 200;

	// Same rule in the row and in the panel, so the two slow-query event types look alike.
	const messageOf = (r: LogRecord): string => (messageIsSampleText(r.classification) ? '' : r.message);

	function preview(r: LogRecord): string {
		const message = messageOf(r);
		if (message) return truncate(message, PREVIEW_CHARS);

		const sample = r.statementSample;
		if (!sample) return '';

		return `${fmtDuration(sample.durationMs)} · ${truncate(sample.query, PREVIEW_CHARS)}`;
	}

	// Application, backend type and PID live in the expanded panel: application is
	// high-cardinality noise (correlation ids get appended to it) and backend is almost always
	// "client backend". Six columns is also what removes the forced horizontal scroll.
	//
	// The badge columns are sized to their widest value — WARNING 77px, CONSTRAINT VIOLATION
	// 159px, plus 32px of cell padding — so neither ellipsises and neither leaves a gap. The
	// table is `table-fixed`, so Event absorbs whatever is left.
	const headDef: { key: LogSortCol; label: string; cls: string; pad?: string }[] = [
		{ key: 'at', label: 'At', cls: 'w-[11.75rem]', pad: 'pl-9 pr-4' },
		// "Severity" facing the user, `level` internally: the wire name is LogEvent.LogLevel,
		// but Postgres calls these severities in its own log format (`error_severity`).
		{ key: 'level', label: 'Severity', cls: 'w-[7rem]' },
		{ key: 'event', label: 'Event', cls: '' },
		{ key: 'category', label: 'Category', cls: 'hidden w-[12.25rem] lg:table-cell' },
		{ key: 'database', label: 'Database', cls: 'hidden w-[8.5rem] sm:table-cell' },
		{ key: 'user', label: 'User', cls: 'hidden w-[8.5rem] lg:table-cell' }
	];

	// leading-[20px] on the cell rather than its contents fixes one line-box strut for the
	// whole row, so a badge and the plain text beside it share a baseline.
	const cell = 'border-b border-line-soft px-4 py-3 align-top leading-[20px]';
	// Sized to its text, not the cell: `block w-full` would highlight and filter on click
	// across empty space, reading as a hit area that is not there.
	const pivotCls = 'inline-block max-w-full cursor-pointer truncate align-top hover:text-command';
	// h-5 matches the strut. translate-y-px is an optical correction: a 12px all-caps label
	// centred in a 20px box reads a pixel high against the mixed-case text beside it, and
	// `align-baseline` overshoots by as much the other way. `pill` carries the hover state —
	// see the style block at the end of this file.
	const badgeCls = 'pill inline-flex h-5 max-w-full translate-y-px items-center align-top leading-none';
	const panelLabel = 'mb-1 font-condensed text-2xs font-semibold tracking-[1px] text-ink/70 uppercase';

	// Whether the panel has anything beyond the PID/application/backend footer.
	const hasDetail = (r: LogRecord): boolean =>
		!!(messageOf(r) || r.statementSample || r.stateCode || r.detail || r.hint || r.context || r.statement);
</script>

{#snippet pivotValue(value: string, field: LogFacetField)}
	{#if value}
		<button
			type="button"
			onclick={(e) => pivot(e, { kind: 'facet', field, value })}
			title="Filter by {value}"
			class="{pivotCls} text-sm text-ink/75">{value}</button
		>
	{:else}
		<span class="text-sm text-ink/45">—</span>
	{/if}
{/snippet}

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[34rem] table-fixed border-collapse font-sans">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as col (col.label)}
					<SortHeader
						label={col.label}
						class={col.cls}
						pad={col.pad}
						dir={sort.col === col.key ? sort.dir : null}
						onsort={() => sortBy(col.key)}
					/>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each records as r (rowKey(r))}
				{@const open = expanded[rowKey(r)] ?? false}
				{@const lb = levelBadge(r.logLevel)}
				{@const cb = categoryBadge(r.category)}
				{@const sample = r.statementSample}
				{@const summary = preview(r)}
				<tr
					onclick={() => toggleRow(r)}
					onkeydown={(e) => onRowKey(e, r)}
					role="button"
					tabindex="0"
					aria-expanded={open}
					class={clsx(
						'relative cursor-pointer transition-colors',
						// A neutral tint, not the terracotta accent: an expanded row is selected, not in
						// trouble. Twice the hover weight, so open still reads as stronger than hovered.
						open ? 'bg-hover-strong [&>td]:border-b-transparent' : 'hover:bg-hover'
					)}
				>
					<td class="{cell} relative pr-4 pl-9">
						<!-- In an absolute gutter so the timestamp still starts under its heading. -->
						<span class="absolute top-3 left-3.5 flex h-5 items-center">
							{#if open}
								<ChevronDownIcon class="size-3.5 flex-none text-command" />
							{:else}
								<ChevronRightIcon class="size-3.5 flex-none text-command" />
							{/if}
						</span>
						<!-- inline-block so the box is the cell's 20px strut, not the font's 18.5px ink
						     box, which would sit the timestamp below everything beside it. -->
						<span class="inline-block align-top font-mono text-sm whitespace-nowrap text-ink/80">{tsFmt(r)}</span>
					</td>

					<td class={cell}>
						<button
							type="button"
							onclick={(e) => pivot(e, { kind: 'facet', field: LogFacetField.LEVEL, value: String(r.logLevel) })}
							title="Filter by {levelLabel(r.logLevel)}"
							class="{badgeCls} cursor-pointer px-2 font-condensed text-2xs font-bold tracking-[0.7px] whitespace-nowrap uppercase"
							style:--pill-fg={lb.color}
							style:--pill-bg={lb.background}
							style:--pill-border={lb.border}
							style:--pill-fg-hover={lb.hoverColor}
							style:--pill-bg-hover={lb.hoverBackground}
							style:--pill-border-hover={lb.hoverBorder}>{levelLabel(r.logLevel)}</button
						>
					</td>

					<td class="{cell} overflow-hidden">
						<button
							type="button"
							onclick={(e) =>
								pivot(e, { kind: 'facet', field: LogFacetField.CLASSIFICATION, value: String(r.classification) })}
							title={classificationCode(r.classification) || 'Filter by this event type'}
							class="{pivotCls} text-sm text-ink">{classificationLabel(r.classification)}</button
						>
						{#if summary}
							<span class="mt-0.5 block truncate font-mono text-xs leading-[18px] text-ink/70">{summary}</span>
						{/if}
					</td>

					<td class="{cell} hidden overflow-hidden lg:table-cell">
						<button
							type="button"
							onclick={(e) => pivot(e, { kind: 'facet', field: LogFacetField.CATEGORY, value: String(r.category) })}
							title="Filter by {categoryLabel(r.category)}"
							class="{badgeCls} cursor-pointer truncate px-2 font-condensed text-2xs font-semibold tracking-[0.6px] uppercase"
							style:--pill-fg={cb.color}
							style:--pill-bg={cb.background}
							style:--pill-border={cb.border}
							style:--pill-fg-hover={cb.hoverColor}
							style:--pill-bg-hover={cb.hoverBackground}
							style:--pill-border-hover={cb.hoverBorder}>{categoryLabel(r.category)}</button
						>
					</td>

					<td class="{cell} hidden overflow-hidden sm:table-cell">
						{@render pivotValue(r.databaseName, LogFacetField.DATABASE)}
					</td>

					<td class="{cell} hidden overflow-hidden lg:table-cell">
						{@render pivotValue(r.username, LogFacetField.USERNAME)}
					</td>
				</tr>

				{#if open}
					<tr>
						<td colspan={headDef.length} class="border-b border-line p-0">
							<div class="border-l-2 border-line-bold bg-hover-soft px-5 py-4 md:pl-12">
								{#if messageOf(r)}
									<div class="mb-3.5">
										<div class={panelLabel}>Message</div>
										<div class="font-mono text-md leading-[1.6] break-words whitespace-pre-wrap text-ink">
											{messageOf(r)}
										</div>
									</div>
								{/if}

								{#if sample}
									<!-- No query text: QUERY DETAIL renders the same SQL in full, with its plan and
									     its other samples. Duration plus the links is what this adds. -->
									<div class="mb-3.5">
										<div class={panelLabel}>Sampled statement</div>
										<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
											<span
												class="font-mono text-md font-semibold"
												style:color={sevText(sevByDuration(sample.durationMs))}>{fmtDuration(sample.durationMs)}</span
											>
											{#if sample.statementId}
												<a
													href="/queries/{sample.statementId}"
													onclick={(e) => e.stopPropagation()}
													class="font-condensed text-xs font-semibold tracking-[0.6px] text-command uppercase hover:underline"
													>Open query</a
												>
												{#if sample.hasExplainPlan}
													<a
														href="/queries/{sample.statementId}/plan/{sample.id}"
														target="_blank"
														rel="noopener"
														onclick={(e) => e.stopPropagation()}
														class="inline-flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-[0.6px] text-command uppercase hover:underline"
														>View plan<ExternalLinkIcon class="size-3 stroke-[2.2]" /></a
													>
												{/if}
											{:else}
												<!-- statement_id is null without compute_query_id, so there is no aggregate
												     row to link to. -->
												<span class="font-sans text-xs text-ink/70">
													Not matched to a known query — enable
													<code class="font-mono">compute_query_id</code> to link these
												</span>
											{/if}
										</div>
									</div>
								{/if}

								{#if r.stateCode}
									<!-- Shown but not filterable: every SQLSTATE maps onto an event type, which is
									     already a filter, so a second one narrowed nothing further. -->
									<div class="mb-3.5">
										<span
											class="border border-danger/30 bg-danger/10 px-2.5 py-1 font-mono text-xs font-semibold text-danger"
											>SQLSTATE {r.stateCode}</span
										>
									</div>
								{/if}

								{#each [{ label: 'Detail', value: r.detail, mono: true }, { label: 'Hint', value: r.hint, mono: false }, { label: 'Context', value: r.context, mono: true }] as block (block.label)}
									{#if block.value}
										<div class="mb-3.5">
											<div class={panelLabel}>{block.label}</div>
											<div
												class={block.mono
													? 'font-mono text-sm leading-[1.6] break-words whitespace-pre-wrap text-ink/80'
													: 'font-sans text-md leading-[1.55] text-ink/82'}
											>
												{block.value}
											</div>
										</div>
									{/if}
								{/each}

								{#if r.statement}
									<div class="mb-3.5">
										<div class={panelLabel}>Statement</div>
										<QueryTextBlock text={r.statement} />
									</div>
								{/if}

								<div class="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line-soft pt-3 font-mono text-xs">
									<span class="text-ink/70"
										>PID
										<button
											type="button"
											onclick={(e) => pivot(e, { kind: 'search', value: String(r.pid) })}
											disabled={!r.pid}
											title="Find every event from this process"
											class={r.pid ? 'cursor-pointer text-ink hover:text-command' : 'text-ink/45'}
											>{r.pid || '—'}</button
										></span
									>
									<span class="text-ink/70"
										>Application
										{#if r.applicationName}
											<button
												type="button"
												onclick={(e) =>
													pivot(e, { kind: 'facet', field: LogFacetField.APPLICATION_NAME, value: r.applicationName })}
												title="Filter by {r.applicationName}"
												class="cursor-pointer text-ink hover:text-command">{r.applicationName}</button
											>
										{:else}
											<span class="text-ink/45">—</span>
										{/if}</span
									>
									<span class="text-ink/70"
										>Backend
										{#if r.backendType}
											<button
												type="button"
												onclick={(e) =>
													pivot(e, { kind: 'facet', field: LogFacetField.BACKEND_TYPE, value: r.backendType })}
												title="Filter by {r.backendType}"
												class="cursor-pointer text-ink hover:text-command">{r.backendType}</button
											>
										{:else}
											<span class="text-ink/45">—</span>
										{/if}</span
									>
								</div>

								{#if !hasDetail(r)}
									<div class="mt-3 font-mono text-sm text-ink/70">No additional fields recorded for this event</div>
								{/if}
							</div>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>

	{#if loading}
		<LoadingOverlay message="Loading…" offsetTop={headHeight} />
	{/if}
</div>

<style>
	/* Each pill's colour is data-driven, so it arrives as custom properties and the rules that
	   consume them live here. `style:background` plus a `hover:` utility cannot work: an inline
	   style beats any class rule, so the hover would never apply. */
	.pill {
		color: var(--pill-fg);
		background: var(--pill-bg);
		border: var(--pill-border);
	}

	.pill:hover {
		color: var(--pill-fg-hover);
		background: var(--pill-bg-hover);
		border: var(--pill-border-hover);
	}
</style>
