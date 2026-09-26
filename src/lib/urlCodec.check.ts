// Run: node src/lib/urlCodec.check.ts
import assert from 'node:assert/strict';
import { decodeList, decodeTagFilter, encodeList, encodeTagFilter, type TagFilter } from './urlCodec.ts';

const roundTrips = [['a'], ['a', 'b'], ['a,b', 'c\\d'], [''], ['postgres', ''], ['', 'postgres'], ['x\\', ',']];
for (const values of roundTrips) assert.deepEqual(decodeList(encodeList(values)), values);

assert.equal(encodeList(['a,b', 'c']), 'a\\,b,c');
assert.deepEqual(decodeList('a,,b'), ['a', '', 'b']);

const tagFilters: TagFilter[] = [
	{ key: 'app', op: 'ne', values: ['a,b', 'c\\'] },
	{ key: 'env', op: 'eq', values: ['prod'] },
	{ key: 'trace_id', op: 'exists', values: [] }
];
for (const filter of tagFilters) assert.deepEqual(decodeTagFilter(encodeTagFilter(filter)), filter);

assert.equal(decodeTagFilter('k!='), null);
assert.equal(decodeTagFilter('K=x'), null);
assert.deepEqual(decodeTagFilter('k=,a')?.values, ['a']);
