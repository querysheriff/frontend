<script lang="ts">
	import DocsShell from '$lib/components/DocsShell.svelte';

	let { children } = $props();
</script>

<DocsShell contextBar={false}>
	{@render children()}
</DocsShell>
