<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatementTable from './StatementTable.svelte';

	const { Story } = defineMeta({
		title: 'Queries/StatementTable',
		component: StatementTable,
		parameters: { layout: 'fullscreen' }
	});
</script>

<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { StatementSortColumn, StatementStatSchema } from '$lib/gen/querysheriff/v1/statement_pb';
	import { SqlPopoverState } from '$lib/sqlPopover.svelte';
	import type { Sort } from './SortHeader.svelte';

	const sql = new SqlPopoverState(async () => 'SELECT * FROM orders WHERE id = $1');

	const rows = [
		{
			id: 1n,
			preview:
				'SELECT o.id, o.total, o.status, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = $1 ORDER BY o.created_at DESC',
			userName: 'app',
			avgMs: 4630,
			calls: 4220n,
			rows: 8609n,
			pctIo: 10.1,
			pctTime: 17.4,
			tags: { service: 'checkout-api', env: 'production' }
		},
		{
			id: 2n,
			preview: 'SELECT date_trunc($1, created_at) AS bucket, count(*), sum(total) FROM orders GROUP BY 1 ORDER BY 1',
			userName: 'reporting',
			avgMs: 921.3,
			calls: 5610n,
			rows: 39887n,
			pctIo: 15.9,
			pctTime: 10.7
		},
		{
			id: 3n,
			preview: 'UPDATE users SET last_login = now(), visits = visits + 1 WHERE id = $1',
			userName: 'worker',
			avgMs: 6.86,
			calls: 2420n,
			rows: 6800n,
			pctIo: 1.5,
			pctTime: 1.5
		}
	].map((init) => create(StatementStatSchema, init));

	let sort = $state<Sort<StatementSortColumn>>({ column: StatementSortColumn.PCT_TIME, desc: true });
</script>

<Story name="Default">
	{#snippet template()}
		<div class="border border-line-card bg-card">
			<StatementTable {rows} bind:sort {sql} onFilterTag={() => {}} />
		</div>
	{/snippet}
</Story>

<Story name="Empty">
	{#snippet template()}
		<div class="border border-line-card bg-card">
			<StatementTable rows={[]} bind:sort {sql} onFilterTag={() => {}} />
		</div>
	{/snippet}
</Story>
