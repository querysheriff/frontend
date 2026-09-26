<script lang="ts">
	let {
		text,
		size = 'sm',
		title,
		class: klass = ''
	}: {
		text: string;
		size?: 'sm' | 'md';
		title?: string;
		class?: string;
	} = $props();

	const cls = $derived(
		`border border-steel/28 bg-steel/10 font-mono whitespace-nowrap text-steel-text ${
			size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-px text-2xs'
		}`
	);
</script>

<span class="{cls} {klass}" {title}>{text}</span>
