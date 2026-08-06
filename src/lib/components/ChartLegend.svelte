<script lang="ts">
	let { items }: { items: { label: string; color: string; opacity?: number }[] } = $props();
</script>

<div class="mb-2.5 flex h-4 flex-wrap items-center justify-center gap-4">
	{#each items as item (item.label)}
		<div class="flex items-center gap-1.5 font-mono text-xs leading-[1.2] text-ink/70">
			<span class="h-0.5 w-4" style:background={item.color} style:opacity={item.opacity ?? 1}></span>{item.label}
		</div>
	{/each}
</div>
