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
        // TypeScript transpiler module
        entry: 'electron/transpiler/tsTranspiler.ts',
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
