<script lang="ts">
	import { untrack } from 'svelte';
	import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@lucide/svelte';
	import {
		LogEvent_LogCategory,
		LogFacetField,
		type LogFacet
	} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/log_pb';
	import { fmtCount } from '$lib/format';
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
		onapply,
		onclose
	}: {
		filters: LogFilterState;
		facets: LogFacet[] | undefined;
		loading: boolean;
		onapply: (selection: { categories: string[]; events: string[] }) => void;
		onclose: () => void;
	} = $props();

	// Seeded once: the picker stays open across facet refreshes, which must not clobber a
	// selection still being built.
	const seed = untrack(() => ({
		categories: filters.valuesFor(LogFacetField.CATEGORY),
		events: filters.valuesFor(LogFacetField.CLASSIFICATION)
	}));

	let pickedCategories = $state<string[]>(seed.categories);
	let pickedEvents = $state<string[]>(seed.events);
	let openCategory = $state<LogEvent_LogCategory | null>(null);
	let search = $state('');
	let highlight = $state(0);
	let searchInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		searchInput?.focus();
	});

	const categoryCounts = $derived(
		new Map(facetValues(facets, LogFacetField.CATEGORY).map((v) => [Number(v.value), Number(v.count)]))
	);

	type EventRow = { value: string; label: string; code: string; count: number; category: LogEvent_LogCategory };

	const events = $derived(
		facetValues(facets, LogFacetField.CLASSIFICATION).map((v) => ({
			value: v.value,
			label: classificationLabel(Number(v.value)),
			code: classificationCode(Number(v.value)),
			count: Number(v.count),
			category: v.category
		}))
	);

	const eventsByCategory = $derived(
		new Map<LogEvent_LogCategory, EventRow[]>(
			CATEGORY_ORDER.map((category) => [
				category,
				events
					.filter((e) => e.category === category)
					.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
			])
		)
	);

	// Categories with events first; one that produced nothing is dimmed and sorted last rather
	// than hidden, so "where did Lock go?" has a visible answer.
	const categories = $derived(
		CATEGORY_ORDER.map((category) => ({
			category,
			label: categoryLabel(category),
			color: categoryColor(category),
			count: categoryCounts.get(category) ?? 0,
			present: (eventsByCategory.get(category) ?? []).length
		}))
			.filter((f) => f.category !== LogEvent_LogCategory.UNSPECIFIED || f.count > 0)
			.sort((a, b) => (a.count > 0 ? 0 : 1) - (b.count > 0 ? 0 : 1))
	);

	const term = $derived(search.trim().toLowerCase());

	// Searching crosses both levels on purpose: typing "deadlock" has to find "Lock deadlock
	// detected" without the user knowing it lives under Lock.
	const matches = $derived(
		term === ''
			? []
			: events
					.filter((e) => e.label.toLowerCase().includes(term) || e.code.toLowerCase().includes(term))
					.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
	);

	const openEvents = $derived(openCategory === null ? [] : (eventsByCategory.get(openCategory) ?? []));

	type Row =
		| { kind: 'category'; category: LogEvent_LogCategory }
		| { kind: 'event'; value: string }
		| { kind: 'whole-category' };

	// One flat row list drives the keyboard cursor, so the arrow keys behave the same whichever
	// view is on screen.
	const rows = $derived.by((): Row[] => {
		if (term !== '') return matches.map((e) => ({ kind: 'event', value: e.value }) as Row);
		if (openCategory !== null) {
			return [{ kind: 'whole-category' }, ...openEvents.map((e) => ({ kind: 'event', value: e.value }) as Row)];
		}

		return categories.map((c) => ({ kind: 'category', category: c.category }) as Row);
	});

	const wholeCategorySelected = $derived(openCategory !== null && pickedCategories.includes(String(openCategory)));

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function toggleCategory(category: LogEvent_LogCategory) {
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

	function drillInto(category: LogEvent_LogCategory) {
		openCategory = category;
		highlight = 0;
		search = '';
	}

	function back() {
		openCategory = null;
		highlight = 0;
		search = '';
	}

	function activate() {
		const row = rows[highlight];
		if (!row) return;

		if (row.kind === 'category') drillInto(row.category);
		else if (row.kind === 'event') toggleEvent(row.value);
		else if (openCategory !== null) toggleCategory(openCategory);
	}

	function apply() {
		onapply({ categories: pickedCategories, events: pickedEvents });
	}

	function reset() {
		pickedCategories = [];
		pickedEvents = [];
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = Math.min(highlight + 1, Math.max(rows.length - 1, 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = Math.max(highlight - 1, 0);
		} else if (e.key === 'ArrowLeft' && openCategory !== null && search === '') {
			e.preventDefault();
			back();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (e.metaKey) apply();
			else activate();
		}
	}

	const rowCls = 'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left font-sans text-sm text-ink';
	const boxCls = 'flex size-3.5 flex-none items-center justify-center border border-line-bold';
	const countCls = 'font-mono text-xs text-ink/70';
	const selectedCount = $derived(pickedCategories.length + pickedEvents.length);
</script>

<svelte:document
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
/>

<div
	role="presentation"
	{onkeydown}
	class="absolute top-[calc(100%+6px)] left-0 z-[3] w-[min(23rem,calc(100vw-2rem))] border border-line-strong bg-card shadow-popover"
>
	<div class="flex items-center gap-2 border-b border-line px-2 py-2">
		{#if openCategory !== null}
			<button
				type="button"
				onclick={back}
				aria-label="Back to categories"
				class="cursor-pointer p-1 text-ink/55 hover:text-ink"
			>
				<ChevronLeftIcon class="size-3.5" />
			</button>
			<span class="flex-1 font-sans text-sm font-semibold text-ink">{categoryLabel(openCategory)}</span>
		{:else}
			<SearchIcon class="ml-1 size-3.5 flex-none text-ink/55" />
			<input
				bind:this={searchInput}
				bind:value={search}
				oninput={() => (highlight = 0)}
				type="text"
				placeholder="Search all event types, e.g. deadlock"
				spellcheck="false"
				aria-label="Search log event types"
				class="w-full border-none bg-transparent font-sans text-sm text-ink outline-none"
			/>
		{/if}
	</div>

	<div class="max-h-[18rem] overflow-y-auto p-1.5" role="listbox" aria-label="Log categories" tabindex="-1">
		{#if term !== ''}
			{#each matches as event, i (event.value)}
				<button
					type="button"
					role="option"
					aria-selected={pickedEvents.includes(event.value)}
					onclick={() => toggleEvent(event.value)}
					onmouseenter={() => (highlight = i)}
					class="{rowCls} {i === highlight ? 'bg-hover' : ''}"
				>
					<span class={boxCls}>
						{#if pickedEvents.includes(event.value)}<CheckIcon class="size-3 text-command" />{/if}
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate">{event.label}</span>
						<span class="truncate font-condensed text-2xs tracking-[0.5px] text-ink/55 uppercase"
							>{categoryLabel(event.category)}</span
						>
					</span>
					<span class={countCls}>{fmtCount(event.count)}</span>
				</button>
			{:else}
				<div class="px-2.5 py-2.5 font-sans text-sm text-ink/70">
					{loading ? 'Loading…' : `No event type in this window matches “${search.trim()}”`}
				</div>
			{/each}
		{:else if openCategory !== null}
			{@const open = openCategory}
			<button
				type="button"
				role="option"
				aria-selected={wholeCategorySelected}
				onclick={() => toggleCategory(open)}
				onmouseenter={() => (highlight = 0)}
				class="{rowCls} {highlight === 0 ? 'bg-hover' : ''}"
			>
				<span class={boxCls}>
					{#if wholeCategorySelected}<CheckIcon class="size-3 text-command" />{/if}
				</span>
				<span class="flex-1 text-ink/70 italic">Everything in this category</span>
				<span class={countCls}>{fmtCount(categoryCounts.get(openCategory) ?? 0)}</span>
			</button>

			{#each openEvents as event, i (event.value)}
				<button
					type="button"
					role="option"
					aria-selected={pickedEvents.includes(event.value)}
					onclick={() => toggleEvent(event.value)}
					onmouseenter={() => (highlight = i + 1)}
					class="{rowCls} {highlight === i + 1 ? 'bg-hover' : ''} {wholeCategorySelected ? 'opacity-40' : ''}"
				>
					<span class={boxCls}>
						{#if pickedEvents.includes(event.value)}<CheckIcon class="size-3 text-command" />{/if}
					</span>
					<span class="min-w-0 flex-1 truncate" title={event.code}>{event.label}</span>
					<span class={countCls}>{fmtCount(event.count)}</span>
				</button>
			{:else}
				<div class="px-2.5 py-2.5 font-sans text-sm text-ink/70">No events of this category in this window</div>
			{/each}
		{:else}
			{#each categories as category, i (category.category)}
				{@const selected = pickedCategories.includes(String(category.category))}
				<!-- Two actions per row — take the whole category, or drill into its event types —
				     so the option is the row and the cursor is the highlight. -->
				<div
					class="flex items-center {i === highlight ? 'bg-hover' : ''} {category.count === 0 ? 'opacity-45' : ''}"
					role="option"
					aria-selected={selected}
					tabindex="-1"
					onmouseenter={() => (highlight = i)}
				>
					<button
						type="button"
						onclick={() => toggleCategory(category.category)}
						aria-label="Filter by all {category.label}"
						class="{rowCls} min-w-0 flex-1"
					>
						<span class={boxCls}>
							{#if selected}<CheckIcon class="size-3 text-command" />{/if}
						</span>
						<span class="h-2.5 w-2.5 flex-none" style:background={category.color}></span>
						<span class="min-w-0 flex-1 truncate">{category.label}</span>
						<span class={countCls}>{fmtCount(category.count)}</span>
					</button>
					<button
						type="button"
						onclick={() => drillInto(category.category)}
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
				</div>
			{:else}
				<div class="px-2.5 py-2.5 font-sans text-sm text-ink/70">
					{loading ? 'Loading…' : 'No log events in this window'}
				</div>
			{/each}
		{/if}
	</div>

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
			class="flex-1 cursor-pointer bg-command py-2 text-center font-condensed text-md font-semibold tracking-[0.6px] text-paper uppercase hover:bg-danger"
		>
			{selectedCount > 0 ? `Apply ${selectedCount} filter${selectedCount === 1 ? '' : 's'}` : 'Show all categories'}
		</button>
	</div>
</div>
