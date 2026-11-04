import type { Page, Request } from '@playwright/test';
import { create, toJson, type DescMessage, type DescMethodUnary, type MessageInitShape } from '@bufbuild/protobuf';
import { timestampNow } from '@bufbuild/protobuf/wkt';
import { AuthService } from '../src/lib/gen/querysheriff/v1/auth_pb.js';
import { HealthService } from '../src/lib/gen/querysheriff/v1/health_pb.js';

type Reply = { path: string; status: number; body: unknown };

const pathOf = (method: DescMethodUnary): string => `/api/${method.parent.typeName}/${method.name}`;

export function ok<O extends DescMessage>(method: DescMethodUnary<DescMessage, O>, init: MessageInitShape<O>): Reply {
	return { path: pathOf(method), status: 200, body: toJson(method.output, create(method.output, init)) };
}

const httpStatus = { unauthenticated: 401, unavailable: 503 };

export function fail(method: DescMethodUnary, code: keyof typeof httpStatus, message: string): Reply {
	return { path: pathOf(method), status: httpStatus[code], body: { code, message } };
}

export const user = { id: 1n, name: 'Ada Lovelace', email: 'ada@example.com', isSuperAdmin: true };

export const servers = ok(HealthService.method.listServers, {
	servers: [{ serverName: 'db1', databases: ['shop'], lastSeenAt: timestampNow() }]
});

export const signedIn = [ok(AuthService.method.getCurrentUser, { user }), servers];

export function nextRequest(page: Page, method: DescMethodUnary): Promise<Request> {
	return page.waitForRequest((r) => new URL(r.url()).pathname === pathOf(method));
}

// An RPC without a reply gets an empty message, which is valid for every response type.
export async function mockBackend(page: Page, ...replies: Reply[]): Promise<void> {
	await page.route('**/api/**', (route) => {
		const reply = replies.find((r) => r.path === new URL(route.request().url()).pathname);
		return route.fulfill({ status: reply?.status ?? 200, json: reply?.body ?? {} });
	});
}
