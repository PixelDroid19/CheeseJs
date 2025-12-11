import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      // Use path-browserify for browser environment
      path: 'path-browserify',
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
          // instead of restarting the entire Electron App.
          options.reload()
        },
      },
      {
        // Worker thread for code execution
        entry: 'electron/workers/codeExecutor.ts',
      },
      {
        // Worker thread for Python execution
        entry: 'electron/workers/pythonExecutor.ts',
      },
      {
        // TypeScript transpiler module (legacy)
        entry: 'electron/transpiler/tsTranspiler.ts',
      },
      {
        // SWC transpiler module (high-performance)
        entry: 'electron/transpiler/swcTranspiler.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['@swc/core']
            }
          }
        }
      },
      {
        // Package manager module
        entry: 'electron/packages/packageManager.ts',
      },
    ]),
    renderer(),
  ],
  // Drop debugger in production
  esbuild: {
    drop: mode === 'production' ? ['debugger'] : [],
  },
  server: {
    headers: {
      // Content Security Policy for Electron renderer
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; frame-src 'self' blob:; child-src 'self' blob:; worker-src 'self' blob:;",
    },
    // Proxy for AI API calls to avoid CORS issues in development
    proxy: {
      '/api/minimax': {
        target: 'https://api.minimax.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/minimax/, ''),
        secure: true,
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        secure: true,
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        secure: true,
      },
      '/api/google': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google/, ''),
        secure: true,
      },
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
    // Disable modulepreload entirely to avoid preload warnings in Electron
    modulePreload: false,
    rollupOptions: {
      output: {
        // Ensure framer-motion is properly chunked
        manualChunks: {
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
}))
