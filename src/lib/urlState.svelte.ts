import { untrack } from 'svelte';

export interface UrlParams {
	applyQuery(params: URLSearchParams): void;
	writeQuery(params: URLSearchParams): void;
}

// AppShell rebuilds the whole query string from the registered providers, so a
// param nobody writes is dropped. Page-scoped providers therefore unregister on
// teardown and their params disappear when you navigate away.
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

	// Callers register from inside a $effect, so the list must be read untracked —
	// otherwise registering re-triggers the very effect that registered.
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
