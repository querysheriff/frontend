import { ctx } from './state.svelte';

/** layerchart's BrushState, narrowed to what the handler below touches. */
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

/**
 * Drag-to-zoom for every time chart in the app, defined once so the gesture, the styling and
 * the resulting range are identical everywhere. The drag area is already exactly the plot:
 * BrushContext's root is inset by the chart's padding.
 *
 * `brushing` is exposed so a chart can hide its crosshair and tooltip mid-drag — otherwise the
 * tooltip sits under the cursor you are dragging with.
 *
 * @param step bucket width, read lazily; a drag narrower than one bucket is a stray click.
 */
export function createTimeBrush(step: () => number) {
	let brushing = $state(false);

	return {
		get brushing() {
			return brushing;
		},
		props: {
			axis: 'x' as const,
			classes: {
				// A neutral tint, not the terracotta accent: a selection is a viewport, not an
				// action. Hairline sides because layerchart's default resolves to `currentColor`.
				range: 'bg-hover-strong border-x border-line-bold',
				// Painting the edge handles reads as a thick coloured border, so they stay
				// invisible and simply remain drag targets.
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
