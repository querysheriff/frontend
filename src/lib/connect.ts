import { createClient, type Client } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { env } from '$env/dynamic/public';
import { ActivityService } from '$lib/gen/querysheriff/v1/activity_pb';
import { StatementService } from '$lib/gen/querysheriff/v1/statement_pb';
import { HealthService } from '$lib/gen/querysheriff/v1/health_pb';
import { LogService } from '$lib/gen/querysheriff/v1/log_pb';
import { AuthService } from '$lib/gen/querysheriff/v1/auth_pb';
import { AdminService } from '$lib/gen/querysheriff/v1/admin_pb';
import { AlertService } from '$lib/gen/querysheriff/v1/alert_pb';

const baseUrl = env.PUBLIC_API_URL || '/api';
const REQUEST_TIMEOUT_MS = 30_000;

// fetch override sends the HTTP-only session cookie on every request (cross-origin in dev).
const transport = createConnectTransport({
	baseUrl,
	defaultTimeoutMs: REQUEST_TIMEOUT_MS,
	fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: 'include' })
});

export const activityClient: Client<typeof ActivityService> = createClient(ActivityService, transport);
export const statementClient: Client<typeof StatementService> = createClient(StatementService, transport);
export const healthClient: Client<typeof HealthService> = createClient(HealthService, transport);
export const logClient: Client<typeof LogService> = createClient(LogService, transport);
export const authClient: Client<typeof AuthService> = createClient(AuthService, transport);
export const adminClient: Client<typeof AdminService> = createClient(AdminService, transport);
export const alertClient: Client<typeof AlertService> = createClient(AlertService, transport);
