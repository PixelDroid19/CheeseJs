import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__test__/setup.ts',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'electron/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__test__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'monaco-editor': path.resolve(
        __dirname,
        './src/__test__/__mocks__/monaco-editor.ts'
      ),
    },
  },
});
