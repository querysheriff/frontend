<script lang="ts">
	import { StatementSortColumn, type StatementStat } from '$lib/gen/querysheriff/v1/statement_pb';
	import { avgDurationColor, fmtCount, fmtDuration, kvTags } from '$lib/format';
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
		rows: StatementStat[];
		sort: Sort<StatementSortColumn>;
		sql: SqlPopoverState;
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	const headDef: { label: string; column?: StatementSortColumn; align: 'left' | 'right'; cls: string }[] = [
		{ label: 'Query', align: 'left', cls: '' },
		{ label: 'User', align: 'left', cls: 'hidden w-[7.5rem] sm:table-cell' },
		{ label: 'Avg', column: StatementSortColumn.AVG, align: 'right', cls: 'w-[5.625rem]' },
		{ label: 'Calls', column: StatementSortColumn.CALLS, align: 'right', cls: 'w-[5.625rem]' },
		{
			label: 'Rows/Call',
			column: StatementSortColumn.ROWS_PER_CALL,
			align: 'right',
			cls: 'hidden w-[6.75rem] lg:table-cell'
		},
		{ label: '% IO', column: StatementSortColumn.PCT_IO, align: 'right', cls: 'hidden w-[4.875rem] lg:table-cell' },
		{ label: '% Time', column: StatementSortColumn.PCT_TIME, align: 'right', cls: 'hidden w-[5.25rem] lg:table-cell' }
	];

	const rowsPerCall = (q: StatementStat): number => (q.calls > 0n ? Number(q.rows) / Number(q.calls) : 0);

	const numCell =
		'px-4 py-3 border-b border-line-soft text-right align-top leading-[20px] font-mono text-md text-ink whitespace-nowrap';
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[30rem] table-fixed border-collapse font-sans">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.label)}
					<SortHeader label={h.label} align={h.align} class={h.cls} column={h.column} bind:sort />
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as q (q.id)}
				{@const tags = kvTags(q.tags)}
				<tr class="group relative transition-colors hover:bg-hover">
					<td class="border-b border-line-soft px-4 py-3 align-top">
						<div class="min-w-0">
							<a
								href="/queries/{q.id}"
								onfocus={(e) => e.currentTarget.matches(':focus-visible') && sql.showLazy(q.id, e)}
								onblur={sql.hide}
								class="group/link inline-block max-w-full align-top after:absolute after:inset-0 focus-visible:outline-none"
							>
								<code
									onmouseenter={(e) => sql.showLazy(q.id, e)}
									onmouseleave={sql.hide}
									class="relative z-[1] inline-block max-w-full overflow-hidden align-top font-mono text-sm leading-[20px] text-ellipsis whitespace-nowrap text-ink transition-colors hover:text-command group-focus-visible/link:text-command"
									>{q.preview}</code
								>
							</a>
							{#if tags.length > 0}
								<TagRow class="mt-1">
									{#each tags as t (t)}
										<Tag text={t} />
									{/each}
								</TagRow>
							{/if}
						</div>
					</td>
					<td
						class="hidden border-b border-line-soft px-4 py-3 align-top font-mono text-md leading-[20px] text-ink sm:table-cell"
					>
						<a
							href="/queries/{q.id}"
							title={q.userName}
							tabindex="-1"
							class="relative z-[1] block truncate focus-visible:outline-none">{q.userName}</a
						>
					</td>
					<td
						class="border-b border-line-soft px-4 py-3 text-right align-top leading-[20px] font-mono text-md font-semibold whitespace-nowrap"
						style:color={avgDurationColor(q.avgMs)}
					>
						{fmtDuration(q.avgMs)}
					</td>
					<td class={numCell}>{fmtCount(Number(q.calls))}</td>
					<td class="{numCell} hidden lg:table-cell">{fmtCount(rowsPerCall(q))}</td>
					<td class="{numCell} hidden lg:table-cell">{q.pctIo.toFixed(1)}%</td>
					<td class="{numCell} hidden lg:table-cell">{q.pctTime.toFixed(1)}%</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if loading}
		<LoadingOverlay offsetTop={headHeight} />
	{/if}
</div>
