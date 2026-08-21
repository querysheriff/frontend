<script lang="ts">
	import { DateRangePicker } from 'bits-ui';
	import type { DateRange } from 'bits-ui';

	let {
		value = $bindable(),
		onSubmit
	}: {
		value: DateRange;
		onSubmit?: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			onSubmit?.();
		}
	}

	const fieldCls =
		'flex items-center border border-line-strong bg-paper px-2.5 py-2 font-mono text-sm text-ink focus-within:border-line-boldest';
	const segCls = 'rounded-xs px-0.5 tabular-nums focus:bg-accent focus:text-command focus:outline-none';
</script>

{#snippet segmented(label: string, type: 'start' | 'end')}
	<div class="flex flex-col gap-1">
		<span class="font-sans text-xs text-ink/70">{label}</span>
		<DateRangePicker.Input {type} aria-label="{label} date and time" class={fieldCls}>
			{#snippet children({ segments })}
				{#each segments as { part, value: segValue }, i (i)}
					{#if part === 'literal'}
						<span class="px-px text-ink/70">{segValue}</span>
					{:else}
						<DateRangePicker.Segment {part} class={segCls}>{segValue}</DateRangePicker.Segment>
					{/if}
				{/each}
			{/snippet}
		</DateRangePicker.Input>
	</div>
{/snippet}

<DateRangePicker.Root
	bind:value
	granularity="second"
	hourCycle={24}
	locale="en-GB"
	class="flex flex-col gap-3"
	onkeydown={handleKeydown}
>
	{@render segmented('From', 'start')}
	{@render segmented('To', 'end')}
</DateRangePicker.Root>
