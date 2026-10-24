import { describe, expect, test } from 'vitest';
import { QueryKind, TagFilterOperator } from '$lib/gen/querysheriff/v1/statement_pb';
import { OP_SYMBOL, QueryFilterState, type TagFilter } from './queryFilter.svelte';

const eq = (key: string, ...values: string[]): TagFilter => ({ key, op: 'eq', values });

test('starts with no search, no tags and every query kind', () => {
	expect(new QueryFilterState().toRequest()).toEqual({
		search: '',
		tagFilters: [],
		kinds: [QueryKind.READS, QueryKind.WRITES, QueryKind.OTHERS]
	});
});

test('OP_SYMBOL shows each operator', () => {
	expect(OP_SYMBOL).toEqual({ eq: '=', ne: '!=', exists: 'exists' });
});

describe('add', () => {
	test('ignores keys the backend would reject', () => {
		const filters = new QueryFilterState();
		for (const key of ['Env', '1env', 'e-nv', '', '_env']) filters.add(eq(key, 'x'));

		expect(filters.tags).toEqual([]);
	});

	test('a second filter on the same key and operator replaces the first', () => {
		const filters = new QueryFilterState();
		filters.add(eq('env', 'prod'));
		filters.add(eq('team', 'core'));
		filters.add(eq('env', 'staging'));

		expect(filters.tags).toEqual([eq('env', 'staging'), eq('team', 'core')]);
	});

	test('the same key with another operator is a separate filter', () => {
		const filters = new QueryFilterState();
		filters.add(eq('env', 'prod'));
		filters.add({ key: 'env', op: 'ne', values: ['dev'] });

		expect(filters.tags).toHaveLength(2);
	});
});

test('replace swaps a filter in place and drops another one on the same key and operator', () => {
	const filters = new QueryFilterState();
	filters.add(eq('env', 'prod'));
	filters.add(eq('team', 'core'));
	filters.replace(1, eq('env', 'dev'));

	expect(filters.tags).toEqual([eq('env', 'dev')]);
});

test('remove and clear drop filters', () => {
	const filters = new QueryFilterState();
	filters.add(eq('env', 'prod'));
	filters.add(eq('team', 'core'));

	filters.remove(0);
	expect(filters.tags).toEqual([eq('team', 'core')]);

	filters.clear();
	expect(filters.tags).toEqual([]);
});

test('toRequest maps operators and kinds to the proto enums', () => {
	const filters = new QueryFilterState();
	filters.text = 'orders';
	filters.add(eq('env', 'prod', 'staging'));
	filters.add({ key: 'team', op: 'ne', values: ['core'] });
	filters.add({ key: 'job', op: 'exists', values: ['ignored'] });
	filters.kinds.writes = false;

	expect(filters.toRequest()).toEqual({
		search: 'orders',
		tagFilters: [
			{ key: 'env', op: TagFilterOperator.EQUAL, values: ['prod', 'staging'] },
			{ key: 'team', op: TagFilterOperator.NOT_EQUAL, values: ['core'] },
			{ key: 'job', op: TagFilterOperator.EXISTS, values: [] }
		],
		kinds: [QueryKind.READS, QueryKind.OTHERS]
	});
});
