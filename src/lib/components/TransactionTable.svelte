<script module lang="ts">
	import type { TransactionEvent } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/activity_pb';
	import type { Timestamp } from '@bufbuild/protobuf/wkt';

	export type TransactionRow = {
		key: string;
		pid: number;
		app: string;
		openMs: number;
		start: Date | null;
		/** Anchor for the timeline's relative offsets. */
		startTs?: Timestamp;
		events: TransactionEvent[];
	};

	export type TransactionSortCol = 'started' | 'open';
</script>

<script lang="ts">
	import { clsx } from 'clsx';
	import { ChevronDownIcon, ChevronRightIcon } from '@lucide/svelte';
	import { fmtDuration, fmtClockDate, kvTags } from '$lib/format';
	import {
		durationMs,
		groupEvents,
		relFrom,
		statusLabel,
		statusText,
		transactionAgeText,
		tsKey,
		waitText
	} from '$lib/activity';
	import type { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import SortHeader from '$lib/components/SortHeader.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import TagRow from '$lib/components/TagRow.svelte';

	let {
		rows,
		sort = $bindable(),
		sql,
		loading = false
	}: {
		rows: TransactionRow[];
		sort: { col: TransactionSortCol; dir: 'asc' | 'desc' };
		sql: SqlPopoverState;
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);
	let expanded = $state<Record<string, boolean>>({});

	function toggle(r: TransactionRow) {
		expanded[r.key] = !expanded[r.key];
	}

	function onRowKey(e: KeyboardEvent, r: TransactionRow) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle(r);
		}
	}

	// Reads as the debugging question: when did it start, how long did it stay
	// open, then which session to go and look at. `pad` clears the chevron gutter
	// on the first column.
	const headDef: {
		key?: TransactionSortCol;
		label: string;
		align: 'left' | 'right';
		cls: string;
		pad?: string;
	}[] = [
		{ key: 'started', label: 'Started', align: 'left', cls: 'w-[13rem]', pad: 'pl-9 pr-4' },
		{ key: 'open', label: 'Open', align: 'right', cls: 'w-[7rem]' },
		{ label: 'PID', align: 'left', cls: 'hidden w-[8rem] sm:table-cell' },
		{ label: 'Application', align: 'left', cls: '' }
	];

	const cell = 'border-b border-line-soft px-4 py-3 align-top';

	// Fixed tracks, not minmax: every stretch in every group must line up in one
	// grid, otherwise each statement's block sizes its own columns independently.
	// Baseline-aligned, not top-aligned: the status is condensed 13px while the rest
	// is mono 14px, and two fonts at two sizes only line up on a shared baseline.
	const timelineGrid = 'grid grid-cols-[6rem_4.5rem_5rem_minmax(0,1fr)] items-baseline gap-x-3 py-1.5';

	function sortBy(key: TransactionSortCol) {
		if (sort.col === key) sort = { col: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
		else sort = { col: key, dir: 'desc' };
	}
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[44rem] table-fixed border-collapse font-sans">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.label)}
					{@const key = h.key}
					<SortHeader
						label={h.label}
						align={h.align}
						class={h.cls}
						pad={h.pad}
						dir={key && sort.col === key ? sort.dir : null}
						onsort={key ? () => sortBy(key) : undefined}
					/>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.key)}
				{@const open = expanded[r.key] ?? false}
				<tr
					onclick={() => toggle(r)}
					onkeydown={(e) => onRowKey(e, r)}
					role="button"
					tabindex="0"
					aria-expanded={open}
					class={clsx(
						'cursor-pointer transition-colors',
						// An open row is tinted and loses its bottom rule, so it reads as one piece
						// with the panel it opened rather than a stray row. The tint is a neutral ink
						// one, not the terracotta accent: an expanded row is selected, not in trouble,
						// and a red wash reads as "something is wrong here". Twice the weight of the
						// hover tint, so open still stands out from hovered.
						open ? 'bg-hover-strong [&>td]:border-b-transparent' : 'hover:bg-hover'
					)}
				>
					<!-- The chevron sits in the gutter rather than in the flow, so the date
					     starts exactly under the STARTED label. -->
					<!-- The cell carries the date's own type metrics: inheriting the 16px base
					     size would build a taller line-box strut and push the text below the
					     absolutely-positioned chevron. -->
					<td class="{cell} relative pl-9 text-sm leading-[20px]">
						<!-- Boxed to the same 20px line height as the date and centred inside it,
						     so the two share a midline whatever the icon size. -->
						<span class="absolute top-3 left-3.5 flex h-5 items-center">
							{#if open}<ChevronDownIcon class="size-3.5 text-command" />{:else}<ChevronRightIcon
									class="size-3.5 text-command"
								/>{/if}
						</span>
						<span class="font-mono text-sm leading-[20px] whitespace-nowrap text-ink/70"
							>{r.start ? fmtClockDate(r.start) : '—'}</span
						>
					</td>
					<td
						class="{cell} text-right font-mono text-md leading-[20px] font-semibold whitespace-nowrap"
						style:color={transactionAgeText(r.openMs)}>{fmtDuration(r.openMs)}</td
					>

					<td class="{cell} hidden font-mono text-md leading-[20px] whitespace-nowrap text-ink sm:table-cell"
						>{r.pid}</td
					>
					<td class={cell}>
						<div title={r.app} class="truncate text-sm leading-[20px] text-ink">{r.app || '—'}</div>
					</td>
				</tr>

				{#if open}
					<tr>
						<td colspan={headDef.length} class="border-b border-line p-0">
							<!-- Every sampled stretch, in order: the statements the transaction ran
							     and what it was doing between them. -->
							<div class="border-l-2 border-line-bold bg-hover-soft px-5 py-4 md:pl-12">
								{#each groupEvents(r.events) as g (g.key)}
									<div class="mt-5 first:mt-0">
										<div class="leading-[18px]">
											{#if g.query}
												<button
													type="button"
													onmouseenter={(e) => sql.show(g.query, e, { pid: r.pid, app: r.app })}
													onmouseleave={sql.hide}
													onfocus={(e) => sql.show(g.query, e, { pid: r.pid, app: r.app })}
													onblur={sql.hide}
													class="inline-block max-w-full cursor-default truncate border-0 bg-transparent p-0 text-left align-top font-mono text-sm text-ink transition-colors hover:text-command focus-visible:text-command focus-visible:outline-none"
													>{g.query}</button
												>
											{:else}
												<span class="font-mono text-sm text-ink/55">—</span>
											{/if}
											{#if Object.keys(g.queryTags).length > 0}
												<TagRow class="mt-1.5">
													{#each kvTags(g.queryTags) as qtag (qtag)}
														<Tag text={qtag} title={qtag} />
													{/each}
												</TagRow>
											{/if}
										</div>

										<div class="mt-2 border-l border-line-strong pl-3.5">
											{#each g.events as e (tsKey(e.from))}
												<div class={timelineGrid}>
													<span class="font-mono text-sm leading-[18px] whitespace-nowrap text-ink/70">
														{#if r.startTs && e.from && e.to}{relFrom(r.startTs, e.from)}–{relFrom(
																r.startTs,
																e.to
															)}{/if}
													</span>
													<span class="text-right font-mono text-sm leading-[18px] whitespace-nowrap text-ink/70">
														{fmtDuration(durationMs(e.from, e.to))}
													</span>
													<span
														class="font-condensed text-xs leading-[18px] font-bold tracking-[0.5px] whitespace-nowrap uppercase"
														style:color={statusText(e.status)}>{statusLabel(e.status)}</span
													>
													<span class="truncate font-mono text-sm leading-[18px] text-ink/70">{waitText(e)}</span>
												</div>
											{/each}
										</div>
									</div>
								{/each}
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
