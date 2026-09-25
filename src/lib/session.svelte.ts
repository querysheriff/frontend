import type { User } from '$lib/gen/querysheriff/v1/auth_pb';
import { authClient } from './connect';

class SessionState {
	user = $state<User | null>(null);
	loaded = $state(false);

	async load(): Promise<void> {
		try {
			const { user } = await authClient.currentUser({});
			this.user = user ?? null;
		} catch {
			this.user = null;
		} finally {
			this.loaded = true;
		}
	}

	async login(email: string, password: string): Promise<void> {
		const { user } = await authClient.login({ email, password });
		this.user = user ?? null;
		this.loaded = true;
	}

	async logout(): Promise<void> {
		try {
			await authClient.logout({});
		} finally {
			this.user = null;
		}
	}

	get isAuthenticated(): boolean {
		return this.user !== null;
	}

	get isSuperAdmin(): boolean {
		return this.user?.isSuperAdmin ?? false;
	}

	get displayName(): string {
		return this.user?.name ?? '';
	}
}

export const session = new SessionState();
