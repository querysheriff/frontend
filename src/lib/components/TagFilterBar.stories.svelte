<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TagFilterBar from './TagFilterBar.svelte';

	const { Story } = defineMeta({
		title: 'Queries/TagFilterBar',
		component: TagFilterBar,
		parameters: { layout: 'fullscreen' }
	});
</script>

<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { statementClient } from '$lib/connect';
	import { ListTagKeysResponseSchema, ListTagValuesResponseSchema } from '$lib/gen/querysheriff/v1/statement_pb';
	import { QueryFilterState, type TagFilter } from '$lib/queryFilter.svelte';

	const TAGS: Record<string, [string, number][]> = {
		service: [
			['checkout-api', 42],
			['billing-worker', 17],
			['search', 9]
		],
		env: [
			['production', 61],
			['staging', 7]
		],
		region: [
			['eu-central-1', 38],
			['us-east-1', 30]
		],
		team: [
			['payments', 25],
			['growth', 12]
		]
	};

	statementClient.listTagKeys = async () =>
		create(ListTagKeysResponseSchema, {
			keys: Object.entries(TAGS).map(([key, values]) => ({ key, valueCount: BigInt(values.length) }))
		});
	statementClient.listTagValues = async ({ key }) =>
		create(ListTagValuesResponseSchema, {
			values: (TAGS[key ?? ''] ?? []).map(([value, n]) => ({ value, statementCount: BigInt(n) }))
		});

	const eq = (key: string, ...values: string[]): TagFilter => ({ key, op: 'eq', values });

	function make(tags: TagFilter[] = [], kinds?: Partial<Record<'reads' | 'writes' | 'others', boolean>>) {
		const s = new QueryFilterState();
		for (const t of tags) s.add(t);
		if (kinds) Object.assign(s.kinds, kinds);
		return s;
	}

	const empty = make();
	const withFilters = make([eq('service', 'checkout-api'), eq('env', 'production')]);
	const many = make([
		eq('service', 'checkout-api'),
		eq('env', 'production'),
		eq('region', 'eu-central-1'),
		eq('team', 'payments'),
		eq('tier', 'critical'),
		eq('version', 'v2')
	]);
	const readsOnly = make([], { writes: false, others: false });
</script>

{#snippet card(filters: QueryFilterState, searchText: string)}
	<div class="border border-line-card bg-card">
		<TagFilterBar {filters} {searchText} />
	</div>
{/snippet}

<Story name="Empty">
	{#snippet template()}{@render card(empty, '')}{/snippet}
</Story>

<Story name="With filters">
	{#snippet template()}{@render card(withFilters, '')}{/snippet}
</Story>

<Story name="Many filters (wrap)">
	{#snippet template()}{@render card(many, 'orders')}{/snippet}
</Story>

<Story name="Reads only">
	{#snippet template()}{@render card(readsOnly, '')}{/snippet}
</Story>
