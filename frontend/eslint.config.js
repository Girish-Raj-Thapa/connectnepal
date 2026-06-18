import baseConfig from './eslint.config.base.js';
import { FlatCompat } from '@eslint/eslintrc';

/**
 * Dev config: starts from base, relaxes a few noisy rules.
 * Tighten/disable overrides as you fix code.
 */
const overrides = [
	{
		rules: {
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/prefer-promise-reject-errors': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
		},
	},
];

export default [...baseConfig, ...overrides];
