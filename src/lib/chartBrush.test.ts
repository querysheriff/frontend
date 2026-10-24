import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTimeBrush } from './chartBrush.svelte';
import { ctx } from './state.svelte';

const MINUTE = 60_000;
const T0 = new Date(Date.UTC(2026, 5, 9, 12, 0));
const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE);

let win: EventTarget;

const selection = (active: boolean | undefined, x: Array<number | Date | string | null>) => ({
	active,
	x,
	reset: vi.fn()
});

function pressKey(key: string): Event {
	const event = new Event('keydown', { cancelable: true });
	Object.defineProperty(event, 'key', { value: key });
	win.dispatchEvent(event);

	return event;
}

const zoomed = () => ctx.isCustom;

beforeEach(() => {
	win = new EventTarget();
	vi.stubGlobal('window', win);
	vi.stubGlobal('PointerEvent', class extends Event {});
	ctx.range = '24h';
	ctx.takeHistoryMode();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

test('brushes along the time axis and reports while a drag is in progress', () => {
	const brush = createTimeBrush(() => MINUTE);
	expect(brush.props.axis).toBe('x');
	expect(brush.brushing).toBe(false);

	brush.props.onBrushStart();
	expect(brush.brushing).toBe(true);

	brush.props.onBrushEnd({ brush: selection(false, []) });
	expect(brush.brushing).toBe(false);
});

describe('ending a drag', () => {
	test('zooms to a selection of at least one bucket, as a history push, and clears it', () => {
		const brush = createTimeBrush(() => MINUTE);
		const sel = selection(true, [at(0), at(5)]);

		brush.props.onBrushStart();
		brush.props.onBrushEnd({ brush: sel });

		expect(ctx.timeRange()).toEqual({ from: at(0), to: at(5) });
		expect(ctx.takeHistoryMode()).toBe('push');
		expect(sel.reset).toHaveBeenCalledOnce();
	});

	test('accepts the selection as epoch milliseconds, and exactly one bucket', () => {
		const brush = createTimeBrush(() => MINUTE);

		brush.props.onBrushEnd({ brush: selection(true, [at(0).getTime(), at(1).getTime()]) });

		expect(ctx.timeRange()).toEqual({ from: at(0), to: at(1) });
	});

	test('treats a selection narrower than one bucket as a stray click', () => {
		const brush = createTimeBrush(() => 5 * MINUTE);
		const sel = selection(true, [at(0), at(4)]);

		brush.props.onBrushEnd({ brush: sel });

		expect(zoomed()).toBe(false);
		expect(sel.reset).toHaveBeenCalledOnce();
	});

	test('reads the bucket size when the drag ends', () => {
		let step = MINUTE;
		const brush = createTimeBrush(() => step);
		step = 10 * MINUTE;

		brush.props.onBrushEnd({ brush: selection(true, [at(0), at(5)]) });

		expect(zoomed()).toBe(false);
	});

	test('leaves a click without a drag to the chart', () => {
		const brush = createTimeBrush(() => MINUTE);
		const sel = selection(false, [at(0), at(5)]);

		brush.props.onBrushEnd({ brush: sel });

		expect(zoomed()).toBe(false);
		expect(sel.reset).not.toHaveBeenCalled();
	});

	test('clears a selection whose ends are not times', () => {
		const brush = createTimeBrush(() => MINUTE);
		const sel = selection(true, ['a', null]);

		brush.props.onBrushEnd({ brush: sel });

		expect(zoomed()).toBe(false);
		expect(sel.reset).toHaveBeenCalledOnce();
	});
});

describe('Escape', () => {
	test('cancels the drag in progress: the pointer is released and nothing zooms', () => {
		const brush = createTimeBrush(() => MINUTE);
		const released = vi.fn();
		win.addEventListener('pointerup', released);
		const sel = selection(true, [at(0), at(5)]);

		brush.props.onBrushStart();
		const escape = pressKey('Escape');
		brush.props.onBrushEnd({ brush: sel });

		expect(escape.defaultPrevented).toBe(true);
		expect(released).toHaveBeenCalledOnce();
		expect(zoomed()).toBe(false);
		expect(sel.reset).toHaveBeenCalledOnce();
	});

	test('other keys do not cancel', () => {
		const brush = createTimeBrush(() => MINUTE);

		brush.props.onBrushStart();
		expect(pressKey('a').defaultPrevented).toBe(false);
		brush.props.onBrushEnd({ brush: selection(true, [at(0), at(5)]) });

		expect(zoomed()).toBe(true);
	});

	test('is only watched during a drag, and a cancel does not carry over to the next one', () => {
		const brush = createTimeBrush(() => MINUTE);

		brush.props.onBrushStart();
		pressKey('Escape');
		brush.props.onBrushEnd({ brush: selection(true, [at(0), at(5)]) });
		expect(pressKey('Escape').defaultPrevented).toBe(false);

		brush.props.onBrushStart();
		brush.props.onBrushEnd({ brush: selection(true, [at(0), at(5)]) });
		expect(zoomed()).toBe(true);
	});
});
