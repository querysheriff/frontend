<script lang="ts">
	import type { Snippet } from 'svelte';
	let { for: forId, class: klass = '', children }: { for?: string; class?: string; children: Snippet } = $props();
</script>

<label class="mb-1.5 block font-sans text-2xs font-semibold text-ink/70 {klass}" for={forId}>
	{@render children()}
</label>
