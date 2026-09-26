import { timestampDate } from '@bufbuild/protobuf/wkt';
import type { MetricPoint } from '$lib/gen/querysheriff/v1/common_pb';

export type MetricSeriesPoint = { at: Date; value: number };

export type MetricSeriesRow = { at: Date; values: number[] };

type MetricChartModel = {
	rows: MetricSeriesRow[];
	xFrom: Date;
	xTo: Date;
	step: number;
};

export function toSeriesPoints(points: MetricPoint[] = [], scale = 1): MetricSeriesPoint[] {
	return points.flatMap((p) => (p.at ? [{ at: timestampDate(p.at), value: p.value * scale }] : []));
}

// A zero step would never advance the grid loop below.
function resolveStep(fromMs: number, toMs: number, bucketMs: number): number {
	return bucketMs > 0 ? bucketMs : Math.max(60_000, (toMs - fromMs) / 60);
}

// Fills every step slot across the range, so a bucket with no data plots as 0.
export function buildMetricChartModel(
	series: MetricSeriesPoint[][],
	from: Date,
	to: Date,
	bucketMs: number
): MetricChartModel {
	const fromMs = from.getTime();
	const toMs = to.getTime();
	const step = resolveStep(fromMs, toMs, bucketMs);

	const times = new Set<number>();
	for (const points of series) {
		for (const p of points) times.add(p.at.getTime());
	}
	if (!times.size) return { rows: [], xFrom: from, xTo: to, step };

	const first = Math.min(...times);
	const last = Math.max(...times);
	const gridFrom = first - Math.max(0, Math.ceil((first - fromMs) / step)) * step;
	const gridTo = last + Math.max(0, Math.floor((toMs - last) / step)) * step;
	for (let t = gridFrom; t <= gridTo; t += step) times.add(t);

	const lookups = series.map((points) => new Map(points.map((p) => [p.at.getTime(), p.value])));
	const rows = [...times]
		.sort((a, b) => a - b)
		.map((t) => ({ at: new Date(t), values: lookups.map((m) => m.get(t) ?? 0) }));

	return { rows, xFrom: new Date(gridFrom), xTo: new Date(gridTo), step };
}
