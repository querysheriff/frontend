<script module lang="ts">
	export type StatementRow = {
		id: string;
		query: string;
		usr: string;
		meanMs: number;
		calls: number;
		rowsPerCall: number;
		pctIo: number;
		pctTime: number;
		sev: string;
		tags: string[];
	};

	export type StatementSortCol = 'query' | 'usr' | 'meanMs' | 'calls' | 'rowsPerCall' | 'pctIo' | 'pctTime';
</script>

<script lang="ts">
	import { fmtDuration, fmtCount, sevText } from '$lib/format';
	import type { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import SortHeader from '$lib/components/SortHeader.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import TagRow from '$lib/components/TagRow.svelte';

	let {
		rows,
		sort = $bindable(),
		sql,
		href,
		onFilterTag,
		loading = false
	}: {
		rows: StatementRow[];
		sort: { col: StatementSortCol; dir: 'asc' | 'desc' };
		sql: SqlPopoverState;
		href: (id: string) => string;
		onFilterTag: (e: MouseEvent, text: string) => void;
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	const headDef: { key: StatementSortCol; label: string; align: 'left' | 'right'; cls: string }[] = [
		{ key: 'query', label: 'Query', align: 'left', cls: '' },
		{ key: 'usr', label: 'User', align: 'left', cls: 'hidden w-[7.5rem] sm:table-cell' },
		{ key: 'meanMs', label: 'Avg', align: 'right', cls: 'w-[5.625rem]' },
		{ key: 'calls', label: 'Calls', align: 'right', cls: 'w-[5.625rem]' },
		{ key: 'rowsPerCall', label: 'Rows/Call', align: 'right', cls: 'hidden w-[6.75rem] lg:table-cell' },
		{ key: 'pctIo', label: '% IO', align: 'right', cls: 'hidden w-[4.875rem] lg:table-cell' },
		{ key: 'pctTime', label: '% Time', align: 'right', cls: 'hidden w-[5.25rem] lg:table-cell' }
	];

	// Numeric/text cells never truncate — only the query text (the <code>) does.
	const numCell =
		'px-4 py-3 border-b border-line-soft text-right align-top leading-[20px] font-mono text-md text-ink whitespace-nowrap';

	function sortBy(key: StatementSortCol) {
		if (sort.col === key) sort = { col: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
		else sort = { col: key, dir: key === 'query' || key === 'usr' ? 'asc' : 'desc' };
	}
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[30rem] table-fixed border-collapse font-sans">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.key)}
					<SortHeader
						label={h.label}
						align={h.align}
						class={h.cls}
						dir={sort.col === h.key ? sort.dir : null}
						onsort={() => sortBy(h.key)}
					/>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as q (q.id)}
				<tr class="group relative transition-colors hover:bg-hover">
					<td class="border-b border-line-soft px-4 py-3 align-top">
						<div class="min-w-0">
							<a
								href={href(q.id)}
								onfocus={(e) => e.currentTarget.matches(':focus-visible') && sql.showLazy(BigInt(q.id), e)}
								onblur={sql.hide}
								class="group/link inline-block max-w-full align-top after:absolute after:inset-0 focus-visible:outline-none"
							>
								<code
									onmouseenter={(e) => sql.showLazy(BigInt(q.id), e)}
									onmouseleave={sql.hide}
									class="relative z-[1] inline-block max-w-full overflow-hidden align-top font-mono text-sm leading-[20px] text-ellipsis whitespace-nowrap text-ink transition-colors hover:text-command group-focus-visible/link:text-command"
									>{q.query}</code
								>
							</a>
							{#if q.tags.length > 0}
								<TagRow class="pointer-events-none relative z-[1] mt-1">
									{#each q.tags as t (t)}
										<Tag
											text={t}
											title="Filter by {t}"
											onclick={(e) => onFilterTag(e, t)}
											class="pointer-events-auto"
										/>
									{/each}
								</TagRow>
							{/if}
						</div>
					</td>
					<td
						class="hidden border-b border-line-soft px-4 py-3 align-top font-mono text-md leading-[20px] text-ink sm:table-cell"
					>
						<a
							href={href(q.id)}
							title={q.usr}
							tabindex="-1"
							class="relative z-[1] block truncate focus-visible:outline-none">{q.usr}</a
						>
					</td>
					<td
						class="border-b border-line-soft px-4 py-3 text-right align-top leading-[20px] font-mono text-md font-semibold whitespace-nowrap"
						style:color={sevText(q.sev)}
					>
						{fmtDuration(q.meanMs)}
					</td>
					<td class={numCell}>{fmtCount(q.calls)}</td>
					<td class="{numCell} hidden lg:table-cell">{fmtCount(q.rowsPerCall)}</td>
					<td class="{numCell} hidden lg:table-cell">{q.pctIo.toFixed(1)}%</td>
					<td class="{numCell} hidden lg:table-cell">{q.pctTime.toFixed(1)}%</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if loading}
		<LoadingOverlay message="Loading…" offsetTop={headHeight} />
	{/if}
</div>
