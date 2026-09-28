<script lang="ts">
	type Props = { kind?: 'muted' | 'error'; message: string; class?: string };
	let { kind = 'muted', message, class: klass = '' }: Props = $props();
</script>

<div class="text-center font-mono text-sm {kind === 'error' ? 'text-danger-text' : 'text-ink-muted'} {klass}">
	{message}
</div>
