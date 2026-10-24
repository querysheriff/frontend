import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import { authClient, handleSessionEnded, statementClient } from './connect';

const fetchMock = vi.fn<typeof fetch>();
const onSessionEnded = vi.fn();

const respond = (status: number, body: unknown) =>
	fetchMock.mockImplementation(
		async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
	);

async function codeOf(call: Promise<unknown>): Promise<Code | undefined> {
	try {
		await call;
		return undefined;
	} catch (e) {
		return ConnectError.from(e).code;
	}
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	handleSessionEnded(onSessionEnded);
});

afterEach(() => {
	vi.unstubAllGlobals();
	fetchMock.mockReset();
	onSessionEnded.mockReset();
});

test('every request sends the session cookie and a 30 s timeout', async () => {
	respond(200, {});
	await authClient.getCurrentUser({});

	const [url, init] = fetchMock.mock.calls[0];
	expect(String(url)).toMatch(/\/querysheriff\.v1\.AuthService\/GetCurrentUser$/);
	expect(init?.credentials).toBe('include');
	expect(new Headers(init?.headers).get('connect-timeout-ms')).toBe('30000');
});

test('a rejected session signs the user out and still fails the call', async () => {
	respond(401, { code: 'unauthenticated', message: 'session expired' });

	expect(await codeOf(statementClient.getStatement({ id: 1n }))).toBe(Code.Unauthenticated);
	expect(onSessionEnded).toHaveBeenCalledOnce();
});

test('a rejected login is a wrong password, not an ended session', async () => {
	respond(401, { code: 'unauthenticated', message: 'invalid email or password' });

	expect(await codeOf(authClient.login({ email: 'a@dev.dev', password: 'x' }))).toBe(Code.Unauthenticated);
	expect(onSessionEnded).not.toHaveBeenCalled();
});

test('other errors and successful calls leave the session alone', async () => {
	respond(403, { code: 'permission_denied', message: 'not your server' });
	expect(await codeOf(statementClient.getStatement({ id: 1n }))).toBe(Code.PermissionDenied);

	respond(200, {});
	await authClient.getCurrentUser({});

	expect(onSessionEnded).not.toHaveBeenCalled();
});
