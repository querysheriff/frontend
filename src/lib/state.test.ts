import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { ServerSchema } from '$lib/gen/querysheriff/v1/health_pb';
import { ctx, defaultScope, presets, serversState } from './state.svelte';

const listServers = vi.hoisted(() => vi.fn());
vi.mock('./connect', () => ({ healthClient: { listServers } }));

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = new Date(Date.UTC(2026, 5, 9, 12, 0));

const server = (serverName: string, databases: string[], lastSeenAt?: Date) =>
	create(ServerSchema, { serverName, databases, lastSeenAt: lastSeenAt && timestampFromDate(lastSeenAt) });

const params = (query: string) => new URLSearchParams(query);

beforeEach(() => {
	ctx.server = '';
	ctx.db = '';
	ctx.range = '24h';
	ctx.dbScoped = true;
	ctx.scopeLocked = false;
	ctx.takeHistoryMode();
	defaultScope.server = '';
	defaultScope.db = '';
	serversState.list = [];
	serversState.loaded = false;
	serversState.error = null;
	listServers.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('ctx time range', () => {
	test('offers the five presets, defaulting to the last 24 hours', () => {
		expect(presets.map((p) => p.key)).toEqual(['1h', '6h', '24h', '7d', '30d']);
		expect(ctx.range).toBe('24h');
		expect(ctx.timeLabel).toBe('Last 24 hours');
		expect(ctx.isCustom).toBe(false);
	});

	test('a preset resolves to that span ending now', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		ctx.range = '1h';

		expect(ctx.timeRange()).toEqual({ from: new Date(NOW.getTime() - HOUR), to: NOW });
		expect(ctx.timeLabel).toBe('Last 1 hour');
	});

	test('setCustom orders the two ends and switches to the custom range', () => {
		const early = new Date(NOW.getTime() - HOUR);
		ctx.setCustom(NOW, early);

		expect(ctx.isCustom).toBe(true);
		expect(ctx.timeRange()).toEqual({ from: early, to: NOW });
		expect(ctx.timeLabel).toBe('Last 24 hours');
	});

	test('a zoom asks for one history push; anything else replaces', () => {
		ctx.setCustom(new Date(0), NOW);
		expect(ctx.takeHistoryMode()).toBe('replace');

		ctx.zoomTo(new Date(0), NOW);
		expect(ctx.isCustom).toBe(true);
		expect(ctx.takeHistoryMode()).toBe('push');
		expect(ctx.takeHistoryMode()).toBe('replace');
	});
});

describe('ctx URL state', () => {
	test('applyQuery reads the server, database and preset', () => {
		ctx.applyQuery(params('server=prod&db=app&range=7d'));

		expect([ctx.server, ctx.db, ctx.range]).toEqual(['prod', 'app', '7d']);
	});

	test('applyQuery keeps the server and database when the URL has none', () => {
		ctx.server = 'prod';
		ctx.db = 'app';
		ctx.applyQuery(params('range=1h'));

		expect([ctx.server, ctx.db]).toEqual(['prod', 'app']);
	});

	test('applyQuery prefers a from/to pair over a preset, ordering the ends', () => {
		ctx.applyQuery(params('range=1h&from=5000&to=1000'));

		expect(ctx.isCustom).toBe(true);
		expect(ctx.timeRange()).toEqual({ from: new Date(1000), to: new Date(5000) });
	});

	test('applyQuery ignores an incomplete or invalid custom range, and unknown presets', () => {
		ctx.applyQuery(params('from=1000&range=6h'));
		expect(ctx.range).toBe('6h');

		ctx.applyQuery(params('from=abc&to=5000&range=1h'));
		expect(ctx.range).toBe('1h');

		ctx.applyQuery(params('range=bogus'));
		ctx.applyQuery(params('range=custom'));
		expect(ctx.range).toBe('1h');
	});

	test('queryString writes the server, database and preset', () => {
		ctx.server = 'prod';
		ctx.db = 'app';

		expect(ctx.queryString()).toBe('server=prod&db=app&range=24h');
	});

	test('queryString leaves out the database on server-wide screens and empty values', () => {
		ctx.server = 'prod';
		ctx.db = 'app';
		ctx.dbScoped = false;
		expect(ctx.queryString()).toBe('server=prod&range=24h');

		ctx.server = '';
		expect(ctx.queryString()).toBe('range=24h');
	});

	test('queryString writes a custom range as epoch milliseconds', () => {
		ctx.server = 'prod';
		ctx.setCustom(new Date(1000), new Date(5000));

		expect(ctx.queryString()).toBe('server=prod&from=1000&to=5000');
	});

	test('what queryString writes, applyQuery reads back', () => {
		ctx.server = 'prod';
		ctx.db = 'app';
		ctx.setCustom(new Date(1000), new Date(5000));
		const query = ctx.queryString();

		ctx.server = '';
		ctx.db = '';
		ctx.range = '24h';
		ctx.applyQuery(params(query));

		expect(ctx.queryString()).toBe(query);
	});
});

describe('defaultScope', () => {
	test('toggle stars the current server and database, and a second toggle unstars them', () => {
		ctx.server = 'prod';
		ctx.db = 'app';
		expect(defaultScope.isCurrent).toBe(false);

		defaultScope.toggle();
		expect([defaultScope.server, defaultScope.db]).toEqual(['prod', 'app']);
		expect(defaultScope.isCurrent).toBe(true);

		defaultScope.toggle();
		expect([defaultScope.server, defaultScope.db]).toEqual(['', '']);
		expect(defaultScope.isCurrent).toBe(false);
	});

	test('is current only for the same server and database, and never when unset', () => {
		expect(defaultScope.isCurrent).toBe(false);

		defaultScope.server = 'prod';
		defaultScope.db = 'app';
		ctx.server = 'prod';
		ctx.db = 'other';
		expect(defaultScope.isCurrent).toBe(false);
	});
});

describe('serversState', () => {
	test('lists server names and each server’s databases', () => {
		serversState.list = [server('a', ['x', 'y']), server('b', [])];

		expect(serversState.names).toEqual(['a', 'b']);
		expect(serversState.databasesFor('a')).toEqual(['x', 'y']);
		expect(serversState.databasesFor('missing')).toEqual([]);
	});

	test('a server is healthy when it reported within 5 minutes', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		serversState.list = [
			server('fresh', [], new Date(NOW.getTime() - 5 * MINUTE)),
			server('stale', [], new Date(NOW.getTime() - 5 * MINUTE - 1)),
			server('never', [])
		];

		expect(serversState.isHealthy('fresh')).toBe(true);
		expect(serversState.isHealthy('stale')).toBe(false);
		expect(serversState.isHealthy('never')).toBe(false);
		expect(serversState.isHealthy('missing')).toBe(false);
	});

	describe('reconcile', () => {
		beforeEach(() => {
			serversState.list = [server('a', ['x', 'y']), server('b', ['z'])];
		});

		test('keeps a selection that exists', () => {
			ctx.server = 'b';
			ctx.db = 'z';
			serversState.reconcile();

			expect([ctx.server, ctx.db]).toEqual(['b', 'z']);
		});

		test('replaces a missing server with the first one and its first database', () => {
			ctx.server = 'gone';
			ctx.db = 'gone';
			serversState.reconcile();

			expect([ctx.server, ctx.db]).toEqual(['a', 'x']);
		});

		test('prefers the starred default server and database', () => {
			defaultScope.server = 'b';
			defaultScope.db = 'z';
			ctx.server = 'gone';
			serversState.reconcile();

			expect([ctx.server, ctx.db]).toEqual(['b', 'z']);
		});

		test('uses the starred database only on the starred server', () => {
			defaultScope.server = 'a';
			defaultScope.db = 'y';

			ctx.server = 'a';
			ctx.db = 'gone';
			serversState.reconcile();
			expect(ctx.db).toBe('y');

			ctx.server = 'b';
			ctx.db = 'gone';
			serversState.reconcile();
			expect(ctx.db).toBe('z');
		});

		test('clears the selection when there are no servers', () => {
			serversState.list = [];
			ctx.server = 'gone';
			ctx.db = 'gone';
			serversState.reconcile();

			expect([ctx.server, ctx.db]).toEqual(['', '']);
		});

		test('leaves a locked scope alone', () => {
			ctx.scopeLocked = true;
			ctx.server = 'gone';
			ctx.db = 'gone';
			serversState.reconcile();

			expect([ctx.server, ctx.db]).toEqual(['gone', 'gone']);
		});
	});

	test('load stores the servers and reconciles the selection', async () => {
		listServers.mockResolvedValue({ servers: [server('a', ['x'])] });
		serversState.error = 'old error';

		await serversState.load();

		expect(serversState.names).toEqual(['a']);
		expect(serversState.error).toBeNull();
		expect(serversState.loaded).toBe(true);
		expect([ctx.server, ctx.db]).toEqual(['a', 'x']);
	});

	test('a failed load keeps the last list and shows the error', async () => {
		listServers.mockResolvedValue({ servers: [server('a', ['x'])] });
		await serversState.load();

		listServers.mockRejectedValue(new ConnectError('backend down', Code.Unavailable));
		await serversState.load();

		expect(serversState.names).toEqual(['a']);
		expect(serversState.error).toBe('backend down');
		expect(serversState.loaded).toBe(true);
	});
});
