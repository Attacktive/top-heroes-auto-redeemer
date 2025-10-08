import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default defineConfig([
	js.configs.recommended,
	...ts.configs.recommended,
	{
		files: ['src/**/*.ts', 'scripts/**/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser
			}
		},
		rules: {
			'no-unused-vars': [
				'warn',
				{
					'argsIgnorePattern': '^_',
					'varsIgnorePattern': '^_',
					'caughtErrorsIgnorePattern': '^_'
				}
			]
		}
	},
	{
		ignores: ['dist/**/*', 'node_modules/**/*']
	}
]);
