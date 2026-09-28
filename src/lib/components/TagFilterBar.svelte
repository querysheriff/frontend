<script lang="ts">
	import { Popover } from 'bits-ui';
	import { SearchIcon } from '@lucide/svelte';
	import FilterChip from '$lib/components/FilterChip.svelte';
	import TagFilterPicker from '$lib/components/TagFilterPicker.svelte';
	import { OP_SYMBOL, type KindKey, type QueryFilterState, type TagFilter } from '$lib/queryFilter.svelte';

	let {
		searchText = $bindable(),
		filters
	}: {
		searchText: string;
		filters: QueryFilterState;
	} = $props();

	type Picker = { mode: 'add' } | { mode: 'edit'; index: number } | null;

	let picker = $state<Picker>(null);

	const editing = $derived(picker?.mode === 'edit' ? filters.tags[picker.index] : undefined);

	const kindOptions: { key: KindKey; label: string }[] = [
		{ key: 'reads', label: 'Reads' },
		{ key: 'writes', label: 'Writes' },
		{ key: 'others', label: 'Others' }
	];

	function commit(filter: TagFilter) {
		if (picker?.mode === 'edit') filters.replace(picker.index, filter);
		else filters.add(filter);
		picker = null;
	}
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-line p-3.5">
	{#each filters.tags as filter, i (i)}
		<FilterChip
			label={filter.key}
			op={OP_SYMBOL[filter.op]}
			values={filter.values.join(' or ')}
			active={picker?.mode === 'edit' && picker.index === i}
			onedit={() => (picker = { mode: 'edit', index: i })}
			onremove={() => {
				if (picker?.mode === 'edit' && picker.index === i) picker = null;
				filters.remove(i);
			}}
		/>
	{/each}

	<Popover.Root bind:open={() => picker !== null, (open) => (picker = open ? { mode: 'add' } : null)}>
		<Popover.Trigger
			class="flex cursor-pointer items-center gap-1.5 border border-dashed border-line-bold px-2.5 py-1 font-mono text-sm text-ink-muted hover:border-accent-line hover:text-command"
		>
			<SearchIcon class="size-3" />
			Tag
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				side="bottom"
				align="start"
				sideOffset={6}
				collisionPadding={16}
				onOpenAutoFocus={(e) => e.preventDefault()}
				class="z-50 w-[min(320px,calc(100vw-32px))] border border-line-strong bg-card shadow-popover"
			>
				{#key picker?.mode === 'edit' ? picker.index : 'add'}
					<TagFilterPicker initial={editing} onapply={commit} />
				{/key}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>

	{#if filters.tags.length > 0}
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

	<div class="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:gap-3.5">
		<div class="flex items-center gap-3.5">
			{#each kindOptions as opt (opt.key)}
				<label
					class="flex cursor-pointer items-center gap-2 font-sans text-xs leading-none font-semibold text-ink-muted select-none hover:text-ink"
				>
					<input
						type="checkbox"
						checked={filters.kinds[opt.key]}
						onchange={(e) => (filters.kinds[opt.key] = e.currentTarget.checked)}
						class="m-0 block size-3.5 shrink-0 cursor-pointer accent-command"
					/>
					<span class="leading-none">{opt.label}</span>
				</label>
			{/each}
		</div>

		<div
			class="flex w-full min-w-[10rem] flex-1 items-center gap-2 border border-line-strong bg-paper px-2.5 py-1 focus-within:border-command md:w-[13.75rem] md:flex-none"
		>
			<SearchIcon class="size-3.5 flex-none text-ink/55" />
			<input
				type="text"
				bind:value={searchText}
				placeholder="Search…"
				spellcheck="false"
				aria-label="Search SQL text"
				class="min-w-0 flex-1 border-none bg-transparent font-mono text-sm text-ink outline-none"
			/>
		</div>
	</div>
</div>
