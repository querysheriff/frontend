<script lang="ts">
	import { XIcon } from '@lucide/svelte';

	let {
		label,
		values,
		active = false,
		onedit,
		onremove
	}: {
		label: string;
		values: string;
		active?: boolean;
		onedit: () => void;
		onremove: () => void;
	} = $props();

	const description = $derived(`${label} = ${values}`);
</script>

<span
	class="flex items-center border bg-card {active
		? 'border-accent-line'
		: 'border-line-strong'} hover:border-accent-line"
>
	<button
		type="button"
		onclick={onedit}
		title={description}
		class="flex cursor-pointer items-center gap-1.5 py-1 pr-1.5 pl-2 font-mono text-sm whitespace-nowrap"
	>
		<span class="text-ink/70">{label}</span>
		<span class="font-semibold text-command">=</span>
		<span class="max-w-[13.75rem] truncate text-ink">{values}</span>
	</button>
	<button
		type="button"
		onclick={onremove}
		aria-label="Remove {description} filter"
		class="cursor-pointer border-l border-line px-1.5 py-1.5 text-ink/55 hover:bg-hover hover:text-danger"
	>
		<XIcon class="size-3" />
	</button>
</span>
