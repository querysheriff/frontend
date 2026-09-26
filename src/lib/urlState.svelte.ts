import { untrack } from 'svelte';

export interface UrlParams {
	applyQuery(params: URLSearchParams): void;
	writeQuery(params: URLSearchParams): void;
}

// AppShell rebuilds the whole query string from the registered providers, so a param nobody writes is dropped.
class UrlSync {
	#providers = $state<UrlParams[]>([]);

	#push = false;
	#lastQuery: Record<string, string> = {};

	pushNext(): void {
		this.#push = true;
	}

	takeMode(): 'push' | 'replace' {
		const mode = this.#push ? 'push' : 'replace';
		this.#push = false;

		return mode;
	}

	// Read untracked: registering during component init must not subscribe the caller to the list.
	register(provider: UrlParams): () => void {
		this.#providers = [...untrack(() => this.#providers), provider];

		return () => {
			this.#providers = untrack(() => this.#providers).filter((p) => p !== provider);
		};
	}

	applyQuery(search: string): void {
		const params = new URLSearchParams(search);
		for (const provider of this.#providers) provider.applyQuery(params);
	}

	/** Records the query string last written for a path, so a link back can restore that screen. */
	remember(pathname: string, qs: string): void {
		this.#lastQuery[pathname] = qs;
	}

	hrefFor(pathname: string): string {
		const qs = this.#lastQuery[pathname];
		return qs ? `${pathname}?${qs}` : pathname;
	}

	queryString(): string {
		const params = new URLSearchParams();
		for (const provider of this.#providers) provider.writeQuery(params);

		return params.toString();
	}
}

export const urlSync = new UrlSync();
