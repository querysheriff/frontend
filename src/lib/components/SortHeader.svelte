<script module lang="ts">
	export type Sort<C> = { column: C; desc: boolean };
</script>

<script lang="ts" generics="C">
	import { clsx } from 'clsx';
	import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from '@lucide/svelte';

	let {
		label,
		align = 'left',
		class: klass = '',
		pad = 'px-4',
		column,
		sort = $bindable()
	}: {
		label: string;
		align?: 'left' | 'right';
		class?: string;
		pad?: string;
		column?: C;
		sort?: Sort<C>;
	} = $props();

	const sortable = $derived(column !== undefined && sort !== undefined);
	const dir = $derived(sort && sort.column === column ? (sort.desc ? 'desc' : 'asc') : null);
	const box = $derived(clsx('block py-2.5', pad, align === 'right' ? 'text-right' : 'text-left'));

	function toggle() {
		if (column === undefined || !sort) return;
		sort = { column, desc: sort.column !== column || !sort.desc };
	}
</script>

{#snippet content()}
	<!-- Absolute so the icon never consumes layout width and the label stays flush with its values. -->
	<span class="relative inline-flex items-center align-middle">
		<span>{label}</span>
		{#if sortable}
			<span
				class={clsx(
					'pointer-events-none absolute inset-y-0 flex items-center',
					align === 'right' ? 'right-full pr-1' : 'left-full pl-1'
				)}
			>
				{#if dir === 'asc'}
					<ArrowUpIcon class="size-3 flex-none text-command" />
				{:else if dir === 'desc'}
					<ArrowDownIcon class="size-3 flex-none text-command" />
				{:else}
					<ArrowUpDownIcon
						class="size-3 flex-none text-ink/35 opacity-0 transition-opacity group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
					/>
				{/if}
			</span>
		{/if}
	</span>
{/snippet}

<th
	scope="col"
	aria-sort={sortable ? (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') : undefined}
	class={clsx('border-b border-line font-sans text-xs font-semibold whitespace-nowrap text-ink/70', klass)}
>
	{#if sortable}
		<button
			type="button"
			onclick={toggle}
			class="{box} group/sort w-full cursor-pointer select-none focus-visible:text-command"
		>
			{@render content()}
		</button>
	{:else}
		<span class={box}>{@render content()}</span>
	{/if}
</th>
