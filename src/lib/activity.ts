import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import {
	TransactionEventStatus,
	type TransactionEvent
} from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/activity_pb';
import { fmtRel } from '$lib/format';

export function statusLabel(s: TransactionEventStatus): string {
	switch (s) {
		case TransactionEventStatus.ACTIVE:
			return 'ACTIVE';
		case TransactionEventStatus.IDLE:
			return 'IDLE';
		case TransactionEventStatus.ABORTED:
			return 'ABORTED';
		default:
			return '';
	}
}

/** The AA-passing variants, for anywhere the status is painted as text. */
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

/** A transaction shorter than this is just a query. Filtering to what is worth
 *  acting on is the difference between a monitor and a debugging tool. */
export const MIN_TRANSACTION_MS = 5000;

/** Lock-wait severity. Under 100ms is ordinary contention that resolves on its
 *  own; past 5s a session has been stopped long enough for a person to feel it. */
const WAIT_OK_MS = 100;
const WAIT_SEVERE_MS = 5_000;

/** Colour for a lock wait's duration. Its own scale rather than sevByDuration,
 *  whose thresholds are tuned to query runtime — a second of waiting and a second
 *  of working are not the same thing. */
export function waitSeverityText(ms: number): string {
	if (ms > WAIT_SEVERE_MS) return 'var(--color-danger)';
	if (ms >= WAIT_OK_MS) return 'var(--color-warn-text)';

	return 'var(--color-ok-text)';
}

/** Colour for how long a transaction stayed open. Scaled to the range the table
 *  actually lists: with a 5s floor, a scale starting below that would leave its
 *  first tier unreachable. */
export function transactionAgeText(ms: number): string {
	if (ms > 120_000) return 'var(--color-danger)';
	if (ms >= 30_000) return 'var(--color-warn-text)';

	return 'var(--color-ok-text)';
}

/** Independent of "now", so an episode that ended in the past shows its real length. */
export const durationMs = (from?: Timestamp, to?: Timestamp): number =>
	from && to ? Math.max(0, timestampDate(to).getTime() - timestampDate(from).getTime()) : 0;

export const relFrom = (start: Timestamp, ts: Timestamp): string =>
	fmtRel((timestampDate(ts).getTime() - timestampDate(start).getTime()) / 1000);

export const toDate = (ts?: Timestamp): Date | null => (ts ? timestampDate(ts) : null);

/** A timestamp's full identity, for row keys and grouping. Seconds alone are not
 *  unique enough — one pid can start two transactions within the same second. */
export const tsKey = (ts?: Timestamp): string => (ts ? `${ts.seconds}.${ts.nanos}` : '');

/** The event name already says what it is ("ClientRead"), so the type prefix
 *  ("Client") only repeats it. The lock mode is separate information and stays. */
export const waitText = (e: TransactionEvent): string => [e.waitEvent, e.lockMode].filter(Boolean).join(' · ');

export type EventGroup = {
	/** Stable across re-renders: the moment the group's first stretch began. */
	key: string;
	query: string;
	queryTags: Record<string, string>;
	events: TransactionEvent[];
};

/** query_start identifies one run of a statement; the text alone would not, since
 *  the same statement run twice is two runs. */
function executionKey(e: TransactionEvent): string {
	return e.queryStart ? `@${tsKey(e.queryStart)}` : `?${e.query}`;
}

/** Consecutive events belonging to one execution share a query header, so an active
 *  stretch and the idle stretch that follows it read as one statement — while a
 *  second run of the same text gets its own block instead of hiding in the first. */
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
