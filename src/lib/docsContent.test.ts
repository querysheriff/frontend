import { expect, test } from 'vitest';
import { DOC_ID_SEP, docEntry } from './docsContent';

test('docEntry finds an entry by id', () => {
	expect(docEntry('q-table')?.title).toBe('Queries');
});

test('docEntry ignores the per-instance suffix after the separator', () => {
	expect(docEntry(`a-alerts${DOC_ID_SEP}prod-db-1`)?.title).toBe('Alerts');
});

test('docEntry returns undefined for an unknown id', () => {
	expect(docEntry('nope')).toBeUndefined();
});

test('every card id used on a page has documentation', () => {
	const pages = import.meta.glob<string>('/src/routes/**/*.svelte', { query: '?raw', import: 'default', eager: true });
	const ids = Object.values(pages).flatMap((source) =>
		[...source.matchAll(/(?:docId|<DocCard id)=(?:"([a-z]+-[a-z-]+)"|\{`([a-z]+-[a-z-]+)\$\{DOC_ID_SEP\})/g)].map(
			(m) => m[1] ?? m[2]
		)
	);

	expect(ids.length).toBeGreaterThan(10);
	expect(ids.filter((id) => docEntry(id) === undefined)).toEqual([]);
});
