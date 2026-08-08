<script module lang="ts">
	export type LockPartyRow = {
		pid: number;
		app: string;
		query: string;
		tags: string[];
	};

	export type LockWaitRow = {
		key: string;
		waiting: LockPartyRow;
		blocking: LockPartyRow;
		lockMode: string;
		waitMs: number;
		startedWaiting: Date | null;
	};

	export type LockWaitSortCol = 'waited' | 'started';
</script>

<script lang="ts">
	import { fmtDuration, fmtClockDate } from '$lib/format';
	import { waitSeverityText } from '$lib/activity';
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
		rows: LockWaitRow[];
		sort: { col: LockWaitSortCol; dir: 'asc' | 'desc' };
		sql: SqlPopoverState;
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	// The two query columns carry no `key`: a lock wait is found by how long it
	// lasted or when it happened, never by the alphabetical order of its SQL.
	// When, then how bad, then the two statements side by side so the stuck one and
	// its cause can be read against each other. Lock is a detail, so it comes last.
	const headDef: { key?: LockWaitSortCol; label: string; align: 'left' | 'right'; cls: string }[] = [
		{ key: 'started', label: 'Started', align: 'left', cls: 'hidden w-[9rem] sm:table-cell' },
		{ key: 'waited', label: 'Waited', align: 'right', cls: 'w-[6.5rem]' },
		{ label: 'Waiting query', align: 'left', cls: '' },
		{ label: 'Blocking query', align: 'left', cls: '' },
		{ label: 'Lock', align: 'left', cls: 'hidden w-[10.5rem] lg:table-cell' }
	];

	const cell = 'border-b border-line-soft px-4 py-3 align-top';

	function sortBy(key: LockWaitSortCol) {
		if (sort.col === key) sort = { col: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
		else sort = { col: key, dir: 'desc' };
	}
</script>

{#snippet queryCell(party: LockPartyRow)}
	<td class={cell}>
		<div class="min-w-0">
			{#if party.query}
				<button
					type="button"
					onmouseenter={(e) => sql.show(party.query, e, { pid: party.pid, app: party.app })}
					onmouseleave={sql.hide}
					onfocus={(e) => sql.show(party.query, e, { pid: party.pid, app: party.app })}
					onblur={sql.hide}
					class="block w-full cursor-default truncate border-0 bg-transparent p-0 text-left font-mono text-sm leading-[20px] text-ink transition-colors hover:text-command focus-visible:text-command focus-visible:outline-none"
					>{party.query}</button
				>
			{:else}
				<span
					title="This session was never sampled — autovacuum and other non-client backends are not collected"
					class="font-mono text-sm leading-[20px] text-ink/55">not captured</span
				>
			{/if}
			{#if party.tags.length > 0}
				<TagRow class="mt-1">
					{#each party.tags as t (t)}
						<Tag text={t} title={t} />
					{/each}
				</TagRow>
			{/if}
		</div>
	</td>
{/snippet}

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[46rem] table-fixed border-collapse font-sans">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.label)}
					{@const key = h.key}
					<SortHeader
						label={h.label}
						align={h.align}
						class={h.cls}
						dir={key && sort.col === key ? sort.dir : null}
						onsort={key ? () => sortBy(key) : undefined}
					/>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.key)}
				<tr class="transition-colors hover:bg-hover">
					<td class="{cell} hidden font-mono text-sm leading-[20px] whitespace-nowrap text-ink/70 sm:table-cell"
						>{r.startedWaiting ? fmtClockDate(r.startedWaiting) : '—'}</td
					>
					<td
						class="{cell} text-right font-mono text-md leading-[20px] font-semibold whitespace-nowrap"
						style:color={waitSeverityText(r.waitMs)}>{fmtDuration(r.waitMs)}</td
					>
					{@render queryCell(r.waiting)}
					{@render queryCell(r.blocking)}
					<td class="{cell} hidden font-mono text-sm leading-[20px] text-ink lg:table-cell">
						<span class="block truncate" title={r.lockMode}>{r.lockMode || '—'}</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if loading}
		<LoadingOverlay message="Loading…" offsetTop={headHeight} />
	{/if}
</div>
