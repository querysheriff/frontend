<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import QueryTextBlock from './QueryTextBlock.svelte';

	const { Story } = defineMeta({
		title: 'Queries/QueryTextBlock',
		component: QueryTextBlock,
		parameters: { layout: 'padded' }
	});

	const sql = `SELECT o.id, o.total, o.status, c.email, c.name, a.line1, a.city
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN addresses a ON a.id = o.shipping_address_id
WHERE o.status = $1 AND o.created_at >= $2
ORDER BY o.created_at DESC
LIMIT $3`;
</script>

<Story name="With SQL">
	{#snippet template()}
		<QueryTextBlock text={sql} />
	{/snippet}
</Story>

<Story name="Loading">
	{#snippet template()}
		<QueryTextBlock placeholder="Loading…" />
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template()}
		<QueryTextBlock placeholder="Invalid query id" error />
	{/snippet}
</Story>
