import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
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
    ]),
    renderer(),
  ],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.stackblitz.com https://*.webcontainer.io https://*.staticblitz.com https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; frame-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io https://*.staticblitz.com https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io; child-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io https://*.staticblitz.com https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io; worker-src 'self' blob: https://*.staticblitz.com https://*.webcontainer.io https://w-corp-staticblitz.com https://*.w-corp-staticblitz.com https://local.webcontainer.io https://*.webcontainer-api.io https://*.stackblitz.io;",
    },
  },
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  },
})
