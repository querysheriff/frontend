<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';

	let { children } = $props();
</script>

<AppShell contextBar={false}>
	{@render children()}
</AppShell>
