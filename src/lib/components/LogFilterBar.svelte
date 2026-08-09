<script lang="ts">
	import { LayersIcon, SearchIcon, SlidersHorizontalIcon } from '@lucide/svelte';
	import { LogFacetField, type LogFacet } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';
	import LogChip from '$lib/components/LogChip.svelte';
	import LogCategoryPicker from '$lib/components/LogCategoryPicker.svelte';
	import LogFacetPicker from '$lib/components/LogFacetPicker.svelte';
	import type { LogFilterState } from '$lib/logFilter.svelte';

	let {
		filters,
		facets,
		loading,
		searchText = $bindable()
	}: {
		filters: LogFilterState;
		facets: LogFacet[] | undefined;
		loading: boolean;
		searchText: string;
	} = $props();

	type Picker = { kind: 'category' } | { kind: 'facet'; field?: LogFacetField } | null;

	let picker = $state<Picker>(null);

	const categoryChipActive = $derived(picker?.kind === 'category');

	function editChip(field: LogFacetField) {
		if (field === LogFacetField.CATEGORY || field === LogFacetField.CLASSIFICATION) {
			picker = picker?.kind === 'category' ? null : { kind: 'category' };

			return;
		}

		picker = picker?.kind === 'facet' && picker.field === field ? null : { kind: 'facet', field };
	}

	function applyCategories(selection: { categories: string[]; events: string[] }) {
		filters.set(LogFacetField.CATEGORY, selection.categories);
		filters.set(LogFacetField.CLASSIFICATION, selection.events);
		picker = null;
	}

	function applyFacet(field: LogFacetField, values: string[]) {
		filters.set(field, values);
		picker = null;
	}

	const triggerCls =
		'relative z-[2] flex cursor-pointer items-center gap-1.5 border border-dashed border-line-bold px-2.5 py-1 font-mono text-sm text-ink/70 hover:border-accent-line hover:text-command';
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-line p-3.5">
	{#if picker !== null}
		<button
			type="button"
			aria-label="Close filter picker"
			onclick={() => (picker = null)}
			class="fixed inset-0 z-[1] cursor-default bg-transparent"
		></button>
	{/if}

	{#each filters.chips as chip (chip.field)}
		<LogChip
			label={chip.label}
			values={chip.values}
			active={chip.field === LogFacetField.CATEGORY || chip.field === LogFacetField.CLASSIFICATION
				? categoryChipActive
				: picker?.kind === 'facet' && picker.field === chip.field}
			onedit={() => editChip(chip.field)}
			onremove={() => {
				picker = null;
				filters.remove(chip.field);
			}}
		/>
	{/each}

	<div class="relative">
		<button
			type="button"
			onclick={() => (picker = picker?.kind === 'category' ? null : { kind: 'category' })}
			aria-haspopup="listbox"
			aria-expanded={picker?.kind === 'category'}
			class={triggerCls}
		>
			<LayersIcon class="size-3" />
			Category
		</button>

		{#if picker?.kind === 'category'}
			<LogCategoryPicker {filters} {facets} {loading} onapply={applyCategories} onclose={() => (picker = null)} />
		{/if}
	</div>

	<div class="relative">
		<button
			type="button"
			onclick={() => (picker = picker?.kind === 'facet' ? null : { kind: 'facet' })}
			aria-haspopup="listbox"
			aria-expanded={picker?.kind === 'facet'}
			class={triggerCls}
		>
			<SlidersHorizontalIcon class="size-3" />
			Field
		</button>

		{#if picker?.kind === 'facet'}
			{#key picker.field ?? 'any'}
				<LogFacetPicker
					{filters}
					{facets}
					{loading}
					initialField={picker.field}
					onapply={applyFacet}
					onclose={() => (picker = null)}
				/>
			{/key}
		{/if}
	</div>

	{#if filters.chips.length > 0}
		<button
			type="button"
			onclick={() => {
				filters.clear();
				picker = null;
			}}
			class="translate-y-[1px] cursor-pointer px-1.5 py-1 font-mono text-xs text-ink/70 hover:text-danger"
		>
			Clear all
		</button>
	{/if}

	<div class="hidden md:block md:flex-1"></div>

	<div
		class="flex w-full min-w-[10rem] flex-1 items-center gap-2 border border-line-strong bg-paper px-2.5 py-1 focus-within:border-command md:w-[17rem] md:flex-none"
	>
		<SearchIcon class="size-3.5 flex-none text-ink/55" />
		<input
			type="text"
			bind:value={searchText}
			placeholder="Search…"
			spellcheck="false"
			aria-label="Search log message, detail, statement or PID"
			class="min-w-0 flex-1 border-none bg-transparent font-mono text-sm text-ink outline-none"
		/>
	</div>
</div>
