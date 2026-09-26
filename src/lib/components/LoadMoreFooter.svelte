<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import StateBlock from '$lib/components/StateBlock.svelte';
	import type { PagedLoader } from '$lib/loader.svelte';

	let {
		list,
		empty
	}: {
		list: Pick<PagedLoader<unknown>, 'rows' | 'hasMore' | 'loading' | 'loadingMore' | 'error' | 'loadMore'>;
		empty: string;
	} = $props();
</script>

{#if list.loading && list.rows.length === 0}
	<StateBlock class="px-4 py-6" message="Loading…" />
{:else if list.error}
	<StateBlock kind="error" class="px-4 py-6" message={list.error} />
{:else if list.rows.length === 0}
	<StateBlock class="px-4 py-6" message={empty} />
{/if}
{#if list.hasMore}
	<div class="border-t border-line-soft p-3 text-center">
		<Button variant="ghost" onclick={() => list.loadMore()} disabled={list.loadingMore}>
			{list.loadingMore ? 'Loading…' : 'Load more'}
		</Button>
	</div>
{/if}
