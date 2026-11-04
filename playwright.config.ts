import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests',
	testMatch: '*.e2e.ts',
	use: { baseURL: `http://localhost:${PORT}` },
	projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
	webServer: {
		command: `npm run build && npm run preview -- --port ${PORT}`,
		port: PORT,
		// An empty value overrides the dev URL in .env, so the app calls its own /api, which the tests mock.
		env: { PUBLIC_API_URL: '' }
	}
});
