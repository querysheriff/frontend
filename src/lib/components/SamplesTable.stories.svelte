<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SamplesTable, { type SampleRow, type SampleSortCol } from './SamplesTable.svelte';

	const { Story } = defineMeta({
		title: 'Queries/SamplesTable',
		component: SamplesTable,
		parameters: { layout: 'fullscreen' }
	});
</script>

<script lang="ts">
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';

	const sql = new SqlPopoverState(async () => "SELECT u.id FROM users u WHERE u.bio = 'hi there'");

	const samples: SampleRow[] = [
		{
			id: '1',
			ts: 'Jul 19 16:19:28.001',
			short: "SELECT u.id, u.name, u.email FROM users u WHERE u.bio = 'hi there' AND u.status = 'active'",
			tags: { endpoint: '/user/1', request: '1' },
			hasPlan: true,
			durFmt: '6.01ms',
			sev: 'var(--color-ok)'
		},
		{
			id: '2',
			ts: 'Jul 19 16:18:28.001',
			short: "SELECT u.id, u.name, u.email FROM users u WHERE u.bio = 'hi there' AND u.status = 'active'",
			tags: { endpoint: '/user/2', request: '2' },
			hasPlan: true,
			durFmt: '7.01ms',
			sev: 'var(--color-warn)'
		},
		{
			id: '3',
			ts: 'Jul 19 16:17:28.001',
			short: "SELECT u.id, u.name, u.email FROM users u WHERE u.bio = 'hi there' AND u.status = 'active'",
			tags: {},
			hasPlan: false,
			durFmt: '8.01ms',
			sev: 'var(--color-danger)'
		}
	];

	const extraTags = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `${k}=${v}`);

	let sort = $state<{ col: SampleSortCol; dir: 'asc' | 'desc' }>({ col: 'at', dir: 'desc' });
</script>

<Story name="Default">
	{#snippet template()}
		<div class="border border-line-card bg-card">
			<SamplesTable {samples} bind:sort {sql} id="1" hasBaseTags={true} {extraTags} />
		</div>
	{/snippet}
</Story>

<Story name="Empty">
	{#snippet template()}
		<div class="border border-line-card bg-card">
			<SamplesTable samples={[]} bind:sort {sql} id="1" hasBaseTags={false} {extraTags} />
		</div>
	{/snippet}
</Story>
