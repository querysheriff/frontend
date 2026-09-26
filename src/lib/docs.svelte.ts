class DocsState {
	activeId = $state<string | null>(null);

	toggle = (id: string): void => {
		this.activeId = this.activeId === id ? null : id;
	};

	close = (): void => {
		this.activeId = null;
	};
}

export const docs = new DocsState();
