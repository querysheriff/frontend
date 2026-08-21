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
			},
			onBrushEnd: ({ brush }: { brush: BrushLike }) => {
				brushing = false;

				// A click with no drag is BrushContext's reset gesture, not a selection.
				if (!brush.active) return;

				const from = toDate(brush.x[0]);
				const to = toDate(brush.x[1]);

				if (!from || !to || to.getTime() - from.getTime() < step()) {
					brush.reset();

					return;
				}

				ctx.zoomTo(from, to);
				// The domain is about to change underneath it, so drop the selection.
				brush.reset();
			}
		}
	};
}
