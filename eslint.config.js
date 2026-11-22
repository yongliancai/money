import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-pages/**',
      '.tmp/**',
      'docs/sources/**',
      'test-results/**',
      'playwright-report/**',
      'data/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['client/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/server/**', 'node:*', 'openai', 'web-push'] },
      ],
    },
  },
];
