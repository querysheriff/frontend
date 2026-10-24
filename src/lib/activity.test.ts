import { describe, expect, test } from 'vitest';
import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { TransactionEventSchema, TransactionEventStatus } from '$lib/gen/querysheriff/v1/activity_pb';
import {
	MIN_TRANSACTION_MS,
	durationMs,
	groupEvents,
	relFrom,
	statusColor,
	statusLabel,
	toDate,
	transactionAgeColor,
	tsKey,
	waitColor,
	waitText
} from './activity';

const T0 = new Date(Date.UTC(2026, 5, 9, 12, 0));
const ts = (sec: number) => timestampFromDate(new Date(T0.getTime() + sec * 1000));
const event = (init: MessageInitShape<typeof TransactionEventSchema>) => create(TransactionEventSchema, init);

test('statusLabel names each status', () => {
	expect(statusLabel(TransactionEventStatus.ACTIVE)).toBe('Active');
	expect(statusLabel(TransactionEventStatus.IDLE)).toBe('Idle');
	expect(statusLabel(TransactionEventStatus.ABORTED)).toBe('Aborted');
	expect(statusLabel(TransactionEventStatus.UNSPECIFIED)).toBe('');
});

test('statusColor marks active ok, aborted danger and the rest neutral', () => {
	expect(statusColor(TransactionEventStatus.ACTIVE)).toBe('var(--color-ok-text)');
	expect(statusColor(TransactionEventStatus.ABORTED)).toBe('var(--color-danger-text)');
	expect(statusColor(TransactionEventStatus.IDLE)).toBe('var(--color-steel-text)');
	expect(statusColor(TransactionEventStatus.UNSPECIFIED)).toBe('var(--color-steel-text)');
});

test('the long-transaction threshold is 5 seconds', () => {
	expect(MIN_TRANSACTION_MS).toBe(5000);
});

test('waitColor warns at 100ms and alarms at 5s', () => {
	expect(waitColor(99)).toBe('var(--color-ok-text)');
	expect(waitColor(100)).toBe('var(--color-warn-text)');
	expect(waitColor(5000)).toBe('var(--color-danger-text)');
});

test('transactionAgeColor warns at 30s and alarms at 2min', () => {
	expect(transactionAgeColor(29_999)).toBe('var(--color-ok-text)');
	expect(transactionAgeColor(30_000)).toBe('var(--color-warn-text)');
	expect(transactionAgeColor(120_000)).toBe('var(--color-danger-text)');
});

describe('durationMs', () => {
	test('measures the gap between two timestamps', () => {
		expect(durationMs(ts(1), ts(3.5))).toBe(2500);
	});

	test('never goes negative', () => {
		expect(durationMs(ts(3), ts(1))).toBe(0);
	});

	test('is 0 when either end is missing', () => {
		expect(durationMs(undefined, ts(1))).toBe(0);
		expect(durationMs(ts(1), undefined)).toBe(0);
	});
});

test('relFrom shows the offset from a start as m:ss', () => {
	expect(relFrom(T0, ts(65))).toBe('1:05');
});

test('toDate converts a timestamp and maps a missing one to null', () => {
	expect(toDate(ts(1))).toEqual(new Date(T0.getTime() + 1000));
	expect(toDate(undefined)).toBeNull();
});

test('tsKey builds a stable key from seconds and nanos', () => {
	expect(tsKey(timestampFromDate(new Date(1500)))).toBe('1.500000000');
	expect(tsKey(undefined)).toBe('');
});

test('waitText joins the wait event and lock mode that are present', () => {
	expect(waitText(event({ waitEvent: 'relation', lockMode: 'ExclusiveLock' }))).toBe('relation · ExclusiveLock');
	expect(waitText(event({ waitEvent: 'ClientRead' }))).toBe('ClientRead');
	expect(waitText(event({}))).toBe('');
});

describe('groupEvents', () => {
	test('groups consecutive events of one execution, keyed by the first event', () => {
		const events = [
			event({ from: ts(0), queryStart: ts(0), query: 'A', queryTags: { app: 'web' } }),
			event({ from: ts(2), queryStart: ts(0), query: 'A' }),
			event({ from: ts(4), queryStart: ts(4), query: 'B' }),
			event({ from: ts(6), query: 'C' }),
			event({ from: ts(8), query: 'C' }),
			event({ from: ts(10), queryStart: ts(0), query: 'A' })
		];

		const groups = groupEvents(events);

		expect(groups.map((g) => g.events.length)).toEqual([2, 1, 2, 1]);
		expect(groups.map((g) => g.query)).toEqual(['A', 'B', 'C', 'A']);
		expect(groups.map((g) => g.key)).toEqual([ts(0), ts(4), ts(6), ts(10)].map(tsKey));
		expect(groups[0].queryTags).toEqual({ app: 'web' });
	});

	test('returns no groups for no events', () => {
		expect(groupEvents([])).toEqual([]);
	});
});
