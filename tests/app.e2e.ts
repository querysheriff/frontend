import { expect, test } from '@playwright/test';
import { AuthService } from '../src/lib/gen/querysheriff/v1/auth_pb.js';
import {
	LogCategory,
	LogEvent_LogClassification,
	LogEvent_LogLevel,
	LogService
} from '../src/lib/gen/querysheriff/v1/log_pb.js';
import { StatementService } from '../src/lib/gen/querysheriff/v1/statement_pb.js';
import { timestampNow } from '@bufbuild/protobuf/wkt';
import { fail, mockBackend, nextRequest, ok, servers, signedIn, user } from './backend';

const query = 'SELECT id, total FROM orders WHERE customer_id = $1';

test('a signed-out user signs in and lands on the queries screen', async ({ page }) => {
	await mockBackend(
		page,
		fail(AuthService.method.getCurrentUser, 'unauthenticated', 'not signed in'),
		ok(AuthService.method.login, { user }),
		servers
	);

	await page.goto('/queries');
	await expect(page).toHaveURL(/\/login$/);

	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Password').fill('secret');
	const login = nextRequest(page, AuthService.method.login);
	await page.getByRole('button', { name: 'Sign in' }).click();

	expect((await login).postDataJSON()).toEqual({ email: user.email, password: 'secret' });
	await expect(page).toHaveURL(/\/queries\?server=db1&db=shop/);
	await expect(page.getByRole('heading', { level: 1, name: 'Queries' })).toBeVisible();
});

test('the queries list opens a query', async ({ page }) => {
	await mockBackend(
		page,
		...signedIn,
		ok(StatementService.method.listStatements, {
			statements: [{ id: 42n, preview: query, userName: 'app', calls: 1200n, rows: 1200n, avgMs: 3.5, pctTime: 61 }]
		}),
		ok(StatementService.method.getStatement, { query, serverName: 'db1', databaseName: 'shop' })
	);

	const list = nextRequest(page, StatementService.method.listStatements);
	await page.goto('/queries');
	expect((await list).postDataJSON()).toMatchObject({ serverName: 'db1', databaseName: 'shop' });

	await page.getByRole('link', { name: query }).click();

	await expect(page).toHaveURL(/\/queries\/42/);
	await expect(page.getByText('customer_id = $1')).toBeVisible();
});

test('the logs screen expands an event into its details', async ({ page }) => {
	await mockBackend(
		page,
		...signedIn,
		ok(LogService.method.listLogs, {
			records: [
				{
					id: 7n,
					occurredAt: timestampNow(),
					logLevel: LogEvent_LogLevel.ERROR,
					classification: LogEvent_LogClassification.UNIQUE_CONSTRAINT_VIOLATION,
					category: LogCategory.CONSTRAINT_VIOLATION,
					databaseName: 'shop',
					username: 'app',
					message: 'duplicate key value violates unique constraint "orders_pkey"',
					detail: 'Key (id)=(1) already exists.'
				}
			]
		})
	);

	await page.goto('/logs');
	await page.getByText('duplicate key value violates unique constraint').click();

	await expect(page.getByText('Key (id)=(1) already exists.')).toBeVisible();
});

test('a failing backend shows its error instead of the queries', async ({ page }) => {
	await mockBackend(
		page,
		...signedIn,
		fail(StatementService.method.listStatements, 'unavailable', 'clickhouse is unavailable')
	);

	await page.goto('/queries');

	await expect(page.getByText('clickhouse is unavailable')).toBeVisible();
	await expect(page.getByText('No queries found')).toBeHidden();
});
