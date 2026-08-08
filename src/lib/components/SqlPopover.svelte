<script lang="ts">
	import { CopyIcon } from '@lucide/svelte';
	import { POPOVER_WIDTH, type SqlPopoverState } from '$lib/sqlPopover.svelte';

	let { state }: { state: SqlPopoverState } = $props();

	// Capture, because scroll does not bubble: the query tables sit in their own
	// overflow containers, and a listener on window alone would miss those.
	$effect(() => {
		const opts = { capture: true, passive: true } as const;
		document.addEventListener('scroll', state.reflow, opts);
		window.addEventListener('resize', state.reflow);
		return () => {
			document.removeEventListener('scroll', state.reflow, opts);
			window.removeEventListener('resize', state.reflow);
			state.destroy();
		};
	});
</script>

{#if state.pop}
	<div
		role="tooltip"
		onmouseenter={state.keep}
		onmouseleave={state.hide}
		class="fixed z-50"
		style:left="{state.pop.left}px"
		style:top={state.pop.top != null ? `${state.pop.top}px` : null}
		style:bottom={state.pop.bottom != null ? `${state.pop.bottom}px` : null}
	>
		<div
			class="flex max-w-[calc(100vw-24px)] flex-col border border-line-boldest bg-ink shadow-sql"
			style:width="{POPOVER_WIDTH}px"
			style:max-height="{state.pop.maxHeight}px"
		>
			<div class="flex flex-none items-center justify-between gap-3 border-b border-paper/14 px-3 py-2.5">
				<span class="font-condensed text-2xs font-semibold tracking-[1px] text-paper/55 uppercase">Full query</span>
				{#if !state.pop.loading}
					<button
						type="button"
						onclick={state.copy}
						class="inline-flex cursor-pointer items-center gap-1.5 bg-command px-3 py-1.5 font-condensed text-xs font-bold tracking-[0.6px] whitespace-nowrap text-paper uppercase hover:bg-danger"
					>
						<CopyIcon class="size-3 stroke-[2.2]" />
						<span>{state.copied ? 'Copied' : 'Copy'}</span>
					</button>
				{/if}
			</div>
			{#if state.pop.context}
				{@const c = state.pop.context}
				<!-- Which session ran this, so a wait or a long transaction can be traced
				     back to a process and an application without leaving the table. -->
				<div
					class="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-paper/14 px-3 py-2 font-mono text-xs leading-[1.4]"
				>
					<span class="text-paper">pid {c.pid}</span>
					{#if c.app}<span class="text-paper/70">{c.app}</span>{/if}
				</div>
			{/if}
			{#if state.pop.loading}
				<div class="flex-1 px-3.5 py-3.5 font-mono text-sm text-paper/55">Loading…</div>
			{:else}
				<code
					class="block min-h-0 flex-1 overflow-auto px-3.5 py-3.5 font-mono text-sm leading-[1.7] break-words whitespace-pre-wrap text-paper"
					>{state.pop.text}</code
				>
			{/if}
		</div>
	</div>
{/if}
