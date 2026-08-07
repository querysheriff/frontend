<script module lang="ts">
	export type SampleRow = {
		id: string;
		ts: string;
		short: string;
		tags: Record<string, string>;
		hasPlan: boolean;
		durFmt: string;
		sev: string;
	};

	export type SampleSortCol = 'at' | 'plan' | 'dur';
</script>

<script lang="ts">
	import { clsx } from 'clsx';
	import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon, ExternalLinkIcon } from '@lucide/svelte';
	import { sevText } from '$lib/format';
	import type { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import Tag from '$lib/components/Tag.svelte';

	let {
		samples,
		sort = $bindable(),
		sql,
		id,
		hasBaseTags,
		extraTags,
		loading = false
	}: {
		samples: SampleRow[];
		sort: { col: SampleSortCol; dir: 'asc' | 'desc' };
		sql: SqlPopoverState;
		id: string;
		hasBaseTags: boolean;
		extraTags: (tags: Record<string, string>) => string[];
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	// Query has no `key`: every row here is the same query shape, so ordering by
	// the concretized text sorts by whichever literals happened to be captured.
	const headDef: {
		key?: SampleSortCol;
		label: string;
		align: 'left' | 'right';
		cls: string;
	}[] = [
		{ key: 'at', label: 'At', align: 'left', cls: 'hidden w-[11.25rem] sm:table-cell' },
		{ label: 'Query', align: 'left', cls: '' },
		{ key: 'plan', label: 'Plan', align: 'left', cls: 'w-[7rem]' },
		{ key: 'dur', label: 'Duration', align: 'right', cls: 'w-[6.875rem]' }
	];

	const thBase = 'border-b border-line font-condensed text-xs font-semibold tracking-[0.7px] text-ink/70 uppercase';

	// Every sortable column here is temporal or numeric, so a fresh column always
	// opens on its most useful end: newest, has-a-plan, slowest.
	function sortBy(key: SampleSortCol) {
		if (sort.col === key) sort = { col: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
		else sort = { col: key, dir: 'desc' };
	}
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[26.25rem] table-fixed border-collapse">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.label)}
					{@const pad = clsx('block px-4 py-2.5', h.align === 'right' ? 'text-right' : 'text-left')}
					<th
						scope="col"
						aria-sort={h.key && sort.col === h.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
						class={clsx(thBase, h.cls)}
					>
						{#if h.key}
							{@const key = h.key}
							<button
								type="button"
								onclick={() => sortBy(key)}
								class="{pad} group/sort w-full cursor-pointer uppercase select-none focus-visible:text-command"
							>
								<span class="relative inline-flex items-center align-middle">
									<span>{h.label}</span>
									<span
										class={clsx(
											'pointer-events-none absolute inset-y-0 flex items-center',
											h.align === 'right' ? 'right-full pr-1' : 'left-full pl-1'
										)}
									>
										{#if sort.col === h.key}
											{#if sort.dir === 'asc'}
												<ArrowUpIcon class="size-3 flex-none text-command" />
											{:else}
												<ArrowDownIcon class="size-3 flex-none text-command" />
											{/if}
										{:else}
											<ArrowUpDownIcon
												class="size-3 flex-none text-ink/35 opacity-0 transition-opacity group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
											/>
										{/if}
									</span>
								</span>
							</button>
						{:else}
							<!-- Padding matches the sortable buttons' so all four labels share a baseline. -->
							<span class={pad}>{h.label}</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each samples as s (s.id)}
				{@const extra = extraTags(s.tags)}
				<tr class="hover:bg-hover-soft">
					<td
						class="hidden border-b border-line-soft px-4 py-3 align-top font-mono text-sm leading-[20px] whitespace-nowrap text-ink/75 sm:table-cell"
						>{s.ts}</td
					>
					<td class="min-w-0 border-b border-line-soft px-4 py-3 align-top">
						<button
							type="button"
							onmouseenter={(e) => sql.showLazy(BigInt(s.id), e)}
							onmouseleave={sql.hide}
							onfocus={(e) => sql.showLazy(BigInt(s.id), e)}
							onblur={sql.hide}
							class="inline-block max-w-full cursor-default overflow-hidden border-0 bg-transparent p-0 text-left align-top font-mono text-sm leading-[20px] text-ellipsis whitespace-nowrap text-ink transition-colors hover:text-command focus-visible:text-command focus-visible:outline-none"
							>{s.short}</button
						>
						{#if hasBaseTags || extra.length > 0}
							<div class="mt-1 flex flex-wrap items-center gap-1.5">
								{#if hasBaseTags}
									<span
										title="Also carries the base tags shown at the top"
										class="inline-flex items-center gap-1 border border-line px-1.5 py-px font-mono text-xs text-ink/70"
									>
										<ArrowUpIcon class="size-2.5" />base tags
									</span>
								{/if}
								{#each extra as t (t)}
									<Tag text={t} />
								{/each}
							</div>
						{/if}
					</td>
					<td class="border-b border-line-soft px-4 py-3 align-top">
						{#if s.hasPlan}
							<a
								href="/queries/{id}/plan/{s.id}"
								target="_blank"
								rel="noopener"
								class="inline-flex items-center gap-1.5 align-top font-mono text-sm leading-[20px] font-semibold whitespace-nowrap text-command hover:underline"
							>
								<span>view plan</span>
								<ExternalLinkIcon class="size-3 stroke-[2.2]" />
							</a>
						{:else}
							<span class="font-mono text-sm leading-[20px] text-ink/70">—</span>
						{/if}
					</td>
					<td
						class="border-b border-line-soft px-4 py-3 text-right align-top font-mono text-md leading-[20px] font-semibold whitespace-nowrap"
						style:color={sevText(s.sev)}>{s.durFmt}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if loading}
		<LoadingOverlay message="Loading…" offsetTop={headHeight} />
	{/if}
</div>
