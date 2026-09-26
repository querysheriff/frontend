<script lang="ts">
	// pev2 is a Vue app; the sandboxed iframe walls off its Vue, Bootstrap and whatever HTML it renders.
	let { planJson, query }: { planJson: string; query: string } = $props();

	let iframeEl = $state<HTMLIFrameElement>();
	let loaded = $state(false);

	$effect(() => {
		if (!loaded || !iframeEl?.contentWindow) return;
		iframeEl.contentWindow.postMessage({ type: 'pev2:plan', planJson, query }, '*');
	});
</script>

<iframe
	bind:this={iframeEl}
	src="/pev2/viewer.html"
	sandbox="allow-scripts"
	title="Explain plan"
	class="h-full w-full border-0"
	onload={() => (loaded = true)}
></iframe>
