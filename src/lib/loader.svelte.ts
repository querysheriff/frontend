import { errMsg } from './format';

/** Call `load` from an `$effect` and return its result, so a rerun or unmount aborts the request. */
export class Loader<T> {
	data = $state.raw<T | undefined>(undefined);
	loading = $state(true);
	error = $state<string | null>(null);

	load(fetch: (signal: AbortSignal) => Promise<T>, { keepData = false } = {}): () => void {
		const ac = new AbortController();
		if (!keepData) this.data = undefined;
		this.loading = true;
		this.error = null;

		fetch(ac.signal).then(
			(data) => {
				if (ac.signal.aborted) return;
				this.data = data;
				this.loading = false;
			},
			(e: unknown) => {
				if (ac.signal.aborted) return;
				this.error = errMsg(e);
				this.loading = false;
			}
		);

		return () => ac.abort();
	}

	/** Nothing to fetch yet, e.g. no server selected. */
	reset(loading: boolean, error: string | null = null): void {
		this.data = undefined;
		this.loading = loading;
		this.error = error;
	}
}

type Page<T> = { rows: T[]; hasMore: boolean };

// Late-arriving data shifts offsets, so the next page can repeat a row already shown.
function appendUnseen<T>(rows: T[], more: T[], key: (row: T) => unknown): T[] {
	const seen = new Set(rows.map(key));
	return [...rows, ...more.filter((r) => !seen.has(key(r)))];
}

/** An offset-paged list: `load` fetches the first page, `loadMore` appends the next with the same request. */
export class PagedLoader<T> {
	rows = $state.raw<T[]>([]);
	hasMore = $state(false);
	loading = $state(true);
	loadingMore = $state(false);
	error = $state<string | null>(null);

	#fetchPage: ((offset: number, signal: AbortSignal) => Promise<Page<T>>) | null = null;
	#signal: AbortSignal | null = null;
	readonly #key: (row: T) => unknown;

	constructor(key: (row: T) => unknown) {
		this.#key = key;
	}

	load(fetchPage: (offset: number, signal: AbortSignal) => Promise<Page<T>>): () => void {
		const ac = new AbortController();
		this.#fetchPage = fetchPage;
		this.#signal = ac.signal;
		// Rows stay on screen while re-fetching; clearing them would collapse the table and jump the layout.
		this.loading = true;
		this.error = null;

		fetchPage(0, ac.signal).then(
			(page) => {
				if (ac.signal.aborted) return;
				this.rows = page.rows;
				this.hasMore = page.hasMore;
				this.loading = false;
			},
			(e: unknown) => {
				if (ac.signal.aborted) return;
				this.error = errMsg(e);
				this.rows = [];
				this.hasMore = false;
				this.loading = false;
			}
		);

		return () => ac.abort();
	}

	async loadMore(): Promise<void> {
		const fetchPage = this.#fetchPage;
		const signal = this.#signal;
		if (!fetchPage || !signal || this.loading || this.loadingMore || !this.hasMore) return;

		this.loadingMore = true;
		this.error = null;
		try {
			const page = await fetchPage(this.rows.length, signal);
			if (signal.aborted) return;
			this.rows = appendUnseen(this.rows, page.rows, this.#key);
			this.hasMore = page.hasMore;
		} catch (e) {
			if (!signal.aborted) this.error = errMsg(e);
		} finally {
			this.loadingMore = false;
		}
	}

	reset(loading: boolean, error: string | null = null): void {
		this.#fetchPage = null;
		this.rows = [];
		this.hasMore = false;
		this.loading = loading;
		this.error = error;
	}
}
