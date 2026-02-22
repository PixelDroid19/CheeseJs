import { defineConfig } from 'vite';
import { resolve } from 'path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      // Use path-browserify for browser environment
      path: 'path-browserify',
      // Shim @emotion/is-prop-valid to avoid dynamic require issues
      '@emotion/is-prop-valid': resolve(
        __dirname,
        'src/lib/shims/is-prop-valid.ts'
      ),
    },
  },
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'typescript',
                '@swc/core',
                '@swc/core-win32-x64-msvc',
                '@lancedb/lancedb',
                'pdf-parse',
                'mammoth',
                'onnxruntime-node',
                '@xenova/transformers',
              ],
              output: {
                format: 'es',
              },
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
          // instead of restarting the entire Electron App.
          options.reload();
        },
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'es',
              },
            },
          },
        },
      },
      {
        // Worker thread for code execution
        entry: 'electron/workers/codeExecutor.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'es',
              },
            },
          },
        },
      },
      {
        // Worker thread for Python execution
        entry: 'electron/workers/pythonExecutor.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'es',
              },
            },
          },
        },
      },
      {
        // SWC transpiler worker (dedicated worker for 20-70x faster transpilation)
        entry: 'electron/workers/swcTranspilerWorker.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['@swc/core'],
              output: {
                format: 'es',
              },
            },
          },
        },
      },
      {
        // SWC transpiler module (high-performance)
        entry: 'electron/transpiler/swcTranspiler.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['@swc/core'],
              output: {
                format: 'es',
              },
            },
          },
        },
      },

      {
        // Package manager module
        entry: 'electron/packages/packageManager.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'es',
              },
            },
          },
        },
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
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; frame-src 'self' blob:; child-src 'self' blob:; worker-src 'self' blob:;",
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
}));
