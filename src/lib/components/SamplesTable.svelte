<script lang="ts">
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import { ArrowUpIcon, ExternalLinkIcon } from '@lucide/svelte';
	import { SampleSortColumn, type StatementSample } from '$lib/gen/querysheriff/v1/statement_pb';
	import { fmtDuration, fmtTs, runDurationColor, sampleTags, type KeyValue } from '$lib/format';
	import { Tooltip } from 'bits-ui';
	import type { SqlTether } from '$lib/components/SqlPopover.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import SortHeader, { type Sort } from '$lib/components/SortHeader.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import TagRow from '$lib/components/TagRow.svelte';

	let {
		samples,
		sort = $bindable(),
		sql,
		statementId,
		baseTags,
		loading = false
	}: {
		samples: StatementSample[];
		sort: Sort<SampleSortColumn>;
		sql: SqlTether;
		statementId: string;
		baseTags: KeyValue[];
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	const headDef: { label: string; column?: SampleSortColumn; align: 'left' | 'right'; cls: string }[] = [
		{ label: 'At', column: SampleSortColumn.AT, align: 'left', cls: 'hidden w-[11.25rem] sm:table-cell' },
		{ label: 'Query', align: 'left', cls: '' },
		{ label: 'Plan', align: 'left', cls: 'w-[7rem]' },
		{ label: 'Duration', column: SampleSortColumn.DURATION, align: 'right', cls: 'w-[6.875rem]' }
	];
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[26.25rem] table-fixed border-collapse">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				{#each headDef as h (h.label)}
					<SortHeader label={h.label} align={h.align} class={h.cls} column={h.column} bind:sort />
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each samples as s (s.id)}
				{@const pills = sampleTags(s.tags, baseTags)}
				<tr class="hover:bg-hover-soft">
					<td
						class="hidden border-b border-line-soft px-4 py-3 align-top font-mono text-sm leading-[20px] whitespace-nowrap text-ink/75 sm:table-cell"
						>{s.occurredAt ? fmtTs(timestampDate(s.occurredAt)) : '—'}</td
					>
					<td class="min-w-0 border-b border-line-soft px-4 py-3 align-top">
						<Tooltip.Trigger
							tether={sql}
							payload={{ id: s.id }}
							type="button"
							class="inline-block max-w-full cursor-default overflow-hidden border-0 bg-transparent p-0 text-left align-top font-mono text-sm leading-[20px] text-ellipsis whitespace-nowrap text-ink transition-colors hover:text-command focus-visible:text-command focus-visible:outline-none"
							>{s.preview}</Tooltip.Trigger
						>
						{#if pills.matchesBase || pills.tags.length > 0}
							<TagRow class="mt-1">
								{#if pills.matchesBase}
									<span
										title="Carries exactly the tags shown at the top"
										class="inline-flex items-center gap-1 border border-line px-1.5 py-px font-mono text-xs whitespace-nowrap text-ink-muted"
									>
										<ArrowUpIcon class="size-2.5" />base tags
									</span>
								{/if}
								{#each pills.tags as t (t)}
									<Tag text={t} title={t} />
								{/each}
							</TagRow>
						{/if}
					</td>
					<td class="border-b border-line-soft px-4 py-3 align-top">
						{#if s.hasPlan}
							<a
								href="/queries/{statementId}/plan/{s.id}"
								target="_blank"
								rel="noopener"
								class="inline-flex items-center gap-1.5 align-top font-mono text-sm leading-[20px] font-semibold whitespace-nowrap text-command hover:underline"
							>
								<span>view plan</span>
								<ExternalLinkIcon class="size-3 stroke-[2.2]" />
							</a>
						{:else}
							<span class="font-mono text-sm leading-[20px] text-ink-muted">—</span>
						{/if}
					</td>
					<td
						class="border-b border-line-soft px-4 py-3 text-right align-top font-mono text-md leading-[20px] font-semibold whitespace-nowrap"
						style:color={runDurationColor(s.durationMs)}>{fmtDuration(s.durationMs)}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if loading}
		<LoadingOverlay offsetTop={headHeight} />
	{/if}
</div>
