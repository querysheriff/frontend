<script lang="ts">
	import ChartFrame from '$lib/components/ChartFrame.svelte';
	import StateBlock from '$lib/components/StateBlock.svelte';

	let { message, error = false }: { message: string; error?: boolean } = $props();
</script>

<ChartFrame>
	<StateBlock kind={error ? 'error' : 'muted'} class="flex h-full items-center justify-center" {message} />
</ChartFrame>
