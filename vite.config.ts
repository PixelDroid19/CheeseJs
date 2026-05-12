import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function vendorChunk(id: string) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
    return 'vendor-monaco';
  }
  if (
    id.includes('monaco-languageclient') ||
    id.includes('vscode-jsonrpc') ||
    id.includes('vscode-languageclient') ||
    id.includes('vscode-ws-jsonrpc') ||
    id.includes('@vscode/')
  ) {
    return 'vendor-vscode';
  }
  if (id.includes('pyodide')) return 'vendor-pyodide';
  if (id.includes('@babel/')) return 'vendor-babel';
  if (id.includes('framer-motion')) return 'vendor-motion';
  if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
  if (id.includes('i18next')) return 'vendor-i18n';
  return undefined;
}

export const packageAliases = {
  '@cheesejs/app': resolve(__dirname, 'packages/app/src'),
  '@cheesejs/core': resolve(__dirname, 'packages/core/src'),
  '@cheesejs/editor': resolve(__dirname, 'packages/editor/src'),
  '@cheesejs/execution': resolve(__dirname, 'packages/execution/src'),
  '@cheesejs/frontend': resolve(__dirname, 'packages/frontend/src'),
  '@cheesejs/languages': resolve(__dirname, 'packages/languages/src'),
  '@cheesejs/package-management': resolve(
    __dirname,
    'packages/package-management/src'
  ),
  '@cheesejs/runtime-shell': resolve(__dirname, 'packages/runtime-shell/src'),
  '@cheesejs/settings': resolve(__dirname, 'packages/settings/src'),
  '@cheesejs/state': resolve(__dirname, 'packages/state/src'),
  '@cheesejs/themes': resolve(__dirname, 'packages/themes/src'),
  '@cheesejs/ui': resolve(__dirname, 'packages/ui/src'),
  '@cheesejs/workbench': resolve(__dirname, 'packages/workbench/src'),
} as const;

export default defineConfig({
  resolve: {
    alias: {
      ...packageAliases,
      path: 'path-browserify',
      '@emotion/is-prop-valid': resolve(
        __dirname,
        'packages/app/src/lib/shims/is-prop-valid.ts'
      ),
    },
  },
  plugins: [tailwindcss(), react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/coverage/**', '**/dist/**', '**/zig-cache/**'],
    },
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: wss: http://127.0.0.1:*; frame-src 'self' blob:; child-src 'self' blob:; worker-src 'self' blob:;",
    },
  },
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  },
  optimizeDeps: {
    include: ['framer-motion'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    modulePreload: false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
});
