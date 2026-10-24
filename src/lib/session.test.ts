import { beforeEach, describe, expect, test, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { UserSchema } from '$lib/gen/querysheriff/v1/auth_pb';
import { session } from './session.svelte';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn(), login: vi.fn(), logout: vi.fn() }));
const sessionEnded = vi.hoisted(() => ({ handler: undefined as (() => void) | undefined }));

vi.mock('./connect', () => ({
	authClient: auth,
	handleSessionEnded: (handler: () => void) => {
		sessionEnded.handler = handler;
	}
}));

const ann = create(UserSchema, { id: 1n, name: 'Ann', email: 'ann@dev.dev', isSuperAdmin: true });

beforeEach(() => {
	session.user = null;
	session.loaded = false;
	auth.getCurrentUser.mockReset();
	auth.login.mockReset();
	auth.logout.mockReset();
});

test('a signed-out session has no name and no rights', () => {
	expect(session.isAuthenticated).toBe(false);
	expect(session.isSuperAdmin).toBe(false);
	expect(session.displayName).toBe('');
});

test('a signed-in session exposes the user', () => {
	session.user = ann;

	expect(session.isAuthenticated).toBe(true);
	expect(session.isSuperAdmin).toBe(true);
	expect(session.displayName).toBe('Ann');
});

describe('load', () => {
	test('stores the current user', async () => {
		auth.getCurrentUser.mockResolvedValue({ user: ann });
		await session.load();

		expect(session.user).toEqual(ann);
		expect(session.loaded).toBe(true);
	});

	test('treats a response without a user as signed out', async () => {
		auth.getCurrentUser.mockResolvedValue({});
		await session.load();

		expect(session.user).toBeNull();
		expect(session.loaded).toBe(true);
	});

	test('treats a failed request as signed out', async () => {
		session.user = ann;
		auth.getCurrentUser.mockRejectedValue(new ConnectError('no session', Code.Unauthenticated));
		await session.load();

		expect(session.user).toBeNull();
		expect(session.loaded).toBe(true);
	});
});

describe('login', () => {
	test('sends the credentials and stores the user', async () => {
		auth.login.mockResolvedValue({ user: ann });
		await session.login('ann@dev.dev', 'secret');

		expect(auth.login).toHaveBeenCalledWith({ email: 'ann@dev.dev', password: 'secret' });
		expect(session.user).toEqual(ann);
		expect(session.loaded).toBe(true);
	});

	test('passes a rejected login on and stays signed out', async () => {
		auth.login.mockRejectedValue(new ConnectError('invalid email or password', Code.Unauthenticated));

		await expect(session.login('ann@dev.dev', 'wrong')).rejects.toThrow('invalid email or password');
		expect(session.user).toBeNull();
	});
});

describe('logout', () => {
	test('signs out', async () => {
		session.user = ann;
		auth.logout.mockResolvedValue({});
		await session.logout();

		expect(session.user).toBeNull();
	});

	test('treats an already expired session as signed out', async () => {
		session.user = ann;
		auth.logout.mockRejectedValue(new ConnectError('expired', Code.Unauthenticated));
		await session.logout();

		expect(session.user).toBeNull();
	});

	test('passes other failures on and stays signed in', async () => {
		session.user = ann;
		auth.logout.mockRejectedValue(new ConnectError('backend down', Code.Unavailable));

		await expect(session.logout()).rejects.toThrow('backend down');
		expect(session.user).toEqual(ann);
	});
});

test('a session the backend rejects signs the user out', () => {
	session.user = ann;
	sessionEnded.handler?.();

	expect(sessionEnded.handler).toBeTypeOf('function');
	expect(session.user).toBeNull();
});
