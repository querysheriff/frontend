import { describe, expect, test } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import {
	avgDurationColor,
	containsFilter,
	durationColor,
	errMsg,
	fmtAxisTime,
	fmtBucketRange,
	fmtBucketSize,
	fmtClockDate,
	fmtClockMinute,
	fmtCount,
	fmtCountFull,
	fmtDateTime,
	fmtDuration,
	fmtRel,
	fmtTs,
	kvTags,
	runDurationColor,
	truncate
} from './format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('fmtDuration', () => {
	test.each([
		[0, '0ms'],
		[0.123, '0.12ms'],
		[12.345, '12.3ms'],
		[999, '999ms'],
		[1000, '1s'],
		[1500, '1.5s'],
		[90_000, '1.5min'],
		[HOUR, '1h'],
		[DAY, '1d'],
		[2.5 * DAY, '2.5d']
	])('%d ms -> %s', (ms, want) => {
		expect(fmtDuration(ms)).toBe(want);
	});
});

describe('fmtCount', () => {
	test.each([
		[0, '0'],
		[0.5, '0.5'],
		[999, '999'],
		[1000, '1K'],
		[1500, '1.5K'],
		[12_345, '12.3K'],
		[1_000_000, '1M'],
		[2.5e9, '2.5B'],
		[-1500, '-1.5K']
	])('%d -> %s', (n, want) => {
		expect(fmtCount(n)).toBe(want);
	});

	test('never strips significant zeros of whole numbers', () => {
		expect(fmtCount(120)).toBe('120');
		expect(fmtCount(100_000)).toBe('100K');
	});
});

test('fmtCountFull rounds and groups thousands', () => {
	expect(fmtCountFull(1_234_567.6)).toBe('1,234,568');
});

describe('fmtRel', () => {
	test.each([
		[0, '0:00'],
		[65, '1:05'],
		[59.6, '1:00'],
		[-3, '0:00']
	])('%d s -> %s', (sec, want) => {
		expect(fmtRel(sec)).toBe(want);
	});
});

describe('clock formats (local time)', () => {
	const d = new Date(2026, 5, 9, 14, 5, 9, 42);

	test('fmtClockMinute', () => expect(fmtClockMinute(d)).toBe('Jun 9 14:05'));
	test('fmtClockDate', () => expect(fmtClockDate(d)).toBe('Jun 9 14:05:09'));
	test('fmtTs', () => expect(fmtTs(d)).toBe('Jun 9 14:05:09.042'));
	test('fmtDateTime', () => expect(fmtDateTime(d)).toBe('Jun 9, 2026 14:05:09'));
});

describe('fmtBucketRange', () => {
	test('a bucket within one day shows the end time only', () => {
		expect(fmtBucketRange(new Date(2026, 5, 9, 14, 10), 5 * MINUTE)).toBe('Jun 9 14:05 – 14:10');
	});

	test('a bucket crossing midnight shows both dates', () => {
		expect(fmtBucketRange(new Date(2026, 5, 10, 0, 0), HOUR)).toBe('Jun 9 23:00 – Jun 10 00:00');
	});
});

describe('fmtBucketSize', () => {
	test.each([
		[MINUTE, '1-minute'],
		[5 * MINUTE, '5-minute'],
		[HOUR, '1-hour'],
		[3 * HOUR, '3-hour'],
		[DAY, '1-day'],
		[7 * DAY, '7-day'],
		[90 * MINUTE, '90-minute']
	])('%d ms -> %s', (ms, want) => {
		expect(fmtBucketSize(ms)).toBe(want);
	});
});

describe('fmtAxisTime', () => {
	test('midnight shows the date', () => {
		expect(fmtAxisTime(new Date(2026, 5, 9, 0, 0))).toBe('6/9');
	});

	test('other times show hours and minutes, from a Date or epoch ms', () => {
		const d = new Date(2026, 5, 9, 14, 5);
		expect(fmtAxisTime(d)).toBe('14:05');
		expect(fmtAxisTime(d.getTime())).toBe('14:05');
	});
});

test('kvTags sorts alphabetically with *_id keys last', () => {
	expect(kvTags({ user_id: '1', env: 'prod', app: 'web', order_id: '2' })).toEqual([
		'app=web',
		'env=prod',
		'order_id=2',
		'user_id=1'
	]);
});

describe('containsFilter', () => {
	test('matches a trimmed, case-insensitive substring of the value', () => {
		expect(containsFilter('Deadlock detected', '  DEAD ')).toBe(1);
	});

	test('matches keywords too', () => {
		expect(containsFilter('Foo', 'bar', ['LOCK_BAR'])).toBe(1);
	});

	test('returns 0 when nothing contains the term', () => {
		expect(containsFilter('Foo', 'zzz', ['qux'])).toBe(0);
	});
});

test('truncate keeps short text and cuts long text with an ellipsis', () => {
	expect(truncate('abc', 3)).toBe('abc');
	expect(truncate('abcdef', 3)).toBe('abc...');
});

describe('errMsg', () => {
	test('uses the raw message of a ConnectError, without the code prefix', () => {
		expect(errMsg(new ConnectError('boom', Code.NotFound))).toBe('boom');
	});

	test('uses the message of a plain Error', () => {
		expect(errMsg(new Error('plain'))).toBe('plain');
	});
});

describe('duration colors', () => {
	test('durationColor picks ok, warn, then danger at the thresholds', () => {
		expect(durationColor(99, 100, 200)).toBe('var(--color-ok-text)');
		expect(durationColor(100, 100, 200)).toBe('var(--color-warn-text)');
		expect(durationColor(200, 100, 200)).toBe('var(--color-danger-text)');
	});

	test('avgDurationColor warns at 800ms and alarms at 4s', () => {
		expect(avgDurationColor(799)).toBe('var(--color-ok-text)');
		expect(avgDurationColor(800)).toBe('var(--color-warn-text)');
		expect(avgDurationColor(4000)).toBe('var(--color-danger-text)');
	});

	test('runDurationColor warns at 1s and alarms at 10s', () => {
		expect(runDurationColor(999)).toBe('var(--color-ok-text)');
		expect(runDurationColor(1000)).toBe('var(--color-warn-text)');
		expect(runDurationColor(10_000)).toBe('var(--color-danger-text)');
	});
});
