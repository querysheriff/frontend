<script lang="ts">
	import ChartFrame from '$lib/components/ChartFrame.svelte';

	let { message }: { message: string } = $props();
</script>

<ChartFrame>
	<div class="flex h-full items-center justify-center font-mono text-sm text-ink/70">{message}</div>
</ChartFrame>
