// Run: node src/lib/metricChart.check.ts
import assert from 'node:assert/strict';
import { buildMetricMultiChartModel } from './metricChart.ts';

const MIN = 60_000;
const at = (m: number) => new Date(m * MIN);

const model = buildMetricMultiChartModel(
	[
		[
			{ at: at(3), value: 5 },
			{ at: at(6), value: 7 }
		],
		[{ at: at(4), value: 1 }]
	],
	at(0),
	at(10),
	MIN
);

assert.deepEqual(
	model.rows.map((r) => r.at.getTime() / MIN),
	[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
);
assert.deepEqual(model.rows[3].values, [5, 0]);
assert.deepEqual(model.rows[4].values, [0, 1]);
assert.deepEqual(model.rows[5].values, [0, 0]);
assert.equal(model.xFrom.getTime(), 0);
assert.equal(model.xTo.getTime(), 9 * MIN);

assert.deepEqual(buildMetricMultiChartModel([[]], at(0), at(10), MIN).rows, []);
