import { describe, expect, test, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import { Loader, PagedLoader } from './loader.svelte';

const deferred = <T>() => Promise.withResolvers<T>();

// Lets the loader's .then callbacks run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

type Row = { id: number };
const rows = (...ids: number[]): Row[] => ids.map((id) => ({ id }));

describe('Loader', () => {
	test('starts loading, with no data and no error', () => {
		const loader = new Loader<string>();

		expect(loader.data).toBeUndefined();
		expect(loader.loading).toBe(true);
		expect(loader.error).toBeNull();
	});

	test('stores the result and stops loading', async () => {
		const loader = new Loader<string>();
		loader.load(async () => 'done');
		await settle();

		expect(loader.data).toBe('done');
		expect(loader.loading).toBe(false);
	});

	test('stores the error message and stops loading', async () => {
		const loader = new Loader<string>();
		loader.load(async () => {
			throw new ConnectError('server down', Code.Unavailable);
		});
		await settle();

		expect(loader.error).toBe('server down');
		expect(loader.loading).toBe(false);
	});

	test('the returned function aborts the request, and its late result is ignored', async () => {
		const loader = new Loader<string>();
		const request = deferred<string>();
		let signal: AbortSignal | undefined;

		const stop = loader.load((s) => {
			signal = s;
			return request.promise;
		});
		stop();
		request.resolve('late');
		await settle();

		expect(signal?.aborted).toBe(true);
		expect(loader.data).toBeUndefined();
		expect(loader.loading).toBe(true);
	});

	test('a late error from an aborted request is ignored too', async () => {
		const loader = new Loader<string>();
		const request = deferred<string>();

		loader.load(() => request.promise)();
		request.reject(new Error('aborted'));
		await settle();

		expect(loader.error).toBeNull();
	});

	test('a rerun wins over the request it replaced', async () => {
		const loader = new Loader<string>();
		const first = deferred<string>();

		const stopFirst = loader.load(() => first.promise);
		stopFirst();
		loader.load(async () => 'second');
		first.resolve('first');
		await settle();

		expect(loader.data).toBe('second');
	});

	test('clears the previous data on reload, unless asked to keep it', async () => {
		const loader = new Loader<string>();
		loader.load(async () => 'old');
		await settle();

		loader.load(() => new Promise(() => {}), { keepData: true });
		expect(loader.data).toBe('old');
		expect(loader.loading).toBe(true);
		expect(loader.error).toBeNull();

		loader.load(() => new Promise(() => {}));
		expect(loader.data).toBeUndefined();
	});

	test('reset clears the data and sets the given state', async () => {
		const loader = new Loader<string>();
		loader.load(async () => 'data');
		await settle();

		loader.reset(false, 'no server');

		expect(loader.data).toBeUndefined();
		expect(loader.loading).toBe(false);
		expect(loader.error).toBe('no server');
	});
});

describe('PagedLoader', () => {
	const paged = () => new PagedLoader<Row>((r) => r.id);

	test('loads the first page from offset 0', async () => {
		const loader = paged();
		const fetchPage = vi.fn(async () => ({ rows: rows(1, 2), hasMore: true }));

		loader.load(fetchPage);
		await settle();

		expect(fetchPage).toHaveBeenCalledWith(0, expect.any(AbortSignal));
		expect(loader.rows).toEqual(rows(1, 2));
		expect(loader.hasMore).toBe(true);
		expect(loader.loading).toBe(false);
	});

	test('keeps the old rows on screen while reloading', async () => {
		const loader = paged();
		loader.load(async () => ({ rows: rows(1, 2), hasMore: false }));
		await settle();

		loader.load(() => new Promise(() => {}));

		expect(loader.rows).toEqual(rows(1, 2));
		expect(loader.loading).toBe(true);
	});

	test('a failed first page clears the rows and shows the error', async () => {
		const loader = paged();
		loader.load(async () => ({ rows: rows(1), hasMore: true }));
		await settle();

		loader.load(async () => {
			throw new Error('boom');
		});
		await settle();

		expect(loader.rows).toEqual([]);
		expect(loader.hasMore).toBe(false);
		expect(loader.error).toBe('boom');
		expect(loader.loading).toBe(false);
	});

	test('loadMore fetches from the current row count with the same signal and drops repeated rows', async () => {
		const loader = paged();
		const calls: [number, AbortSignal][] = [];
		const fetchPage = async (offset: number, signal: AbortSignal) => {
			calls.push([offset, signal]);
			return offset === 0 ? { rows: rows(1, 2), hasMore: true } : { rows: rows(2, 3), hasMore: false };
		};

		loader.load(fetchPage);
		await settle();
		await loader.loadMore();

		expect(calls.map(([offset]) => offset)).toEqual([0, 2]);
		expect(calls[1][1]).toBe(calls[0][1]);
		expect(loader.rows).toEqual(rows(1, 2, 3));
		expect(loader.hasMore).toBe(false);
		expect(loader.loadingMore).toBe(false);
	});

	test('loadMore does nothing without another page, while loading, or after a reset', async () => {
		const loader = paged();
		const fetchPage = vi.fn(async () => ({ rows: rows(1), hasMore: false }));

		await loader.loadMore();
		expect(fetchPage).not.toHaveBeenCalled();

		loader.load(fetchPage);
		await loader.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(1);

		await settle();
		await loader.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(1);

		loader.reset(false);
		await loader.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});

	test('loadMore runs one page at a time', async () => {
		const loader = paged();
		const next = deferred<{ rows: Row[]; hasMore: boolean }>();
		const fetchPage = vi.fn((offset: number) =>
			offset === 0 ? Promise.resolve({ rows: rows(1), hasMore: true }) : next.promise
		);

		loader.load(fetchPage);
		await settle();

		const first = loader.loadMore();
		expect(loader.loadingMore).toBe(true);
		await loader.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(2);

		next.resolve({ rows: rows(2), hasMore: false });
		await first;
		expect(loader.rows).toEqual(rows(1, 2));
	});

	test('a failed next page keeps the rows and shows the error', async () => {
		const loader = paged();
		loader.load(async (offset) => {
			if (offset > 0) throw new Error('page failed');
			return { rows: rows(1), hasMore: true };
		});
		await settle();

		await loader.loadMore();

		expect(loader.rows).toEqual(rows(1));
		expect(loader.error).toBe('page failed');
		expect(loader.loadingMore).toBe(false);
	});

	test('pages and errors arriving after an abort are ignored', async () => {
		const loader = paged();
		let failNext = false;
		const stop = loader.load(async (offset) => {
			if (offset === 0) return { rows: rows(1), hasMore: true };
			if (failNext) throw new Error('aborted');
			return { rows: rows(2), hasMore: false };
		});
		await settle();

		stop();
		await loader.loadMore();

		expect(loader.rows).toEqual(rows(1));
		expect(loader.hasMore).toBe(true);

		failNext = true;
		await loader.loadMore();

		expect(loader.error).toBeNull();
	});

	test('reset empties the list and sets the given state', async () => {
		const loader = paged();
		loader.load(async () => ({ rows: rows(1), hasMore: true }));
		await settle();

		loader.reset(true, 'no server');

		expect(loader.rows).toEqual([]);
		expect(loader.hasMore).toBe(false);
		expect(loader.loading).toBe(true);
		expect(loader.error).toBe('no server');
	});
});
