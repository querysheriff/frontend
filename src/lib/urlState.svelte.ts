import { untrack } from 'svelte';

export interface UrlParams {
	applyQuery(params: URLSearchParams): void;
	writeQuery(params: URLSearchParams): void;
}

// AppShell rebuilds the whole query string from the registered providers, so a param nobody writes is dropped.
class UrlSync {
	#providers = $state<UrlParams[]>([]);

	#push = false;

	pushNext(): void {
		this.#push = true;
	}

	takeMode(): 'push' | 'replace' {
		const mode = this.#push ? 'push' : 'replace';
		this.#push = false;

		return mode;
	}

	// Read untracked: callers register from inside a $effect, which would otherwise re-trigger itself.
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

	queryString(): string {
		const params = new URLSearchParams();
		for (const provider of this.#providers) provider.writeQuery(params);

		return params.toString();
	}
}

export const urlSync = new UrlSync();
