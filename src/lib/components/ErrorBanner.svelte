<script lang="ts">
	import { CircleAlertIcon } from '@lucide/svelte';
	let { message, class: klass = '' }: { message: string; class?: string } = $props();
</script>

<div role="alert" class="flex items-center gap-2 border border-danger/30 bg-danger/8 text-sm text-danger {klass}">
	<CircleAlertIcon class="size-3.5 flex-none" />
	<span>{message}</span>
</div>
