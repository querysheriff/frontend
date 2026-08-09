import { fmtClock } from './format';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { parseDateTime, getLocalTimeZone, type CalendarDateTime, type DateValue } from '@internationalized/date';
import type { MonitoredServer } from '@buf/querysheriff_backend.bufbuild_es/querysheriff/v1/health_pb';
import { healthClient } from './connect';
import { urlSync } from './urlState.svelte';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const presets: { key: string; label: string; ms: number }[] = [
	{ key: '15m', label: 'Last 15 minutes', ms: 15 * MINUTE },
	{ key: '1h', label: 'Last 1 hour', ms: HOUR },
	{ key: '6h', label: 'Last 6 hours', ms: 6 * HOUR },
	{ key: '24h', label: 'Last 24 hours', ms: 24 * HOUR },
	{ key: '7d', label: 'Last 7 days', ms: 7 * DAY }
];

const DEFAULT_RANGE = '24h';
const presetMap: Record<string, string> = Object.fromEntries(presets.map((p) => [p.key, p.label]));
const presetMs: Record<string, number> = Object.fromEntries(presets.map((p) => [p.key, p.ms]));

const HEALTH_FRESH_MS = 5 * MINUTE;

export type ServerHealth = 'ok' | 'stale';

function todayAt(time: string): string {
	const d = new Date();
	const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	return `${date} ${time}`;
}

function toInputStr(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Bridge the "YYYY-MM-DD HH:MM:SS" custom-range strings to the CalendarDateTime
// values the bits-ui range picker binds to (parseDateTime wants an ISO "T").
export function rangeStrToDateTime(s: string): CalendarDateTime | undefined {
	try {
		return parseDateTime(s.replace(' ', 'T'));
	} catch {
		return undefined;
	}
}

export function dateTimeToRangeStr(dt: DateValue): string {
	return toInputStr(dt.toDate(getLocalTimeZone()));
}

class ContextState {
	server = $state('');
	db = $state('');
	range = $state(DEFAULT_RANGE);
	customFrom = $state(todayAt('00:00:00'));
	customTo = $state(todayAt('23:59:59'));
	// False on screens whose data is server-wide (LOGS). `db` keeps its value so
	// leaving the screen restores the selection, but it is neither shown nor
	// written to the URL while it means nothing.
	dbScoped = $state(true);

	get isCustom(): boolean {
		return this.range === 'custom';
	}

	get timeLabel(): string {
		return presetMap[this.range] ?? presetMap[DEFAULT_RANGE];
	}

	get customFromLabel(): string {
		return fmtClock(this.customFrom);
	}

	get customToLabel(): string {
		return fmtClock(this.customTo);
	}

	/** Narrow the window to an absolute range, as dragging across a chart does. Lives here
	 *  rather than in each page so every chart's brush lands on the same behaviour, and so the
	 *  selection is shareable through the range params `writeQuery` already emits. */
	zoomTo(from: Date, to: Date): void {
		this.customFrom = toInputStr(from);
		this.customTo = toInputStr(to);
		this.range = 'custom';
	}

	timeRange(): { from: Date; to: Date } {
		if (this.range === 'custom') {
			// Inputs are typed as "YYYY-MM-DD HH:MM:SS"; normalize the space to ISO's "T".
			const from = new Date(this.customFrom.replace(' ', 'T'));
			const to = new Date(this.customTo.replace(' ', 'T'));
			if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from.getTime() <= to.getTime()) {
				return { from, to };
			}
		}
		const to = new Date();
		const span = presetMs[this.range] ?? presetMs[DEFAULT_RANGE];
		return { from: new Date(to.getTime() - span), to };
	}

	applyQuery(params: URLSearchParams): void {
		const server = params.get('server');
		const db = params.get('db');
		if (server) this.server = server;
		if (db) this.db = db;

		const from = Number(params.get('from'));
		const to = Number(params.get('to'));
		const range = params.get('range');
		if (params.has('from') && params.has('to') && Number.isFinite(from) && Number.isFinite(to) && from <= to) {
			this.customFrom = toInputStr(new Date(from));
			this.customTo = toInputStr(new Date(to));
			this.range = 'custom';
		} else if (range && range in presetMs) {
			this.range = range;
		}
	}

	writeQuery(params: URLSearchParams): void {
		if (this.server) params.set('server', this.server);
		if (this.db && this.dbScoped) params.set('db', this.db);
		if (this.range === 'custom') {
			const { from, to } = this.timeRange();
			params.set('from', String(from.getTime()));
			params.set('to', String(to.getTime()));
		} else {
			params.set('range', this.range);
		}
	}
}

export const ctx = new ContextState();

urlSync.register(ctx);

// A statement id is permanently bound to one server+database, so the detail
// view pins them to the record's own scope instead of offering dead pickers.
class ScopeLock {
	server = $state<string | null>(null);
	db = $state<string | null>(null);

	get locked(): boolean {
		return this.server !== null;
	}

	lock(server: string, db: string) {
		this.server = server;
		this.db = db;
	}

	unlock() {
		this.server = null;
		this.db = null;
	}
}

export const scopeLock = new ScopeLock();

// Servers whose last health check is older than 24h are already excluded by the backend.
class ServersState {
	list = $state<MonitoredServer[]>([]);
	loaded = $state(false);

	async load() {
		try {
			const { servers } = await healthClient.queryServers({});
			this.list = servers;
			this.reconcile();
		} catch {
			/* empty */
		} finally {
			this.loaded = true;
		}
	}

	get names(): string[] {
		return this.list.map((s) => s.serverName);
	}

	databasesFor(server: string): string[] {
		return this.list.find((s) => s.serverName === server)?.databases ?? [];
	}

	health(server: string): ServerHealth {
		const found = this.list.find((s) => s.serverName === server);
		if (!found?.collectedAt) return 'stale';
		return Date.now() - timestampDate(found.collectedAt).getTime() <= HEALTH_FRESH_MS ? 'ok' : 'stale';
	}

	reconcile() {
		if (!this.names.includes(ctx.server)) {
			ctx.server = this.names[0] ?? '';
		}
		const dbs = this.databasesFor(ctx.server);
		if (!dbs.includes(ctx.db)) {
			ctx.db = dbs[0] ?? '';
		}
	}
}

export const serversState = new ServersState();
