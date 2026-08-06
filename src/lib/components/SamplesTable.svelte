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
</script>

<script lang="ts">
	import { ArrowUpIcon, ExternalLinkIcon } from '@lucide/svelte';
	import { sevText } from '$lib/format';
	import type { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import Tag from '$lib/components/Tag.svelte';

	let {
		samples,
		sql,
		id,
		hasBaseTags,
		extraTags,
		loading = false
	}: {
		samples: SampleRow[];
		sql: SqlPopoverState;
		id: string;
		hasBaseTags: boolean;
		extraTags: (tags: Record<string, string>) => string[];
		loading?: boolean;
	} = $props();

	let headHeight = $state(0);

	const thBase =
		'border-b border-line px-4 py-2.5 font-condensed text-xs font-semibold tracking-[0.7px] text-ink/70 uppercase';
</script>

<div class="relative overflow-x-auto">
	<table class="w-full min-w-[26.25rem] table-fixed border-collapse">
		<thead bind:clientHeight={headHeight}>
			<tr class="bg-hover-soft">
				<th scope="col" class="{thBase} hidden w-[11.25rem] text-left sm:table-cell">At</th>
				<th scope="col" class="{thBase} text-left">Query</th>
				<th scope="col" class="{thBase} w-[7rem] text-left">Plan</th>
				<th scope="col" class="{thBase} w-[6.875rem] text-right">Duration</th>
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
