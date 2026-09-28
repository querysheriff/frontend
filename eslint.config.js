import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';

export default defineConfig(
	{ ignores: ['.svelte-kit/', 'build/', 'src/lib/gen/'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		rules: {
			// TS already catches unknown names.
			'no-undef': 'off',

			// No base path here, so forcing resolve() adds noise.
			'svelte/no-navigation-without-resolve': 'off',

			// Don't hide possible null/undefined bugs with `!`.
			'@typescript-eslint/no-non-null-assertion': 'error',

			// Make type-only imports explicit with `import type`.
			'@typescript-eslint/consistent-type-imports': 'error',

			// Prefer const, but with Svelte/runes awareness.
			'svelte/prefer-const': 'error',

			// No debug logs, but warnings and errors are fine.
			'no-console': ['error', { allow: ['warn', 'error'] }],

			// Use ===, except handy `x == null`.
			eqeqeq: ['error', 'smart'],

			// Require braces for multi-line blocks.
			curly: ['error', 'multi-line'],

			// Require TypeScript in every Svelte script block.
			'svelte/block-lang': ['error', { script: 'ts' }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	}
);
