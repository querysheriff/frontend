<script lang="ts">
	import type { Snippet } from 'svelte';

	let { class: klass = '', children }: { class?: string; children: Snippet } = $props();

	const FADE = '1.25rem';

	let port = $state<HTMLDivElement | null>(null);
	let strip = $state<HTMLDivElement | null>(null);
	let more = $state(false);
	let back = $state(false);

	function measure() {
		if (!port) return;
		back = port.scrollLeft > 1;
		more = port.scrollLeft + port.clientWidth < port.scrollWidth - 1;
	}

	// Watch both: the visible box resizes with the column, the strip with the tag list.
	$effect(() => {
		if (!port || !strip) return;
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(port);
		ro.observe(strip);
		return () => ro.disconnect();
	});

	const mask = $derived(
		back && more
			? `linear-gradient(to right, transparent 0, black ${FADE}, black calc(100% - ${FADE}), transparent 100%)`
			: more
				? `linear-gradient(to right, black calc(100% - ${FADE}), transparent 100%)`
				: back
					? `linear-gradient(to right, transparent 0, black ${FADE})`
					: 'none'
	);
</script>

<div
	bind:this={port}
	onscroll={measure}
	style:mask-image={mask}
	style:-webkit-mask-image={mask}
	class="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden {klass}"
>
	<div bind:this={strip} class="flex w-max flex-nowrap items-center gap-1.5 [&>*]:flex-none">
		{@render children()}
	</div>
</div>
