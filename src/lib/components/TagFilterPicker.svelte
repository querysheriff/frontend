<script lang="ts">
	import { untrack } from 'svelte';
	import { CheckIcon, ChevronLeftIcon, SearchIcon } from '@lucide/svelte';
	import { timestampFromDate } from '@bufbuild/protobuf/wkt';
	import { statementClient } from '$lib/connect';
	import { ctx } from '$lib/state.svelte';
	import { errMsg } from '$lib/format';
	import type { TagFilter, TagOp } from '$lib/queryFilter.svelte';

	let {
		initial,
		onapply,
		onclose
	}: {
		initial?: TagFilter;
		onapply: (filter: TagFilter) => void;
		onclose: () => void;
	} = $props();

	type KeyRow = { key: string; valueCount: number };
	type ValueRow = { value: string; statementCount: number };

	// Seeded once and committed on Apply: the picker remounts per chip, so props must not clobber it.
	const seed = untrack(() => ({
		step: (initial ? 'value' : 'key') as 'key' | 'value',
		key: initial?.key ?? '',
		op: (initial?.op ?? 'eq') as TagOp,
		picked: initial?.op === 'exists' ? [] : [...(initial?.values ?? [])],
		anyValue: initial?.op === 'exists'
	}));

	let step = $state<'key' | 'value'>(seed.step);
	let key = $state(seed.key);
	let op = $state<TagOp>(seed.op);
	let picked = $state<string[]>(seed.picked);
	let anyValue = $state(seed.anyValue);

	let keySearch = $state('');
	let valueSearch = $state('');

	let keyRows = $state<KeyRow[]>([]);
	let valueRows = $state<ValueRow[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let highlight = $state(0);
	let searchInput = $state<HTMLInputElement | null>(null);

	const scope = () => {
		const { from, to } = ctx.timeRange();
		return {
			serverName: ctx.server,
			databaseName: ctx.db,
			from: timestampFromDate(from),
			to: timestampFromDate(to)
		};
	};

	$effect(() => {
		searchInput?.focus();
	});

	$effect(() => {
		if (step !== 'key') return;

		let cancelled = false;
		const ac = new AbortController();
		loading = true;
		error = null;

		statementClient
			.listTagKeys(scope(), { signal: ac.signal })
			.then((res) => {
				if (cancelled) return;
				keyRows = res.keys.map((k) => ({ key: k.key, valueCount: Number(k.valueCount) }));
			})
			.catch((e: unknown) => {
				if (!cancelled) error = errMsg(e);
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
			ac.abort();
		};
	});

	$effect(() => {
		if (step !== 'value' || !key) return;

		let cancelled = false;
		const ac = new AbortController();
		loading = true;
		error = null;

		statementClient
			.listTagValues({ ...scope(), key }, { signal: ac.signal })
			.then((res) => {
				if (cancelled) return;
				valueRows = res.values.map((v) => ({ value: v.value, statementCount: Number(v.statementCount) }));
			})
			.catch((e: unknown) => {
				if (!cancelled) error = errMsg(e);
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
			ac.abort();
		};
	});

	const visibleKeys = $derived(keyRows.filter((k) => k.key.toLowerCase().includes(keySearch.trim().toLowerCase())));

	const visibleValues = $derived(
		valueRows.filter((v) => v.value.toLowerCase().includes(valueSearch.trim().toLowerCase()))
	);

	const valueRowCount = $derived(1 + visibleValues.length);
	const canApply = $derived(anyValue || picked.length > 0);

	function selectKey(k: string) {
		key = k;
		step = 'value';
		picked = [];
		anyValue = false;
		valueSearch = '';
		highlight = 0;
	}

	function back() {
		step = 'key';
		highlight = 0;
		keySearch = '';
	}

	function toggleValue(v: string) {
		anyValue = false;
		picked = picked.includes(v) ? picked.filter((p) => p !== v) : [...picked, v];
	}

	function apply() {
		if (!canApply) return;
		onapply(anyValue ? { key, op: 'exists', values: [] } : { key, op, values: picked });
	}

	function activate() {
		if (step === 'key') {
			const k = visibleKeys[highlight];
			if (k) selectKey(k.key);
			return;
		}

		if (highlight === 0) {
			anyValue = !anyValue;
			if (anyValue) picked = [];
			return;
		}

		const v = visibleValues[highlight - 1];
		if (v) toggleValue(v.value);
	}

	function onkeydown(e: KeyboardEvent) {
		const max = (step === 'key' ? visibleKeys.length : valueRowCount) - 1;

		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = Math.min(highlight + 1, Math.max(max, 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = Math.max(highlight - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (step === 'value' && e.metaKey) apply();
			else activate();
		}
	}

	const rowCls = 'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 font-mono text-sm text-ink';
</script>

<svelte:document
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
/>

<div
	role="presentation"
	{onkeydown}
	class="absolute top-[calc(100%+6px)] left-0 z-[2] w-[min(320px,calc(100vw-32px))] border border-line-strong bg-card shadow-popover"
>
	{#if step === 'key'}
		<div class="flex items-center gap-2 border-b border-line px-2.5 py-2">
			<SearchIcon class="size-3.5 flex-none text-ink/55" />
			<input
				bind:this={searchInput}
				bind:value={keySearch}
				oninput={() => (highlight = 0)}
				type="text"
				placeholder="Find a tag key…"
				spellcheck="false"
				aria-label="Find a tag key"
				class="w-full border-none bg-transparent font-mono text-sm text-ink outline-none"
			/>
		</div>
		<div class="max-h-[17.5rem] overflow-y-auto p-1.5" role="listbox" aria-label="Tag keys" tabindex="-1">
			{#each visibleKeys as k, i (k.key)}
				<button
					type="button"
					role="option"
					aria-selected={i === highlight}
					onclick={() => selectKey(k.key)}
					onmouseenter={() => (highlight = i)}
					class="{rowCls} {i === highlight ? 'bg-hover' : ''}"
				>
					<span class="flex-1 text-left">{k.key}</span>
					<span class="text-xs text-ink/70">{k.valueCount}</span>
				</button>
			{:else}
				<div class="px-2.5 py-2.5 font-mono text-sm text-ink/70">
					{loading ? 'Loading…' : (error ?? (keyRows.length > 0 ? 'No matching tag keys' : 'No tags found'))}
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex items-center gap-2 border-b border-line px-2 py-2">
			<button
				type="button"
				onclick={back}
				aria-label="Back to tag keys"
				class="cursor-pointer p-1 text-ink/55 hover:text-ink"
			>
				<ChevronLeftIcon class="size-3.5" />
			</button>
			<span class="flex-1 font-mono text-sm font-semibold text-ink">{key}</span>
			<div class="flex border border-line-strong">
				{#each [{ v: 'eq', l: '=' }, { v: 'ne', l: '!=' }] as const as o (o.v)}
					<button
						type="button"
						disabled={anyValue}
						onclick={() => (op = o.v)}
						title={anyValue ? 'Any value has no negated form' : `Match ${o.l}`}
						class="px-2.5 py-1 font-mono text-xs {anyValue
							? 'cursor-not-allowed text-ink/25'
							: op === o.v
								? 'cursor-pointer bg-command text-paper'
								: 'cursor-pointer text-ink/70 hover:bg-hover'}"
					>
						{o.l}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex items-center gap-2 border-b border-line px-2.5 py-2">
			<SearchIcon class="size-3.5 flex-none text-ink/55" />
			<input
				bind:this={searchInput}
				bind:value={valueSearch}
				oninput={() => (highlight = 0)}
				type="text"
				placeholder="Find a value…"
				spellcheck="false"
				aria-label="Find a tag value"
				class="w-full border-none bg-transparent font-mono text-sm text-ink outline-none"
			/>
		</div>

		<div class="max-h-[15rem] overflow-y-auto p-1.5" role="listbox" aria-label="Tag values" tabindex="-1">
			<button
				type="button"
				role="option"
				aria-selected={anyValue}
				onclick={() => {
					anyValue = !anyValue;
					if (anyValue) picked = [];
				}}
				onmouseenter={() => (highlight = 0)}
				class="{rowCls} {highlight === 0 ? 'bg-hover' : ''}"
			>
				<span class="flex size-3.5 flex-none items-center justify-center border border-line-bold">
					{#if anyValue}<CheckIcon class="size-3 text-command" />{/if}
				</span>
				<span class="flex-1 text-left text-ink/70 italic">Any value</span>
			</button>

			{#each visibleValues as v, i (v.value)}
				<button
					type="button"
					role="option"
					aria-selected={picked.includes(v.value)}
					onclick={() => toggleValue(v.value)}
					onmouseenter={() => (highlight = i + 1)}
					class="{rowCls} {highlight === i + 1 ? 'bg-hover' : ''} {anyValue ? 'opacity-40' : ''}"
				>
					<span class="flex size-3.5 flex-none items-center justify-center border border-line-bold">
						{#if picked.includes(v.value)}<CheckIcon class="size-3 text-command" />{/if}
					</span>
					<span class="flex-1 truncate text-left">{v.value}</span>
					<span class="text-xs text-ink/70">{v.statementCount}</span>
				</button>
			{:else}
				<div class="px-2.5 py-2.5 font-mono text-sm text-ink/70">
					{loading ? 'Loading…' : (error ?? (valueRows.length > 0 ? 'No matching values' : 'No values in this window'))}
				</div>
			{/each}
		</div>

		<div class="border-t border-line p-2">
			<button
				type="button"
				onclick={apply}
				disabled={!canApply}
				class="w-full py-2 text-center font-condensed text-md font-semibold tracking-[0.6px] uppercase {canApply
					? 'cursor-pointer bg-command text-paper hover:bg-danger'
					: 'cursor-not-allowed bg-hover-strong text-ink/35'}"
			>
				Apply filter
			</button>
		</div>
	{/if}
</div>
