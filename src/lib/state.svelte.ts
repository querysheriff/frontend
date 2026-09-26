import { browser } from '$app/environment';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import type { Server } from '$lib/gen/querysheriff/v1/health_pb';
import { healthClient } from './connect';
import { errMsg } from './format';

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

function todayAt(hours: number, minutes: number, seconds: number): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
}

const DEFAULT_SERVER_KEY = 'querysheriff:default-server';
const DEFAULT_DB_KEY = 'querysheriff:default-db';

class DefaultScope {
	server = $state((browser && localStorage.getItem(DEFAULT_SERVER_KEY)) || '');
	db = $state((browser && localStorage.getItem(DEFAULT_DB_KEY)) || '');

	get isCurrent(): boolean {
		return this.server !== '' && this.server === ctx.server && this.db === ctx.db;
	}

	toggle(): void {
		const clear = this.isCurrent;
		this.server = clear ? '' : ctx.server;
		this.db = clear ? '' : ctx.db;
		if (!browser) return;
		localStorage.setItem(DEFAULT_SERVER_KEY, this.server);
		localStorage.setItem(DEFAULT_DB_KEY, this.db);
	}
}

export const defaultScope = new DefaultScope();

class ContextState {
	server = $state(defaultScope.server);
	db = $state(defaultScope.db);
	range = $state(DEFAULT_RANGE);
	customFrom = $state(todayAt(0, 0, 0));
	customTo = $state(todayAt(23, 59, 59));
	// False on server-wide screens (LOGS): `db` keeps its value but is not shown or written to the URL.
	dbScoped = $state(true);
	// True on a query's detail page: server and db are the query's own and can't be switched.
	scopeLocked = $state(false);
	#pushNext = false;

	get isCustom(): boolean {
		return this.range === 'custom';
	}

	get timeLabel(): string {
		return presetMap[this.range] ?? presetMap[DEFAULT_RANGE];
	}

	setCustom(a: Date, b: Date): void {
		[this.customFrom, this.customTo] = a <= b ? [a, b] : [b, a];
		this.range = 'custom';
	}

	zoomTo(from: Date, to: Date): void {
		this.setCustom(from, to);
		this.#pushNext = true;
	}

	/** A zoom gets its own history entry, so Back undoes it; any other change replaces the current one. */
	takeHistoryMode(): 'push' | 'replace' {
		const mode = this.#pushNext ? 'push' : 'replace';
		this.#pushNext = false;
		return mode;
	}

	timeRange(): { from: Date; to: Date } {
		if (this.range === 'custom') return { from: this.customFrom, to: this.customTo };
		const to = new Date();
		return { from: new Date(to.getTime() - presetMs[this.range]), to };
	}

	applyQuery(params: URLSearchParams): void {
		const server = params.get('server');
		const db = params.get('db');
		if (server) this.server = server;
		if (db) this.db = db;

		const from = new Date(Number(params.get('from')));
		const to = new Date(Number(params.get('to')));
		const range = params.get('range');
		if (params.has('from') && params.has('to') && !isNaN(from.getTime()) && !isNaN(to.getTime())) {
			this.setCustom(from, to);
		} else if (range && Object.hasOwn(presetMs, range)) {
			this.range = range;
		}
	}

	queryString(): string {
		const params: [string, string][] = [];
		if (this.server) params.push(['server', this.server]);
		if (this.db && this.dbScoped) params.push(['db', this.db]);
		if (this.range === 'custom') {
			params.push(['from', String(this.customFrom.getTime())], ['to', String(this.customTo.getTime())]);
		} else {
			params.push(['range', this.range]);
		}
		return new URLSearchParams(params).toString();
	}
}

export const ctx = new ContextState();

// Servers whose last health check is older than 24h are already excluded by the backend.
class ServersState {
	list = $state<Server[]>([]);
	loaded = $state(false);
	error = $state<string | null>(null);

	async load() {
		try {
			const { servers } = await healthClient.listServers({});
			this.list = servers;
			this.error = null;
			this.reconcile();
		} catch (e) {
			this.error = errMsg(e);
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

	isHealthy(server: string): boolean {
		const lastSeenAt = this.list.find((s) => s.serverName === server)?.lastSeenAt;
		return !!lastSeenAt && Date.now() - timestampDate(lastSeenAt).getTime() <= HEALTH_FRESH_MS;
	}

	reconcile() {
		if (ctx.scopeLocked) return;
		if (!this.names.includes(ctx.server)) {
			ctx.server = this.names.includes(defaultScope.server) ? defaultScope.server : (this.names[0] ?? '');
		}
		const dbs = this.databasesFor(ctx.server);
		if (!dbs.includes(ctx.db)) {
			const useDefault = ctx.server === defaultScope.server && dbs.includes(defaultScope.db);
			ctx.db = useDefault ? defaultScope.db : (dbs[0] ?? '');
		}
	}
}

export const serversState = new ServersState();
