import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './packages/app/src/__test__/setup.ts',
    include: [
      'packages/app/src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'electron/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/*.spec.ts',
      'electron/workers/__test__/workers.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Keep the gate focused on modules with meaningful automated coverage today.
      // The wider UI shell is still validated through build and Playwright flows.
      include: [
        'packages/app/src/components/FloatingToolbar.tsx',
        'packages/app/src/components/InputTooltip.tsx',
        'packages/app/src/components/PackagePrompts.tsx',
        'packages/app/src/components/Result.tsx',
        'packages/app/src/hooks/useCodeRunner.ts',
        'packages/app/src/lib/execution/ExecutionEngine.ts',
        'packages/app/src/store/index.ts',
      ],
      exclude: [
        'packages/app/src/**/*.d.ts',
        'packages/app/src/**/*.test.{ts,tsx}',
        'packages/app/src/**/__test__/**',
        'packages/app/src/main.tsx',
        'packages/app/src/vite-env.d.ts',
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
      '@cheesejs/app': path.resolve(__dirname, './packages/app/src'),
      '@cheesejs/core': path.resolve(__dirname, './packages/core/src'),
      '@cheesejs/editor': path.resolve(__dirname, './packages/editor/src'),
      '@cheesejs/execution': path.resolve(
        __dirname,
        './packages/execution/src'
      ),
      '@cheesejs/frontend': path.resolve(__dirname, './packages/frontend/src'),
      '@cheesejs/languages': path.resolve(
        __dirname,
        './packages/languages/src'
      ),
      '@cheesejs/package-management': path.resolve(
        __dirname,
        './packages/package-management/src'
      ),
      '@cheesejs/runtime-shell': path.resolve(
        __dirname,
        './packages/runtime-shell/src'
      ),
      '@cheesejs/settings': path.resolve(__dirname, './packages/settings/src'),
      '@cheesejs/themes': path.resolve(__dirname, './packages/themes/src'),
      '@cheesejs/ui': path.resolve(__dirname, './packages/ui/src'),
      '@cheesejs/workbench': path.resolve(
        __dirname,
        './packages/workbench/src'
      ),
      '@': path.resolve(__dirname, './packages/app/src'),
      'monaco-editor': path.resolve(
        __dirname,
        './packages/app/src/__test__/__mocks__/monaco-editor.ts'
      ),
    },
  },
});
