import { ctx } from './state.svelte';

type BrushLike = {
	active: boolean | undefined;
	x: Array<number | Date | string | null>;
	reset: () => void;
};

function toDate(value: unknown): Date | null {
	if (value instanceof Date) return value;
	if (typeof value === 'number') return new Date(value);

	return null;
}

// Drag-to-zoom shared by every time chart; a drag narrower than one bucket is a stray click.
export function createTimeBrush(step: () => number) {
	let brushing = $state(false);
	let cancelled = false;

	function cancelOnEscape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		cancelled = true;
		window.dispatchEvent(new PointerEvent('pointerup'));
	}

	return {
		get brushing() {
			return brushing;
		},
		props: {
			axis: 'x' as const,
			classes: {
				range: 'bg-hover-strong border-x border-line-bold',
				handle: 'bg-transparent'
			},
			onBrushStart: () => {
				brushing = true;
				cancelled = false;
				window.addEventListener('keydown', cancelOnEscape, { capture: true });
			},
			onBrushEnd: ({ brush }: { brush: BrushLike }) => {
				brushing = false;
				window.removeEventListener('keydown', cancelOnEscape, { capture: true });

				if (cancelled) {
					brush.reset();

					return;
				}

				// A click with no drag is BrushContext's reset gesture, not a selection.
				if (!brush.active) return;

				const from = toDate(brush.x[0]);
				const to = toDate(brush.x[1]);

				if (!from || !to || to.getTime() - from.getTime() < step()) {
					brush.reset();

					return;
				}

				ctx.zoomTo(from, to);
				// The chart's time range is about to change, so clear the selection rectangle.
				brush.reset();
			}
		}
	};
}
