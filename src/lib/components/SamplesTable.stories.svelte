<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SamplesTable from './SamplesTable.svelte';

	const { Story } = defineMeta({
		title: 'Queries/SamplesTable',
		component: SamplesTable,
		parameters: { layout: 'fullscreen' }
	});
</script>

<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { timestampFromDate } from '@bufbuild/protobuf/wkt';
	import { SampleSortColumn, StatementSampleSchema } from '$lib/gen/querysheriff/v1/statement_pb';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import type { Sort } from './SortHeader.svelte';

	const sql = new SqlPopoverState(async () => "SELECT u.id FROM users u WHERE u.bio = 'hi there'");

	const preview = "SELECT u.id, u.name, u.email FROM users u WHERE u.bio = 'hi there' AND u.status = 'active'";
	const samples = [
		{ id: 1n, durationMs: 6.01, hasPlan: true, tags: { endpoint: '/user/1', request: '1' } },
		{ id: 2n, durationMs: 1700, hasPlan: true, tags: { endpoint: '/user/2', request: '2' } },
		{ id: 3n, durationMs: 12_000, hasPlan: false }
	].map((init, i) =>
		create(StatementSampleSchema, {
			...init,
			preview,
			occurredAt: timestampFromDate(new Date(Date.UTC(2026, 6, 19, 16, 19 - i, 28, 1)))
		})
	);

	const baseTags = { app: 'web' };

	let sort = $state<Sort<SampleSortColumn>>({ column: SampleSortColumn.AT, desc: true });
</script>

<Story name="Default">
	{#snippet template()}
		<div class="border border-line-card bg-card">
			<SamplesTable {samples} bind:sort {sql} statementId="1" {baseTags} />
		</div>
	{/snippet}
</Story>

<Story name="Empty">
	{#snippet template()}
		<div class="border border-line-card bg-card">
			<SamplesTable samples={[]} bind:sort {sql} statementId="1" baseTags={{}} />
		</div>
	{/snippet}
</Story>
