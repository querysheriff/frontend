<script lang="ts">
	import { clsx } from 'clsx';
	import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from '@lucide/svelte';
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import type { LogRecord } from '$lib/gen/querysheriff/v1/log_pb';
	import { fmtDuration, fmtTs, runDurationColor, truncate } from '$lib/format';
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
		sortDesc = $bindable(),
		loading = false
	}: {
		records: LogRecord[];
		sortDesc: boolean;
		loading?: boolean;
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

	const tsFmt = (r: LogRecord): string => (r.occurredAt ? fmtTs(timestampDate(r.occurredAt)) : '—');

	// Twice the widest column: CSS still cuts what shows, but no row carries kilobytes of hidden text.
	const PREVIEW_CHARS = 200;

	const messageOf = (r: LogRecord): string => (messageIsSampleText(r.classification) ? '' : r.message);

	function preview(r: LogRecord): string {
		const message = messageOf(r);
		if (message) return truncate(message, PREVIEW_CHARS);

		const sample = r.statementSample;
		if (!sample) return '';

		return `${fmtDuration(sample.durationMs)} · ${truncate(sample.query, PREVIEW_CHARS)}`;
	}

	// Each badge column is as wide as its longest value; the table is table-fixed, so the Event column
	// takes whatever width is left.
	const headDef: { label: string; cls: string }[] = [
		// "Severity" to the user, `level` internally: the wire says level, Postgres says severity.
		{ label: 'Severity', cls: 'w-[7rem]' },
		{ label: 'Event', cls: '' },
		{ label: 'Category', cls: 'hidden w-[12.25rem] lg:table-cell' },
		{ label: 'Database', cls: 'hidden w-[8.5rem] sm:table-cell' },
		{ label: 'User', cls: 'hidden w-[8.5rem] lg:table-cell' }
	];

	const cell = 'border-b border-line-soft px-4 py-3 align-top leading-[20px]';
	const badgeCls = 'inline-flex h-5 max-w-full translate-y-px items-center align-top leading-none';
	const panelLabel = 'mb-1 font-sans text-2xs font-semibold text-ink/70';

	const hasDetail = (r: LogRecord): boolean =>
		!!(messageOf(r) || r.statementSample || r.stateCode || r.detail || r.hint || r.context || r.statement);
</script>

{#snippet plainValue(value: string)}
	{#if value}
		<span title={value} class="inline-block max-w-full truncate align-top text-sm text-ink/75">{value}</span>
	{:else}
		<span class="text-sm text-ink/45">—</span>
	{/if}
{/snippet}

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[34rem] table-fixed border-collapse font-sans">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				<SortHeader
					label="At"
					class="w-[11.75rem]"
					pad="pl-9 pr-4"
					column="at"
					bind:sort={() => ({ column: 'at', desc: sortDesc }), (next) => (sortDesc = next.desc)}
				/>
				{#each headDef as col (col.label)}
					<SortHeader label={col.label} class={col.cls} />
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
						open ? 'bg-hover-strong [&>td]:border-b-transparent' : 'hover:bg-hover'
					)}
				>
					<td class="{cell} relative pr-4 pl-9">
						<span class="absolute top-3 left-3.5 flex h-5 items-center">
							{#if open}
								<ChevronDownIcon class="size-3.5 flex-none text-command" />
							{:else}
								<ChevronRightIcon class="size-3.5 flex-none text-command" />
							{/if}
						</span>
						<span class="inline-block align-top font-mono text-sm whitespace-nowrap text-ink/80">{tsFmt(r)}</span>
					</td>

					<td class={cell}>
						<span
							class="{badgeCls} px-2 font-sans text-2xs font-bold whitespace-nowrap"
							style:color={lb.color}
							style:background={lb.background}
							style:border={lb.border}>{levelLabel(r.logLevel)}</span
						>
					</td>

					<td class="{cell} overflow-hidden">
						<span
							title={classificationCode(r.classification) || undefined}
							class="inline-block max-w-full truncate align-top text-sm text-ink"
							>{classificationLabel(r.classification)}</span
						>
						{#if summary}
							<span class="mt-0.5 block truncate font-mono text-xs leading-[18px] text-ink/70">{summary}</span>
						{/if}
					</td>

					<td class="{cell} hidden overflow-hidden lg:table-cell">
						<span
							class="{badgeCls} truncate px-2 font-sans text-2xs font-semibold"
							style:color={cb.color}
							style:background={cb.background}
							style:border={cb.border}>{categoryLabel(r.category)}</span
						>
					</td>

					<td class="{cell} hidden overflow-hidden sm:table-cell">
						{@render plainValue(r.databaseName)}
					</td>

					<td class="{cell} hidden overflow-hidden lg:table-cell">
						{@render plainValue(r.username)}
					</td>
				</tr>

				{#if open}
					<tr>
						<td colspan={headDef.length + 1} class="border-b border-line p-0">
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
									<div class="mb-3.5">
										<div class={panelLabel}>Sampled statement</div>
										<div class="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
											<span class="font-mono text-md font-semibold" style:color={runDurationColor(sample.durationMs)}
												>{fmtDuration(sample.durationMs)}</span
											>
											{#if sample.statementId}
												<a
													href="/queries/{sample.statementId}"
													class="font-sans text-xs font-semibold text-command hover:underline">Open query</a
												>
												{#if sample.hasPlan}
													<a
														href="/queries/{sample.statementId}/plan/{sample.id}"
														target="_blank"
														rel="noopener"
														class="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-command hover:underline"
														>View plan<ExternalLinkIcon class="size-3 stroke-[2.2]" /></a
													>
												{/if}
											{:else}
												<span class="font-sans text-xs text-ink/70">
													Not matched to a known query — enable
													<code class="font-mono">compute_query_id</code> to link these
												</span>
											{/if}
										</div>
									</div>
								{/if}

								{#if r.stateCode}
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
									{#each [{ label: 'PID', value: r.pid ? String(r.pid) : '' }, { label: 'Application', value: r.applicationName }, { label: 'Backend', value: r.backendType }] as field (field.label)}
										<span class="text-ink/70"
											>{field.label}
											<span class={field.value ? 'text-ink' : 'text-ink/45'}>{field.value || '—'}</span></span
										>
									{/each}
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
		<LoadingOverlay offsetTop={headHeight} />
	{/if}
</div>
