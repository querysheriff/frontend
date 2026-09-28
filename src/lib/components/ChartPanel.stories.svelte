<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ChartPanel from './ChartPanel.svelte';

	const { Story } = defineMeta({
		title: 'Shared/ChartPanel',
		component: ChartPanel,
		parameters: { layout: 'padded' }
	});
</script>

<Story name="With content">
	{#snippet template()}
		<ChartPanel title="Query volume over time" description="How many queries ran">
			<div
				class="flex h-[15rem] items-center justify-center border border-dashed border-line-strong font-mono text-2xs text-ink-muted"
			>
				[ chart renders here ]
			</div>
		</ChartPanel>
	{/snippet}
</Story>

<Story name="No data">
	{#snippet template()}
		<ChartPanel
			title="Query speed over time"
			description="How long queries took — p90 means roughly 9 in 10 finished faster"
		>
			<div class="flex h-[15rem] items-center justify-center font-mono text-2xs text-ink-muted">No data</div>
		</ChartPanel>
	{/snippet}
</Story>
