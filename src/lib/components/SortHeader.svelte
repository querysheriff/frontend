<script lang="ts">
	import { clsx } from 'clsx';
	import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from '@lucide/svelte';

	// One column heading. Shared by every data table so their headings keep the
	// same type, padding and affordance — and so a sortable and a plain heading in
	// the same row land on the same baseline.
	let {
		label,
		align = 'left',
		class: klass = '',
		pad = 'px-4',
		dir = null,
		onsort
	}: {
		label: string;
		align?: 'left' | 'right';
		/** Width and responsive visibility for the column. */
		class?: string;
		/** Horizontal padding, overridden by columns whose cells carry a gutter. */
		pad?: string;
		/** How this column is currently sorted, or null when it is not the sorted one. */
		dir?: 'asc' | 'desc' | null;
		/** Left off for a column that cannot be sorted. */
		onsort?: () => void;
	} = $props();

	const box = $derived(clsx('block py-2.5', pad, align === 'right' ? 'text-right' : 'text-left'));
</script>

{#snippet content()}
	<!-- The sort icon is absolutely positioned beside the label so it never consumes
	     layout width — the label stays flush with the column's values even when the
	     column is too narrow to fit both. It sits left of the label on right-aligned
	     columns, right of it otherwise. -->
	<span class="relative inline-flex items-center align-middle">
		<span>{label}</span>
		{#if onsort}
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
	aria-sort={onsort ? (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') : undefined}
	class={clsx(
		'border-b border-line font-condensed text-xs font-semibold tracking-[0.7px] whitespace-nowrap text-ink/70 uppercase',
		klass
	)}
>
	{#if onsort}
		<button
			type="button"
			onclick={onsort}
			class="{box} group/sort w-full cursor-pointer uppercase select-none focus-visible:text-command"
		>
			{@render content()}
		</button>
	{:else}
		<!-- Mirrors the button's inner box exactly. That wrapper is
		     vertical-align: middle, so a bare label would otherwise sit on a
		     different line than its sortable neighbours. -->
		<span class={box}>{@render content()}</span>
	{/if}
</th>
