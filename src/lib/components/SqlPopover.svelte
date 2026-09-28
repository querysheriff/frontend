<script module lang="ts">
	import { Tooltip } from 'bits-ui';

	export type SqlContext = { pid: number; app: string };
	/** What a trigger shows: the query itself, or the id to fetch it by. */
	export type SqlPayload = { text: string; context?: SqlContext } | { id: bigint };
	export type SqlTether = Tooltip.Tether<SqlPayload>;
</script>

<script lang="ts">
	import { CopyIcon } from '@lucide/svelte';

	let {
		tether,
		load = () => Promise.reject(new Error('No query loader'))
	}: { tether: SqlTether; load?: (id: bigint) => Promise<string> } = $props();

	// The text replaces its promise once fetched, so a second hover renders without a loading flash.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- filled while rendering, where state writes throw
	const fetched = new Map<bigint, string | Promise<string>>();
	let copied = $state(false);

	function queryText(payload: SqlPayload): string | Promise<string> {
		if ('text' in payload) return payload.text;
		const { id } = payload;
		let text = fetched.get(id);
		if (text === undefined) {
			text = load(id).then(
				(t) => (fetched.set(id, t), t),
				(e: unknown) => {
					fetched.delete(id);
					throw e;
				}
			);
			fetched.set(id, text);
		}
		return text;
	}

	function copy(text: string) {
		navigator.clipboard.writeText(text).then(
			() => (copied = true),
			() => {}
		);
	}
</script>

{#snippet header(text?: string)}
	<div class="flex flex-none items-center justify-between gap-3 border-b border-paper/14 px-3 py-2.5">
		<span class="font-sans text-2xs font-semibold text-paper/55">Full query</span>
		{#if text}
			<button
				type="button"
				onclick={() => copy(text)}
				class="inline-flex cursor-pointer items-center gap-1.5 bg-command px-3 py-1.5 font-sans text-xs font-bold whitespace-nowrap text-paper hover:bg-danger"
			>
				<CopyIcon class="size-3 stroke-[2.2]" />
				<span>{copied ? 'Copied' : 'Copy'}</span>
			</button>
		{/if}
	</div>
{/snippet}

<Tooltip.Provider delayDuration={400} ignoreNonKeyboardFocus>
	<Tooltip.Root {tether} onOpenChange={() => (copied = false)}>
		{#snippet children({ payload })}
			{#if payload}
				<Tooltip.Portal>
					<Tooltip.Content
						side="bottom"
						align="start"
						sideOffset={6}
						collisionPadding={12}
						class="z-50 flex max-h-[min(440px,var(--bits-tooltip-content-available-height))] w-[440px] max-w-[calc(100vw-24px)] flex-col border border-line-boldest bg-ink shadow-sql"
					>
						{#await queryText(payload)}
							{@render header()}
							<div class="flex-1 px-3.5 py-3.5 font-mono text-sm text-paper/55">Loading…</div>
						{:then text}
							{@render header(text)}
							{#if 'context' in payload && payload.context}
								{@const c = payload.context}
								<div
									class="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-paper/14 px-3 py-2 font-mono text-xs leading-[1.4]"
								>
									<span class="text-paper">pid {c.pid}</span>
									{#if c.app}<span class="text-paper/70">{c.app}</span>{/if}
								</div>
							{/if}
							<code
								class="block min-h-0 flex-1 overflow-auto px-3.5 py-3.5 font-mono text-sm leading-[1.7] break-words whitespace-pre-wrap text-paper"
								>{text}</code
							>
						{:catch}
							{@render header()}
							<div class="flex-1 px-3.5 py-3.5 font-mono text-sm text-danger-on-ink">Failed to load query.</div>
						{/await}
					</Tooltip.Content>
				</Tooltip.Portal>
			{/if}
		{/snippet}
	</Tooltip.Root>
</Tooltip.Provider>
