<script lang="ts">
	import { clsx } from 'clsx';
	import type { Snippet } from 'svelte';
	import { InfoIcon } from '@lucide/svelte';
	import { docs } from '$lib/docs.svelte';
	import { docEntry } from '$lib/docsContent';

	let { id, class: klass = '', children }: { id?: string; class?: string; children: Snippet } = $props();

	const active = $derived(id != null && docs.activeId === id);
	const dimmed = $derived(id != null && docs.activeId != null && docs.activeId !== id);
	const title = $derived((id && docEntry(id)?.title) || 'this card');
</script>

<section
	class={clsx(
		'relative border border-line-card bg-card transition-[opacity,box-shadow] duration-150',
		active && 'shadow-chart ring-2 ring-command ring-offset-2 ring-offset-paper',
		dimmed && 'opacity-50',
		klass
	)}
>
	{#if id}
		<button
			type="button"
			onclick={() => docs.toggle(id)}
			aria-label="About {title}"
			aria-expanded={active}
			title="About this card"
			class={clsx(
				'absolute top-2 right-2 z-[1] flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors',
				active ? 'bg-command text-paper' : 'text-ink/45 hover:bg-hover hover:text-command'
			)}
		>
			<InfoIcon class="size-4" />
		</button>
	{/if}
	{@render children()}
</section>
