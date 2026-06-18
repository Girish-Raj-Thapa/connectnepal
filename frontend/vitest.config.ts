import { defineConfig, mergeConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			globals: true,
			environment: 'jsdom',
			setupFiles: ['./src/tests/setup.ts'],
			css: true,
			passWithNoTests: true,
			include: ['src/**/*.{test,spec}.{ts,tsx}'],
			exclude: [...configDefaults.exclude, 'e2e/**'],
			coverage: {
				provider: 'v8',
				reporter: ['text', 'html', 'lcov'],
				reportsDirectory: './coverage',
				exclude: [
					...(configDefaults.coverage.exclude ?? []),
					'e2e/**',
					'playwright.config.ts',
					'vitest.config.ts',
					'src/tests/**',
				],
			},
		},
	}),
);
