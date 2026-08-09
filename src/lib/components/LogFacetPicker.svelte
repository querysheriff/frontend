<script lang="ts">
	import { untrack } from 'svelte';
	import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@lucide/svelte';
	import { LogFacetField, type LogFacet } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';
	import { fmtCount } from '$lib/format';
	import { PICKABLE_FACETS, facetTruncated, facetValueLabel, facetValues } from '$lib/logs';
	import type { LogFilterState } from '$lib/logFilter.svelte';

	let {
		filters,
		facets,
		loading,
		initialField,
		onapply,
		onclose
	}: {
		filters: LogFilterState;
		facets: LogFacet[] | undefined;
		loading: boolean;
		initialField?: LogFacetField;
		onapply: (field: LogFacetField, values: string[]) => void;
		onclose: () => void;
	} = $props();

	// Seeded once so a facet refresh mid-edit cannot discard a pending selection.
	const seed = untrack(() => ({
		field: initialField ?? null,
		picked: initialField ? filters.valuesFor(initialField) : []
	}));

	let field = $state<LogFacetField | null>(seed.field);
	let picked = $state<string[]>(seed.picked);
	let search = $state('');
	let highlight = $state(0);
	let searchInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		searchInput?.focus();
	});

	// Every field's values arrive in the one facet response, so drilling in costs no round trip.
	const fields = $derived(
		PICKABLE_FACETS.map((meta) => ({
			...meta,
			present: facetValues(facets, meta.field).length
		}))
	);

	const values = $derived.by(() => {
		const active = field;
		if (active === null) return [];

		return facetValues(facets, active).map((v) => ({
			value: v.value,
			label: facetValueLabel(active, v.value),
			count: Number(v.count)
		}));
	});

	const term = $derived(search.trim().toLowerCase());
	const visible = $derived(values.filter((v) => v.label.toLowerCase().includes(term)));
	const truncated = $derived(field !== null && facetTruncated(facets, field));

	function selectField(next: LogFacetField) {
		field = next;
		picked = filters.valuesFor(next);
		search = '';
		highlight = 0;
	}

	function back() {
		field = null;
		picked = [];
		search = '';
		highlight = 0;
	}

	function toggle(value: string) {
		picked = picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value];
	}

	function apply() {
		if (field !== null) onapply(field, picked);
	}

	function activate() {
		if (field === null) {
			const next = fields[highlight];
			if (next && next.present > 0) selectField(next.field);

			return;
		}

		const value = visible[highlight];
		if (value) toggle(value.value);
	}

	function onkeydown(e: KeyboardEvent) {
		const max = (field === null ? fields.length : visible.length) - 1;

		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = Math.min(highlight + 1, Math.max(max, 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = Math.max(highlight - 1, 0);
		} else if (e.key === 'ArrowLeft' && field !== null && search === '') {
			e.preventDefault();
			back();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (e.metaKey && field !== null) apply();
			else activate();
		}
	}

	const rowCls = 'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left font-sans text-sm text-ink';
	const boxCls = 'flex size-3.5 flex-none items-center justify-center border border-line-bold';
	const countCls = 'font-mono text-xs text-ink/70';
</script>

<svelte:document
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
/>

<div
	role="presentation"
	{onkeydown}
	class="absolute top-[calc(100%+6px)] left-0 z-[3] w-[min(21rem,calc(100vw-2rem))] border border-line-strong bg-card shadow-popover"
>
	{#if field === null}
		<div
			class="border-b border-line px-3.5 py-2 font-condensed text-2xs font-semibold tracking-[1px] text-ink/70 uppercase"
		>
			Filter by
		</div>
		<div class="max-h-[18rem] overflow-y-auto p-1.5" role="listbox" aria-label="Filter fields" tabindex="-1">
			{#each fields as meta, i (meta.field)}
				<button
					type="button"
					role="option"
					aria-selected={i === highlight}
					disabled={meta.present === 0}
					onclick={() => selectField(meta.field)}
					onmouseenter={() => (highlight = i)}
					class="{rowCls} {i === highlight ? 'bg-hover' : ''} {meta.present === 0
						? 'cursor-not-allowed opacity-45'
						: ''}"
				>
					<span class="flex-1">{meta.label}</span>
					<span class={countCls}>{meta.present}</span>
					<ChevronRightIcon class="size-3.5 flex-none text-ink/40" />
				</button>
			{:else}
				<div class="px-2.5 py-2.5 font-sans text-sm text-ink/70">
					{loading ? 'Loading…' : 'No values in this window'}
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex items-center gap-2 border-b border-line px-2 py-2">
			<button
				type="button"
				onclick={back}
				aria-label="Back to filter fields"
				class="cursor-pointer p-1 text-ink/55 hover:text-ink"
			>
				<ChevronLeftIcon class="size-3.5" />
			</button>
			<span class="flex-1 font-sans text-sm font-semibold text-ink">
				{PICKABLE_FACETS.find((f) => f.field === field)?.label}
			</span>
		</div>

		<div class="flex items-center gap-2 border-b border-line px-2.5 py-2">
			<SearchIcon class="size-3.5 flex-none text-ink/55" />
			<input
				bind:this={searchInput}
				bind:value={search}
				oninput={() => (highlight = 0)}
				type="text"
				placeholder="Find a value…"
				spellcheck="false"
				aria-label="Find a value"
				class="w-full border-none bg-transparent font-sans text-sm text-ink outline-none"
			/>
		</div>

		<div class="max-h-[15rem] overflow-y-auto p-1.5" role="listbox" aria-label="Filter values" tabindex="-1">
			{#each visible as value, i (value.value)}
				<button
					type="button"
					role="option"
					aria-selected={picked.includes(value.value)}
					onclick={() => toggle(value.value)}
					onmouseenter={() => (highlight = i)}
					class="{rowCls} {i === highlight ? 'bg-hover' : ''}"
				>
					<span class={boxCls}>
						{#if picked.includes(value.value)}<CheckIcon class="size-3 text-command" />{/if}
					</span>
					<span class="min-w-0 flex-1 truncate {value.value === '' ? 'text-ink/70 italic' : ''}">{value.label}</span>
					<span class={countCls}>{fmtCount(value.count)}</span>
				</button>
			{:else}
				<div class="px-2.5 py-2.5 font-sans text-sm text-ink/70">
					{loading ? 'Loading…' : 'No matching values'}
				</div>
			{/each}
		</div>

		{#if truncated}
			<div class="border-t border-line px-3 py-1.5 font-sans text-xs text-ink/70">
				Showing the most frequent values only — use search to narrow further
			</div>
		{/if}

		<div class="border-t border-line p-2">
			<button
				type="button"
				onclick={apply}
				class="w-full cursor-pointer bg-command py-2 text-center font-condensed text-md font-semibold tracking-[0.6px] text-paper uppercase hover:bg-danger"
			>
				{picked.length > 0 ? `Apply ${picked.length} value${picked.length === 1 ? '' : 's'}` : 'Clear this filter'}
			</button>
		</div>
	{/if}
</div>
