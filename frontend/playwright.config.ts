import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
	projects: [
		{
			name: 'smoke',
			grep: /@smoke/,
			use: {
				...devices['Desktop Chrome'],
			},
		},
		{
			name: 'system',
			grep: /@system/,
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
});
