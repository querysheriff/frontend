<script lang="ts">
	let { message, offsetTop = 0 }: { message: string; offsetTop?: number } = $props();
</script>

<div class="absolute inset-x-0 bottom-0 z-[2] flex justify-center bg-card" style:top="{offsetTop}px">
	<span class="sticky top-28 h-fit py-7 font-mono text-sm text-ink/70">{message}</span>
</div>
