<script lang="ts">
	import { untrack } from 'svelte';
	import { Command } from 'bits-ui';
	import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@lucide/svelte';
	import type { LogFacet, LogFacetField } from '$lib/gen/querysheriff/v1/log_pb';
	import { containsFilter, fmtCount } from '$lib/format';
	import { PICKABLE_FACETS, facetTruncated, facetValueLabel, facetValues } from '$lib/logs';
	import type { LogFilterState } from '$lib/logFilter.svelte';

	let {
		filters,
		facets,
		loading,
		initialField,
		onapply
	}: {
		filters: LogFilterState;
		facets: LogFacet[] | undefined;
		loading: boolean;
		initialField?: LogFacetField;
		onapply: (field: LogFacetField, values: string[]) => void;
	} = $props();

	// Seeded once so a facet refresh mid-edit cannot discard a pending selection.
	const seed = untrack(() => ({
		field: initialField ?? null,
		picked: initialField ? filters.valuesFor(initialField) : []
	}));

	let field = $state<LogFacetField | null>(seed.field);
	let picked = $state<string[]>(seed.picked);
	let search = $state('');
	let fieldList = $state<HTMLElement | null>(null);

	// The field list has no search input to take focus, so the list itself does.
	$effect(() => {
		fieldList?.focus();
	});

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

	const truncated = $derived(field !== null && facetTruncated(facets, field));

	function selectField(next: LogFacetField) {
		field = next;
		picked = filters.valuesFor(next);
		search = '';
	}

	function back() {
		field = null;
		picked = [];
	}

	function toggle(value: string) {
		picked = picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value];
	}

	function apply() {
		if (field !== null) onapply(field, picked);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft' && search === '') {
			e.preventDefault();
			back();
		} else if (e.key === 'Enter' && e.metaKey) {
			e.preventDefault();
			apply();
		}
	}

	const rowCls =
		'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left font-sans text-sm text-ink data-[selected]:bg-hover';
	const boxCls = 'flex size-3.5 flex-none items-center justify-center border border-line-bold';
	const countCls = 'font-mono text-xs text-ink-muted';
	const emptyCls = 'px-2.5 py-2.5 font-sans text-sm text-ink-muted';
</script>

{#if field === null}
	<Command.Root bind:ref={fieldList} class="outline-none">
		<div class="border-b border-line px-3.5 py-2 font-sans text-2xs font-semibold text-ink-muted">Filter by</div>
		<Command.List aria-label="Filter fields" class="max-h-[18rem] overflow-y-auto p-1.5">
			<Command.Viewport>
				{#each fields as meta (meta.field)}
					<Command.Item
						value={meta.label}
						disabled={meta.present === 0}
						onSelect={() => selectField(meta.field)}
						class="{rowCls} data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45"
					>
						<span class="flex-1">{meta.label}</span>
						<span class={countCls}>{meta.present}</span>
						<ChevronRightIcon class="size-3.5 flex-none text-ink/40" />
					</Command.Item>
				{/each}
			</Command.Viewport>
		</Command.List>
	</Command.Root>
{:else}
	<Command.Root filter={containsFilter} {onkeydown}>
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
			<Command.Input
				autofocus
				bind:value={search}
				placeholder="Find a value…"
				aria-label="Find a value"
				class="w-full border-none bg-transparent font-sans text-sm text-ink outline-none"
			/>
		</div>

		<Command.List aria-label="Filter values" class="max-h-[15rem] overflow-y-auto p-1.5">
			<Command.Viewport>
				{#each values as value (value.value)}
					<Command.Item
						value={value.label}
						onSelect={() => toggle(value.value)}
						aria-checked={picked.includes(value.value)}
						class={rowCls}
					>
						<span class={boxCls}>
							{#if picked.includes(value.value)}<CheckIcon class="size-3 text-command" />{/if}
						</span>
						<span class="min-w-0 flex-1 truncate {value.value === '' ? 'text-ink-muted italic' : ''}"
							>{value.label}</span
						>
						<span class={countCls}>{fmtCount(value.count)}</span>
					</Command.Item>
				{/each}
				<Command.Empty class={emptyCls}>{loading ? 'Loading…' : 'No matching values'}</Command.Empty>
			</Command.Viewport>
		</Command.List>

		{#if truncated}
			<div class="border-t border-line px-3 py-1.5 font-sans text-xs text-ink-muted">
				Showing the most frequent values only
			</div>
		{/if}

		<div class="border-t border-line p-2">
			<button
				type="button"
				onclick={apply}
				class="w-full cursor-pointer bg-command py-2 text-center font-sans text-md font-semibold text-paper hover:bg-danger"
			>
				{picked.length > 0 ? `Apply ${picked.length} value${picked.length === 1 ? '' : 's'}` : 'Clear this filter'}
			</button>
		</div>
	</Command.Root>
{/if}
