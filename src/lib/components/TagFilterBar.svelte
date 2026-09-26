<script lang="ts">
	import { SearchIcon } from '@lucide/svelte';
	import TagChip from '$lib/components/TagChip.svelte';
	import TagFilterPicker from '$lib/components/TagFilterPicker.svelte';
	import { type TagFilter, type KindKey, type QueryFilterState } from '$lib/queryFilter.svelte';

	let {
		searchText = $bindable(),
		tags
	}: {
		searchText: string;
		tags: QueryFilterState;
	} = $props();

	type Picker = { mode: 'add' } | { mode: 'edit'; index: number } | null;

	let picker = $state<Picker>(null);

	const editing = $derived(picker?.mode === 'edit' ? tags.chips[picker.index] : undefined);

	const kindOptions: { key: KindKey; label: string }[] = [
		{ key: 'reads', label: 'Reads' },
		{ key: 'writes', label: 'Writes' },
		{ key: 'others', label: 'Others' }
	];

	function commit(filter: TagFilter) {
		if (picker?.mode === 'edit') tags.replace(picker.index, filter);
		else tags.add(filter);
		picker = null;
	}
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-line p-3.5">
	{#each tags.chips as filter, i (filter.key + filter.op + filter.values.join(','))}
		<TagChip
			{filter}
			active={picker?.mode === 'edit' && picker.index === i}
			onedit={() => (picker = picker?.mode === 'edit' && picker.index === i ? null : { mode: 'edit', index: i })}
			onremove={() => {
				if (picker?.mode === 'edit' && picker.index === i) picker = null;
				tags.remove(i);
			}}
		/>
	{/each}

	<div class="relative">
		{#if picker !== null}
			<button
				type="button"
				aria-label="Close tag filter picker"
				onclick={() => (picker = null)}
				class="fixed inset-0 z-[1] cursor-default bg-transparent"
			></button>
		{/if}

		<button
			type="button"
			onclick={() => (picker = picker?.mode === 'add' ? null : { mode: 'add' })}
			aria-haspopup="listbox"
			aria-expanded={picker !== null}
			class="relative z-[2] flex cursor-pointer items-center gap-1.5 border border-dashed border-line-bold px-2.5 py-1 font-mono text-sm text-ink/70 hover:border-accent-line hover:text-command"
		>
			<SearchIcon class="size-3" />
			Tag
		</button>

		{#if picker !== null}
			{#key picker.mode === 'edit' ? picker.index : 'add'}
				<TagFilterPicker initial={editing} onapply={commit} onclose={() => (picker = null)} />
			{/key}
		{/if}
	</div>

	{#if tags.chips.length > 0}
		<button
			type="button"
			onclick={() => {
				tags.clear();
				picker = null;
			}}
			class="translate-y-[1px] cursor-pointer px-1.5 py-1 font-mono text-xs text-ink/70 hover:text-danger"
		>
			Clear all
		</button>
	{/if}

	<div class="hidden md:block md:flex-1"></div>

	<div class="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:gap-3.5">
		<div class="flex items-center gap-3.5">
			{#each kindOptions as opt (opt.key)}
				<label
					class="flex cursor-pointer items-center gap-2 font-sans text-xs leading-none font-semibold text-ink/70 select-none hover:text-ink"
				>
					<input
						type="checkbox"
						checked={tags.kinds[opt.key]}
						onchange={(e) => (tags.kinds[opt.key] = e.currentTarget.checked)}
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
