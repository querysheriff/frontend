<script lang="ts">
	import type { Snippet } from 'svelte';

	// A single-line strip of query tags. Tags never wrap onto a second line, so a
	// row's height stays tied to its query rather than to how many tags it happens
	// to carry. When they don't all fit the strip scrolls sideways instead of
	// hiding them — the scrollbar itself is suppressed (the app's is 11px, taller
	// than the strip), so the fade is the affordance: it appears only on a side
	// that really has more tags, and clears once you reach the end.
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

	// The port resizes when the column does; the strip resizes when the tags
	// themselves change. Both move the answer, so watch each.
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
