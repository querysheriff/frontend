<script lang="ts">
	let { title, description }: { title: string; description: string } = $props();
</script>

<h2 class="font-sans text-sm leading-[1.15] font-bold text-ink-muted">{title}</h2>
<p class="mt-0.5 text-xs leading-[1.2] text-ink-muted">{description}</p>
