<script lang="ts">
	import { untrack } from 'svelte';
	import { Command } from 'bits-ui';
	import { CheckIcon, ChevronLeftIcon, SearchIcon } from '@lucide/svelte';
	import { statementClient } from '$lib/connect';
	import { ctx } from '$lib/state.svelte';
	import { containsFilter } from '$lib/format';
	import { Loader } from '$lib/loader.svelte';
	import { OP_SYMBOL, type TagFilter, type TagOp } from '$lib/queryFilter.svelte';

	let {
		initial,
		onapply
	}: {
		initial?: TagFilter;
		onapply: (filter: TagFilter) => void;
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

	const keys = new Loader<KeyRow[]>();
	const values = new Loader<ValueRow[]>();
	const keyRows = $derived(keys.data ?? []);
	const valueRows = $derived(values.data ?? []);

	const scope = () => ({ serverName: ctx.server, databaseName: ctx.db });

	$effect(() => {
		if (step !== 'key') return;
		const request = scope();
		return keys.load(
			(signal) =>
				statementClient
					.listTagKeys(request, { signal })
					.then((res) => res.keys.map((k) => ({ key: k.key, valueCount: Number(k.valueCount) }))),
			{ keepData: true }
		);
	});

	$effect(() => {
		if (step !== 'value' || !key) return;
		const request = { ...scope(), key };
		return values.load((signal) =>
			statementClient
				.listTagValues(request, { signal })
				.then((res) => res.values.map((v) => ({ value: v.value, statementCount: Number(v.statementCount) })))
		);
	});

	const canApply = $derived(anyValue || picked.length > 0);

	function selectKey(k: string) {
		key = k;
		step = 'value';
		picked = [];
		anyValue = false;
	}

	function toggleAny() {
		anyValue = !anyValue;
		if (anyValue) picked = [];
	}

	function toggleValue(v: string) {
		anyValue = false;
		picked = picked.includes(v) ? picked.filter((p) => p !== v) : [...picked, v];
	}

	function apply() {
		if (!canApply) return;
		onapply(anyValue ? { key, op: 'exists', values: [] } : { key, op, values: picked });
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && e.metaKey) {
			e.preventDefault();
			apply();
		}
	}

	const searchCls = 'flex items-center gap-2 border-b border-line px-2.5 py-2';
	const inputCls = 'w-full border-none bg-transparent font-mono text-sm text-ink outline-none';
	const rowCls =
		'flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 font-mono text-sm text-ink data-[selected]:bg-hover';
	const boxCls = 'flex size-3.5 flex-none items-center justify-center border border-line-bold';
	const emptyCls = 'px-2.5 py-2.5 font-mono text-sm text-ink/70';
</script>

{#if step === 'key'}
	<Command.Root filter={containsFilter}>
		<div class={searchCls}>
			<SearchIcon class="size-3.5 flex-none text-ink/55" />
			<Command.Input autofocus placeholder="Find a tag key…" aria-label="Find a tag key" class={inputCls} />
		</div>
		<Command.List aria-label="Tag keys" class="max-h-[17.5rem] overflow-y-auto p-1.5">
			<Command.Viewport>
				{#each keyRows as k (k.key)}
					<Command.Item value={k.key} onSelect={() => selectKey(k.key)} class={rowCls}>
						<span class="flex-1 text-left">{k.key}</span>
						<span class="text-xs text-ink/70">{k.valueCount}</span>
					</Command.Item>
				{/each}
				<Command.Empty class={emptyCls}>
					{keys.loading ? 'Loading…' : (keys.error ?? (keyRows.length > 0 ? 'No matching tag keys' : 'No tags found'))}
				</Command.Empty>
			</Command.Viewport>
		</Command.List>
	</Command.Root>
{:else}
	<Command.Root filter={containsFilter} {onkeydown}>
		<div class="flex items-center gap-2 border-b border-line px-2 py-2">
			<button
				type="button"
				onclick={() => (step = 'key')}
				aria-label="Back to tag keys"
				class="cursor-pointer p-1 text-ink/55 hover:text-ink"
			>
				<ChevronLeftIcon class="size-3.5" />
			</button>
			<span class="flex-1 font-mono text-sm font-semibold text-ink">{key}</span>
			<div class="flex border border-line-strong">
				{#each ['eq', 'ne'] as const as o (o)}
					<button
						type="button"
						disabled={anyValue}
						onclick={() => (op = o)}
						title={anyValue ? 'Any value has no negated form' : `Match ${OP_SYMBOL[o]}`}
						class="px-2.5 py-1 font-mono text-xs {anyValue
							? 'cursor-not-allowed text-ink/25'
							: op === o
								? 'cursor-pointer bg-command text-paper'
								: 'cursor-pointer text-ink/70 hover:bg-hover'}"
					>
						{OP_SYMBOL[o]}
					</button>
				{/each}
			</div>
		</div>

		<div class={searchCls}>
			<SearchIcon class="size-3.5 flex-none text-ink/55" />
			<Command.Input autofocus placeholder="Find a value…" aria-label="Find a tag value" class={inputCls} />
		</div>

		<Command.List aria-label="Tag values" class="max-h-[15rem] overflow-y-auto p-1.5">
			<Command.Viewport>
				<Command.Item forceMount value="Any value" onSelect={toggleAny} aria-checked={anyValue} class={rowCls}>
					<span class={boxCls}>
						{#if anyValue}<CheckIcon class="size-3 text-command" />{/if}
					</span>
					<span class="flex-1 text-left text-ink/70 italic">Any value</span>
				</Command.Item>

				{#each valueRows as v (v.value)}
					<Command.Item
						value={v.value}
						onSelect={() => toggleValue(v.value)}
						aria-checked={picked.includes(v.value)}
						class="{rowCls} {anyValue ? 'opacity-40' : ''}"
					>
						<span class={boxCls}>
							{#if picked.includes(v.value)}<CheckIcon class="size-3 text-command" />{/if}
						</span>
						<span class="flex-1 truncate text-left">{v.value}</span>
						<span class="text-xs text-ink/70">{v.statementCount}</span>
					</Command.Item>
				{/each}
				<Command.Empty class={emptyCls}>
					{values.loading ? 'Loading…' : (values.error ?? (valueRows.length > 0 ? 'No matching values' : 'No values'))}
				</Command.Empty>
			</Command.Viewport>
		</Command.List>

		<div class="border-t border-line p-2">
			<button
				type="button"
				onclick={apply}
				disabled={!canApply}
				class="w-full py-2 text-center font-sans text-md font-semibold {canApply
					? 'cursor-pointer bg-command text-paper hover:bg-danger'
					: 'cursor-not-allowed bg-hover-strong text-ink/35'}"
			>
				Apply filter
			</button>
		</div>
	</Command.Root>
{/if}
