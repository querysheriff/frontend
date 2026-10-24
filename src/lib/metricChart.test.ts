import { describe, expect, test } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import type { AnyScale } from 'layerchart';
import { MetricPointSchema } from '$lib/gen/querysheriff/v1/common_pb';
import { buildMetricChartModel, timeAxisTicks, toSeriesPoints } from './metricChart';

const MINUTE = 60_000;
const T0 = new Date(Date.UTC(2026, 5, 9, 12, 0));
const at = (minutes: number): Date => new Date(T0.getTime() + minutes * MINUTE);

describe('toSeriesPoints', () => {
	test('converts points to dates and scales their values', () => {
		const points = [create(MetricPointSchema, { at: timestampFromDate(at(1)), value: 2.5 })];

		expect(toSeriesPoints(points, 1000)).toEqual([{ at: at(1), value: 2500 }]);
	});

	test('drops points without a timestamp', () => {
		const points = [
			create(MetricPointSchema, { value: 5 }),
			create(MetricPointSchema, { at: timestampFromDate(at(2)) })
		];

		expect(toSeriesPoints(points)).toEqual([{ at: at(2), value: 0 }]);
	});

	test('treats a missing series as empty', () => {
		expect(toSeriesPoints()).toEqual([]);
	});
});

describe('buildMetricChartModel', () => {
	test('fills every step across the range, so buckets without data plot as 0', () => {
		const model = buildMetricChartModel(
			[
				[
					{ at: at(3), value: 5 },
					{ at: at(5), value: 7 }
				],
				[{ at: at(4), value: 1 }]
			],
			at(0),
			at(10),
			MINUTE
		);

		expect(model.step).toBe(MINUTE);
		expect(model.xFrom).toEqual(at(0));
		expect(model.xTo).toEqual(at(10));
		expect(model.rows.map((r) => r.at)).toEqual(Array.from({ length: 11 }, (_, i) => at(i)));
		expect(model.rows[3].values).toEqual([5, 0]);
		expect(model.rows[4].values).toEqual([0, 1]);
		expect(model.rows[5].values).toEqual([7, 0]);
		expect(model.rows[0].values).toEqual([0, 0]);
	});

	test('anchors the grid on the data, extending past the range edges to cover them', () => {
		const model = buildMetricChartModel([[{ at: new Date(at(3).getTime() + 30_000), value: 1 }]], at(0), at(5), MINUTE);

		expect(model.xFrom).toEqual(new Date(at(0).getTime() - 30_000));
		expect(model.xTo).toEqual(new Date(at(4).getTime() + 30_000));
		expect(model.rows.every((r, i) => i === 0 || r.at.getTime() - model.rows[i - 1].at.getTime() === MINUTE)).toBe(
			true
		);
	});

	test('returns no rows and the requested range when there is no data', () => {
		expect(buildMetricChartModel([[], []], at(0), at(10), MINUTE)).toEqual({
			rows: [],
			xFrom: at(0),
			xTo: at(10),
			step: MINUTE
		});
	});

	test('without a bucket size, steps a sixtieth of the range but never under a minute', () => {
		expect(buildMetricChartModel([], at(0), at(120), 0).step).toBe(2 * MINUTE);
		expect(buildMetricChartModel([], at(0), at(30), 0).step).toBe(MINUTE);
	});
});

describe('timeAxisTicks', () => {
	const scale = (width: number) => {
		const requested: number[] = [];
		const fake = {
			range: () => [0, width],
			ticks: (count: number) => {
				requested.push(count);
				return [at(0)];
			}
		};

		return { scale: fake as unknown as AnyScale, requested };
	};

	test('asks for about one tick per 80px', () => {
		const { scale: narrow, requested } = scale(400);

		expect(timeAxisTicks(narrow)).toEqual([at(0)]);
		expect(requested).toEqual([5]);
	});

	test('caps wide charts at 8.25 ticks', () => {
		const { scale: wide, requested } = scale(2000);

		timeAxisTicks(wide);
		expect(requested).toEqual([8.25]);
	});

	test('returns undefined for a scale without ticks', () => {
		expect(timeAxisTicks({ range: () => [0, 400] } as unknown as AnyScale)).toBeUndefined();
	});
});
