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
</script>

<script lang="ts">
	import { fmtDuration, fmtClockDate } from '$lib/format';
	import { waitColor } from '$lib/activity';
	import { LockWaitSortColumn } from '$lib/gen/querysheriff/v1/activity_pb';
	import type { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import SortHeader, { type Sort } from '$lib/components/SortHeader.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import TagRow from '$lib/components/TagRow.svelte';

	let {
		rows,
		sort = $bindable(),
		sql,
		loading = false
	}: {
		rows: LockWaitRow[];
		sort: Sort<LockWaitSortColumn>;
		sql: SqlPopoverState;
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	const headDef: { label: string; column?: LockWaitSortColumn; align: 'left' | 'right'; cls: string }[] = [
		{ label: 'Started', column: LockWaitSortColumn.STARTED, align: 'left', cls: 'hidden w-[9rem] sm:table-cell' },
		{ label: 'Waited', column: LockWaitSortColumn.WAITED, align: 'right', cls: 'w-[6.5rem]' },
		{ label: 'Waiting query', align: 'left', cls: '' },
		{ label: 'Blocking query', align: 'left', cls: '' },
		{ label: 'Lock', align: 'left', cls: 'hidden w-[10.5rem] lg:table-cell' }
	];

	const cell = 'border-b border-line-soft px-4 py-3 align-top';
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
					<SortHeader label={h.label} align={h.align} class={h.cls} column={h.column} bind:sort />
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
						style:color={waitColor(r.waitMs)}>{fmtDuration(r.waitMs)}</td
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
		<LoadingOverlay offsetTop={headHeight} />
	{/if}
</div>
