import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { TransactionEventStatus, type TransactionEvent } from '$lib/gen/querysheriff/v1/activity_pb';
import { fmtRel } from '$lib/format';

export function statusLabel(s: TransactionEventStatus): string {
	switch (s) {
		case TransactionEventStatus.ACTIVE:
			return 'Active';
		case TransactionEventStatus.IDLE:
			return 'Idle';
		case TransactionEventStatus.ABORTED:
			return 'Aborted';
		default:
			return '';
	}
}

export function statusText(s: TransactionEventStatus): string {
	switch (s) {
		case TransactionEventStatus.ACTIVE:
			return 'var(--color-ok-text)';
		case TransactionEventStatus.ABORTED:
			return 'var(--color-danger)';
		default:
			return 'var(--color-steel-text)';
	}
}

export const MIN_TRANSACTION_MS = 5000;

const WAIT_OK_MS = 100;
const WAIT_SEVERE_MS = 5_000;

export function waitSeverityText(ms: number): string {
	if (ms > WAIT_SEVERE_MS) return 'var(--color-danger)';
	if (ms >= WAIT_OK_MS) return 'var(--color-warn-text)';

	return 'var(--color-ok-text)';
}

export function transactionAgeText(ms: number): string {
	if (ms > 120_000) return 'var(--color-danger)';
	if (ms >= 30_000) return 'var(--color-warn-text)';

	return 'var(--color-ok-text)';
}

export const durationMs = (from?: Timestamp, to?: Timestamp): number =>
	from && to ? Math.max(0, timestampDate(to).getTime() - timestampDate(from).getTime()) : 0;

export const relFrom = (start: Timestamp, ts: Timestamp): string =>
	fmtRel((timestampDate(ts).getTime() - timestampDate(start).getTime()) / 1000);

export const toDate = (ts?: Timestamp): Date | null => (ts ? timestampDate(ts) : null);

export const tsKey = (ts?: Timestamp): string => (ts ? `${ts.seconds}.${ts.nanos}` : '');

export const waitText = (e: TransactionEvent): string => [e.waitEvent, e.lockMode].filter(Boolean).join(' · ');

export type EventGroup = {
	key: string;
	query: string;
	queryTags: Record<string, string>;
	events: TransactionEvent[];
};

function executionKey(e: TransactionEvent): string {
	return e.queryStart ? `@${tsKey(e.queryStart)}` : `?${e.query}`;
}

export function groupEvents(events: TransactionEvent[]): EventGroup[] {
	const groups: EventGroup[] = [];
	let lastKey: string | null = null;
	for (const e of events) {
		const key = executionKey(e);
		const last = groups[groups.length - 1];
		if (last && key === lastKey) {
			last.events.push(e);
		} else {
			groups.push({ key: tsKey(e.from), query: e.query, queryTags: e.queryTags, events: [e] });
		}
		lastKey = key;
	}
	return groups;
}
