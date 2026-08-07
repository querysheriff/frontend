<script lang="ts">
	import { ChevronDownIcon, ChevronRightIcon, ChevronsDownUpIcon, ChevronsUpDownIcon } from '@lucide/svelte';
	import { buildSqlTree, foldablePaths, formatSql, hiddenLines, previewLimits, type SqlNode } from '$lib/sqlOutline';

	let { text, placeholder = '' }: { text?: string; placeholder?: string } = $props();

	const roots = $derived(text ? buildSqlTree(formatSql(text)) : []);
	const limits = $derived(previewLimits(roots));
	const foldable = $derived(foldablePaths(roots));

	// Explicit unfolds, by node path; a path with no entry follows the preview.
	// Cleared when a different query arrives so paths never carry over.
	let unfolded = $state<Record<string, boolean>>({});
	let unfoldedFor: string | undefined = undefined;
	$effect(() => {
		if (unfoldedFor === text) return;
		unfoldedFor = text;
		unfolded = {};
	});

	// Children rendered for a node: all of them once unfolded, otherwise the
	// preview's share — zero below the top level, so nesting costs a single line.
	function shownChildren(node: SqlNode, path: string): number {
		if (unfolded[path] !== undefined) return unfolded[path] ? node.children.length : 0;
		return Math.min(limits.get(path) ?? 0, node.children.length);
	}

	// Only "everything is open" reads as expanded; after picking sections apart by
	// hand the button offers to open the rest rather than to close what's left.
	const allExpanded = $derived(foldable.length > 0 && foldable.every((path) => unfolded[path] === true));

	function toggleAll() {
		const open = !allExpanded;
		unfolded = Object.fromEntries(foldable.map((path) => [path, open]));
	}

	const INDENT_REM = 1.25;

	const plural = (n: number): string => `${n} line${n === 1 ? '' : 's'}`;
	const more = (n: number): string => `+${n} more line${n === 1 ? '' : 's'}`;
</script>

{#snippet row(node: SqlNode, path: string, depth: number)}
	{@const shown = shownChildren(node, path)}
	{@const pad = `${depth * INDENT_REM}rem`}
	<!-- The floating toggle sits over the first row, so only that row keeps clear of it. -->
	{@const clear = path === '0' ? 'pr-28' : ''}
	{#if node.children.length === 0}
		<!-- No chevron in flow, so pad to the column its foldable siblings' text starts at. -->
		<div class="pl-5 break-words whitespace-pre-wrap text-paper/90 {clear}" style:margin-left={pad}>{node.text}</div>
	{:else}
		<button
			type="button"
			aria-expanded={shown > 0}
			onclick={() => (unfolded[path] = shown === 0)}
			style:margin-left={pad}
			class="group flex cursor-pointer items-start gap-1.5 text-left text-paper {clear}"
		>
			{#if shown > 0}
				<ChevronDownIcon class="mt-1 size-3.5 flex-none text-paper/45 group-hover:text-paper" />
			{:else}
				<ChevronRightIcon class="mt-1 size-3.5 flex-none text-paper/45 group-hover:text-paper" />
			{/if}
			<span class="break-words">{node.text}</span>
			{#if shown === 0}
				<span class="flex-none text-paper/45 group-hover:text-paper/70">… {plural(node.lines)}</span>
			{/if}
		</button>

		{#if shown > 0}
			{#each node.children.slice(0, shown) as child, i (i)}
				{@render row(child, `${path}.${i}`, depth + 1)}
			{/each}
			{#if shown < node.children.length}
				<button
					type="button"
					onclick={() => (unfolded[path] = true)}
					style:margin-left={`${(depth + 1) * INDENT_REM}rem`}
					class="cursor-pointer pl-5 text-left text-paper/45 hover:text-paper"
				>
					{more(hiddenLines(node, shown))}
				</button>
			{/if}
		{/if}
	{/if}
{/snippet}

<div class="relative border border-line-card bg-ink px-4 py-3.5 font-mono text-sm leading-[1.7]">
	{#if !text}
		<div class="text-paper/50">{placeholder}</div>
	{:else if roots.length === 0}
		<div class="break-words whitespace-pre-wrap text-paper">{text}</div>
	{:else}
		{#if foldable.length > 0}
			<button
				type="button"
				onclick={toggleAll}
				class="absolute top-3.5 right-4 z-[1] flex cursor-pointer items-center gap-1.5 font-condensed text-2xs font-semibold tracking-[0.7px] text-paper/45 uppercase hover:text-paper"
			>
				{#if allExpanded}
					<ChevronsDownUpIcon class="size-3.5" /><span>Collapse all</span>
				{:else}
					<ChevronsUpDownIcon class="size-3.5" /><span>Expand all</span>
				{/if}
			</button>
		{/if}
		{#each roots as root, i (i)}
			{@render row(root, String(i), 0)}
		{/each}
	{/if}
</div>
