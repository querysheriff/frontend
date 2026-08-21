import { SvelteMap } from 'svelte/reactivity';

// Shared with SqlPopover.svelte so the positioning math and rendered element stay in sync.
export const POPOVER_WIDTH = 440;

const SHOW_DELAY_MS = 400;
const HIDE_GRACE_MS = 140;
const MARGIN = 12;
const GAP = 6;
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 440;
const FLIP_THRESHOLD = 360;

export type SqlContext = { pid: number; app: string };

type Placement = {
	text: string;
	loading: boolean;
	context: SqlContext | null;
	left: number;
	top: number | null;
	bottom: number | null;
	maxHeight: number;
};

type Loader = (id: bigint) => Promise<string>;

export class SqlPopoverState {
	pop = $state<Placement | null>(null);
	copied = $state(false);
	#showTimer: ReturnType<typeof setTimeout> | null = null;
	#hideTimer: ReturnType<typeof setTimeout> | null = null;
	#reflowQueued = false;
	#trigger: HTMLElement | null = null;
	#loader: Loader | null;
	#cache = new SvelteMap<string, string>();
	#activeKey: string | null = null;
	#context: SqlContext | null = null;

	constructor(loader?: Loader) {
		this.#loader = loader ?? null;
	}

	#clearShow() {
		if (this.#showTimer) {
			clearTimeout(this.#showTimer);
			this.#showTimer = null;
		}
	}

	#clearHide() {
		if (this.#hideTimer) {
			clearTimeout(this.#hideTimer);
			this.#hideTimer = null;
		}
	}

	show(text: string, e: MouseEvent | FocusEvent, context?: SqlContext) {
		this.#clearShow();
		this.#clearHide();
		this.#activeKey = null;
		this.#context = context ?? null;

		// currentTarget is nulled once the event finishes dispatching, so hold the element.
		const trigger = e.currentTarget as HTMLElement;
		if (this.pop) {
			this.#place(text, trigger, true, false);
			return;
		}

		this.#showTimer = setTimeout(() => {
			this.#showTimer = null;
			this.#place(text, trigger, true, false);
		}, SHOW_DELAY_MS);
	}

	showLazy(id: bigint, e: MouseEvent | FocusEvent) {
		this.#clearShow();
		this.#context = null;
		this.#clearHide();

		const key = String(id);
		const trigger = e.currentTarget as HTMLElement;
		this.#activeKey = key;
		this.#fetch(key, id);

		const open = () => {
			const text = this.#cache.get(key);
			this.#place(text ?? '', trigger, true, text === undefined);
		};

		if (this.pop) {
			open();
			return;
		}

		this.#showTimer = setTimeout(() => {
			this.#showTimer = null;
			open();
		}, SHOW_DELAY_MS);
	}

	#fetch(key: string, id: bigint) {
		if (!this.#loader || this.#cache.has(key)) return;
		this.#loader(id).then(
			(text) => this.#resolve(key, text),
			() => this.#resolve(key, 'Failed to load query.', true)
		);
	}

	#resolve(key: string, text: string, isError = false) {
		if (!isError) this.#cache.set(key, text);
		if (this.#activeKey === key && this.pop && this.#trigger) {
			this.#place(text, this.#trigger, false, false);
		}
	}

	#place(text: string, trigger: HTMLElement, fresh: boolean, loading: boolean) {
		const r = trigger.getBoundingClientRect();

		// A trigger re-rendered away or scrolled off measures as a zero rect, pinning it to the corner.
		const gone = !trigger.isConnected || (r.width === 0 && r.height === 0);
		const offscreen = r.bottom < 0 || r.top > window.innerHeight;
		if (gone || offscreen) {
			this.#reset();
			return;
		}

		const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - MARGIN));
		const spaceBelow = window.innerHeight - r.bottom - MARGIN;
		const spaceAbove = r.top - MARGIN;
		// Flip up when a downward popover would be clipped; anchoring by `bottom` needs no height first.
		const openUp = spaceBelow < FLIP_THRESHOLD && spaceAbove > spaceBelow;
		const maxHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));

		this.#trigger = trigger;
		const context = this.#context;
		this.pop = openUp
			? { text, loading, context, left, top: null, bottom: window.innerHeight - r.top + GAP, maxHeight }
			: { text, loading, context, left, top: r.bottom + GAP, bottom: null, maxHeight };

		if (fresh) this.copied = false;
	}

	#reset() {
		this.pop = null;
		this.copied = false;
		this.#trigger = null;
		this.#activeKey = null;
		this.#context = null;
	}

	// position:fixed, so it does not travel with its row: re-anchor on any scroll or resize.
	reflow = () => {
		if (this.#reflowQueued || !this.pop || !this.#trigger) return;
		this.#reflowQueued = true;
		requestAnimationFrame(() => {
			this.#reflowQueued = false;
			const trigger = this.#trigger;
			const current = this.pop;
			if (!trigger || !current) return;
			this.#place(current.text, trigger, false, current.loading);
		});
	};

	hide = () => {
		this.#clearShow();
		this.#hideTimer = setTimeout(() => this.#reset(), HIDE_GRACE_MS);
	};

	keep = () => {
		this.#clearHide();
	};

	destroy = () => {
		this.#clearShow();
		this.#clearHide();
		this.#reset();
	};

	copy = () => {
		const text = this.pop?.text;
		if (!text || this.pop?.loading) return;
		navigator.clipboard.writeText(text).then(
			() => (this.copied = true),
			() => {}
		);
	};
}
