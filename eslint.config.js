import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist/', 'node_modules/']},
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {...globals.browser, ...globals.serviceworker, chrome: 'readonly'},
      parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname},
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      // Chrome event listeners are commonly async; Chrome ignores the promise.
      '@typescript-eslint/no-misused-promises': ['error', {checksVoidReturn: false}],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts', 'vitest.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // browser tests: plain Node scripts driving Chromium
    files: ['test/e2e/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {globals: {...globals.node}},
  },
  {
    // the chrome API mock implements promise-returning APIs synchronously
    files: ['test/chrome-mock.ts'],
    rules: {'@typescript-eslint/require-await': 'off'},
  },
);
