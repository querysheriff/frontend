<script lang="ts">
	import { Popover } from 'bits-ui';
	import { LayersIcon, SearchIcon, SlidersHorizontalIcon } from '@lucide/svelte';
	import { LogFacetField, type LogFacet } from '$lib/gen/querysheriff/v1/log_pb';
	import FilterChip from '$lib/components/FilterChip.svelte';
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

	function editChip(field: LogFacetField) {
		picker = field === LogFacetField.CATEGORY ? { kind: 'category' } : { kind: 'facet', field };
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
		'flex cursor-pointer items-center gap-1.5 border border-dashed border-line-bold px-2.5 py-1 font-mono text-sm text-ink-muted hover:border-accent-line hover:text-command';
	// The picker focuses its own search input or list, so bits-ui must not pick the first button.
	const contentProps = {
		side: 'bottom',
		align: 'start',
		sideOffset: 6,
		collisionPadding: 16,
		onOpenAutoFocus: (e: Event) => e.preventDefault()
	} as const;
	const contentCls = 'z-50 border border-line-strong bg-card shadow-popover';
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-line p-3.5">
	{#each filters.chips as chip (chip.field)}
		<FilterChip
			label={chip.label}
			values={chip.values}
			active={chip.field === LogFacetField.CATEGORY
				? picker?.kind === 'category'
				: picker?.kind === 'facet' && picker.field === chip.field}
			onedit={() => editChip(chip.field)}
			onremove={() => {
				picker = null;
				filters.remove(chip.field);
			}}
		/>
	{/each}

	<Popover.Root bind:open={() => picker?.kind === 'category', (open) => (picker = open ? { kind: 'category' } : null)}>
		<Popover.Trigger class={triggerCls}>
			<LayersIcon class="size-3" />
			Category
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content {...contentProps} class="{contentCls} w-[min(23rem,calc(100vw-2rem))]">
				<LogCategoryPicker {filters} {facets} {loading} onapply={applyCategories} />
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>

	<Popover.Root bind:open={() => picker?.kind === 'facet', (open) => (picker = open ? { kind: 'facet' } : null)}>
		<Popover.Trigger class={triggerCls}>
			<SlidersHorizontalIcon class="size-3" />
			Field
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content {...contentProps} class="{contentCls} w-[min(21rem,calc(100vw-2rem))]">
				{#key picker?.kind === 'facet' ? picker.field : undefined}
					<LogFacetPicker
						{filters}
						{facets}
						{loading}
						initialField={picker?.kind === 'facet' ? picker.field : undefined}
						onapply={applyFacet}
					/>
				{/key}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>

	{#if filters.chips.length > 0}
		<button
			type="button"
			onclick={() => {
				filters.clear();
				picker = null;
			}}
			class="translate-y-[1px] cursor-pointer px-1.5 py-1 font-mono text-xs text-ink-muted hover:text-danger-text"
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
