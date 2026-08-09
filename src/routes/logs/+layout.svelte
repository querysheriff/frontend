<script lang="ts">
	import DocsShell from '$lib/components/DocsShell.svelte';

	let { children } = $props();
</script>

<DocsShell dbSwitch={false}>
	{@render children()}
</DocsShell>
