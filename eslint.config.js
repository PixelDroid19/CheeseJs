import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      'dist',
      'dist-electron',
      'node_modules',
      'coverage',
      'electron/**/*.js',
      'release',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Security-related rules via TypeScript
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Disable overly strict error handling rule
      'preserve-caught-error': 'off',
    },
  },
  // Test files - relax some rules
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__test__/**/*.ts',
      '**/__test__/**/*.tsx',
      '**/__tests__/**/*.ts',
    ],
    rules: {
      'no-new-func': 'off', // Function constructor used for testing edge cases
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
      'no-undef': 'off', // Vitest globals
    },
    languageOptions: {
      globals: {
        ...globals.node,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
