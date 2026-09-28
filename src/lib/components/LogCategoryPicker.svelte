<script lang="ts">
	import { untrack } from 'svelte';
	import { Command } from 'bits-ui';
	import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@lucide/svelte';
	import { LogCategory, LogFacetField, type LogFacet } from '$lib/gen/querysheriff/v1/log_pb';
	import { containsFilter, fmtCount } from '$lib/format';
	import {
		CATEGORY_ORDER,
		categoryColor,
		categoryLabel,
		classificationCode,
		classificationLabel,
		facetValues
	} from '$lib/logs';
	import type { LogFilterState } from '$lib/logFilter.svelte';

	let {
		filters,
		facets,
		loading,
		onapply
	}: {
		filters: LogFilterState;
		facets: LogFacet[] | undefined;
		loading: boolean;
		onapply: (selection: { categories: string[]; events: string[] }) => void;
	} = $props();

	// Seeded once: the picker stays open across facet refreshes, which must not clobber a selection.
	const seed = untrack(() => ({
		categories: filters.valuesFor(LogFacetField.CATEGORY),
		events: filters.valuesFor(LogFacetField.CLASSIFICATION)
	}));

	let pickedCategories = $state<string[]>(seed.categories);
	let pickedEvents = $state<string[]>(seed.events);
	let openCategory = $state<LogCategory | null>(null);
	let search = $state('');
	let eventList = $state<HTMLElement | null>(null);

	// A drilled-in category has no search input to take focus, so the list itself does.
	$effect(() => {
		eventList?.focus();
	});

	const categoryCounts = $derived(
		new Map(facetValues(facets, LogFacetField.CATEGORY).map((v) => [Number(v.value), Number(v.count)]))
	);

	type EventRow = { value: string; label: string; code: string; count: number; category: LogCategory };

	const events = $derived(
		facetValues(facets, LogFacetField.CLASSIFICATION)
			.map((v) => ({
				value: v.value,
				label: classificationLabel(Number(v.value)),
				code: classificationCode(Number(v.value)),
				count: Number(v.count),
				category: v.category
			}))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
	);

	const eventsByCategory = $derived(
		new Map<LogCategory, EventRow[]>(
			CATEGORY_ORDER.map((category) => [category, events.filter((e) => e.category === category)])
		)
	);

	const categories = $derived(
		CATEGORY_ORDER.map((category) => ({
			category,
			label: categoryLabel(category),
			color: categoryColor(category),
			count: categoryCounts.get(category) ?? 0,
			present: (eventsByCategory.get(category) ?? []).length
		}))
			.filter((f) => f.category !== LogCategory.UNSPECIFIED || f.count > 0)
			.sort((a, b) => (a.count > 0 ? 0 : 1) - (b.count > 0 ? 0 : 1))
	);

	const openEvents = $derived(openCategory === null ? [] : (eventsByCategory.get(openCategory) ?? []));

	const wholeCategorySelected = $derived(openCategory !== null && pickedCategories.includes(String(openCategory)));

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function toggleCategory(category: LogCategory) {
		const value = String(category);
		pickedCategories = toggle(pickedCategories, value);

		// Selecting the whole category makes any individual pick inside it redundant.
		if (pickedCategories.includes(value)) {
			const inside = new Set((eventsByCategory.get(category) ?? []).map((e) => e.value));
			pickedEvents = pickedEvents.filter((v) => !inside.has(v));
		}
	}

	function toggleEvent(value: string) {
		pickedEvents = toggle(pickedEvents, value);
	}

	function drillInto(category: LogCategory) {
		openCategory = category;
		search = '';
	}

	function apply() {
		onapply({ categories: pickedCategories, events: pickedEvents });
	}

	function reset() {
		pickedCategories = [];
		pickedEvents = [];
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft' && openCategory !== null) {
			e.preventDefault();
			openCategory = null;
		} else if (e.key === 'Enter' && e.metaKey) {
			e.preventDefault();
			apply();
		}
	}

	const listCls = 'max-h-[18rem] overflow-y-auto p-1.5';
	const rowCls =
		'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left font-sans text-sm text-ink data-[selected]:bg-hover';
	const boxCls = 'flex size-3.5 flex-none items-center justify-center border border-line-bold';
	const countCls = 'font-mono text-xs text-ink/70';
	const emptyCls = 'px-2.5 py-2.5 font-sans text-sm text-ink/70';
	const selectedCount = $derived(pickedCategories.length + pickedEvents.length);
</script>

{#snippet check(on: boolean)}
	<span class={boxCls}>
		{#if on}<CheckIcon class="size-3 text-command" />{/if}
	</span>
{/snippet}

{#if openCategory === null}
	<Command.Root filter={containsFilter} {onkeydown}>
		<div class="flex items-center gap-2 border-b border-line px-2 py-2">
			<SearchIcon class="ml-1 size-3.5 flex-none text-ink/55" />
			<Command.Input
				autofocus
				bind:value={search}
				placeholder="Search all event types, e.g. deadlock"
				aria-label="Search log event types"
				class="w-full border-none bg-transparent font-sans text-sm text-ink outline-none"
			/>
		</div>

		<Command.List aria-label="Log categories" class={listCls}>
			<Command.Viewport>
				{#if search.trim() === ''}
					{#each categories as category (category.category)}
						<!-- Enter and the chevron drill in; the row's main button toggles the whole category. -->
						<Command.Item
							value={category.label}
							onSelect={() => drillInto(category.category)}
							aria-checked={pickedCategories.includes(String(category.category))}
							class="flex items-center data-[selected]:bg-hover {category.count === 0 ? 'opacity-45' : ''}"
						>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									toggleCategory(category.category);
								}}
								aria-label="Filter by all {category.label}"
								class="{rowCls} min-w-0 flex-1"
							>
								{@render check(pickedCategories.includes(String(category.category)))}
								<span class="h-2.5 w-2.5 flex-none" style:background={category.color}></span>
								<span class="min-w-0 flex-1 truncate">{category.label}</span>
								<span class={countCls}>{fmtCount(category.count)}</span>
							</button>
							<button
								type="button"
								disabled={category.present === 0}
								title={category.present === 0
									? 'No events of this category in this window'
									: `Pick individual event types (${category.present})`}
								aria-label="Open {category.label}"
								class="flex-none px-2 py-2 {category.present === 0
									? 'cursor-not-allowed text-ink/25'
									: 'cursor-pointer text-ink/55 hover:text-command'}"
							>
								<ChevronRightIcon class="size-3.5" />
							</button>
						</Command.Item>
					{/each}
				{:else}
					{#each events as event (event.value)}
						<Command.Item
							value={event.label}
							keywords={[event.code]}
							onSelect={() => toggleEvent(event.value)}
							aria-checked={pickedEvents.includes(event.value)}
							class={rowCls}
						>
							{@render check(pickedEvents.includes(event.value))}
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate">{event.label}</span>
								<span class="truncate font-sans text-2xs text-ink/55">{categoryLabel(event.category)}</span>
							</span>
							<span class={countCls}>{fmtCount(event.count)}</span>
						</Command.Item>
					{/each}
				{/if}
				<Command.Empty class={emptyCls}>
					{loading
						? 'Loading…'
						: search.trim() === ''
							? 'No log events in this window'
							: `No event type in this window matches “${search.trim()}”`}
				</Command.Empty>
			</Command.Viewport>
		</Command.List>
	</Command.Root>
{:else}
	{@const open = openCategory}
	<Command.Root bind:ref={eventList} {onkeydown} class="outline-none">
		<div class="flex items-center gap-2 border-b border-line px-2 py-2">
			<button
				type="button"
				onclick={() => (openCategory = null)}
				aria-label="Back to categories"
				class="cursor-pointer p-1 text-ink/55 hover:text-ink"
			>
				<ChevronLeftIcon class="size-3.5" />
			</button>
			<span class="flex-1 font-sans text-sm font-semibold text-ink">{categoryLabel(open)}</span>
		</div>

		<Command.List aria-label="{categoryLabel(open)} events" class={listCls}>
			<Command.Viewport>
				<Command.Item
					forceMount
					value="Everything in this category"
					onSelect={() => toggleCategory(open)}
					aria-checked={wholeCategorySelected}
					class={rowCls}
				>
					{@render check(wholeCategorySelected)}
					<span class="flex-1 text-ink/70 italic">Everything in this category</span>
					<span class={countCls}>{fmtCount(categoryCounts.get(open) ?? 0)}</span>
				</Command.Item>

				{#each openEvents as event (event.value)}
					<Command.Item
						value={event.label}
						onSelect={() => toggleEvent(event.value)}
						aria-checked={pickedEvents.includes(event.value)}
						class="{rowCls} {wholeCategorySelected ? 'opacity-40' : ''}"
					>
						{@render check(pickedEvents.includes(event.value))}
						<span class="min-w-0 flex-1 truncate" title={event.code}>{event.label}</span>
						<span class={countCls}>{fmtCount(event.count)}</span>
					</Command.Item>
				{/each}
				<Command.Empty class={emptyCls}>No events of this category in this window</Command.Empty>
			</Command.Viewport>
		</Command.List>
	</Command.Root>
{/if}

<div class="flex items-center gap-2 border-t border-line p-2">
	{#if selectedCount > 0}
		<button
			type="button"
			onclick={reset}
			class="cursor-pointer px-2 py-2 font-mono text-xs text-ink/70 hover:text-danger">Reset</button
		>
	{/if}
	<button
		type="button"
		onclick={apply}
		class="flex-1 cursor-pointer bg-command py-2 text-center font-sans text-md font-semibold text-paper hover:bg-danger"
	>
		{selectedCount > 0 ? `Apply ${selectedCount} filter${selectedCount === 1 ? '' : 's'}` : 'Show all categories'}
	</button>
</div>
