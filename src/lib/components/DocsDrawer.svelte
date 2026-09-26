<script lang="ts">
	import { XIcon } from '@lucide/svelte';
	import { docs } from '$lib/docs.svelte';
	import { docEntry } from '$lib/docsContent';

	const entry = $derived(docs.activeId ? docEntry(docs.activeId) : null);

	function onKeydown(e: KeyboardEvent) {
		// A popup that handled this Escape (a bits-ui select or dialog) has already prevented it.
		if (e.key === 'Escape' && !e.defaultPrevented && docs.activeId) docs.close();
	}

	// Light inline markup: `code` spans render as <code> and **bold** as <strong>.
	type Seg = { text: string; code?: boolean; bold?: boolean };
	function inlineSegs(text: string): Seg[] {
		const segs: Seg[] = [];
		const re = /`[^`]+`|\*\*[^*]+\*\*/g;
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			if (m.index > last) segs.push({ text: text.slice(last, m.index) });
			const tok = m[0];
			if (tok[0] === '`') segs.push({ text: tok.slice(1, -1), code: true });
			else segs.push({ text: tok.slice(2, -2), bold: true });
			last = m.index + tok.length;
		}
		if (last < text.length) segs.push({ text: text.slice(last) });
		return segs;
	}
</script>

{#snippet inline(text: string)}
	{#each inlineSegs(text) as seg, i (i)}{#if seg.code}<code
				class="rounded-sm bg-hover-strong px-1 font-mono text-[0.85em] text-ink">{seg.text}</code
			>{:else if seg.bold}<strong class="font-semibold text-ink">{seg.text}</strong>{:else}{seg.text}{/if}{/each}
{/snippet}

<svelte:window onkeydown={onKeydown} />

{#if entry}
	<aside
		aria-labelledby="docs-title"
		class="sticky top-0 flex h-screen w-[21rem] max-w-full flex-none flex-col border-l border-line bg-card max-md:fixed max-md:right-0 max-md:z-50 max-md:shadow-drawer"
	>
		<header class="flex min-h-[4.25rem] items-center justify-between gap-3 border-b border-line px-5 py-3.5">
			<h2 id="docs-title" class="min-w-0 font-sans text-lg leading-[1.15] font-bold text-ink">
				{entry.title}
			</h2>
			<button
				type="button"
				onclick={() => docs.close()}
				aria-label="Close documentation"
				class="-mr-1 flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-ink/55 hover:bg-hover hover:text-command"
			>
				<XIcon class="size-5" />
			</button>
		</header>

		<div class="flex-1 overflow-y-auto px-5 py-4">
			{#each entry.sections as section (section.heading)}
				<section class="mb-5 last:mb-0">
					<h3 class="mb-1.5 font-sans text-2xs font-bold text-command">
						{section.heading}
					</h3>
					{#each section.body as block, i (i)}
						{#if typeof block === 'string'}
							<p class="mb-2 text-sm leading-[1.55] text-ink/80 last:mb-0">{@render inline(block)}</p>
						{:else}
							<ul class="mb-2 ml-4 list-disc space-y-1 text-sm leading-[1.5] text-ink/80 last:mb-0 marker:text-ink/40">
								{#each block.list as item (item)}
									<li>{@render inline(item)}</li>
								{/each}
							</ul>
						{/if}
					{/each}
				</section>
			{/each}
		</div>
	</aside>
{/if}
