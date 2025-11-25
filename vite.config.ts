import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
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
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.stackblitz.com https://*.webcontainer.io; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' https://registry.npmjs.org https://unpkg.com https://cdn.jsdelivr.net https://stackblitz.com https://*.stackblitz.com https://*.stackblitz.io https://*.webcontainer.io https://*.staticblitz.com wss://*.webcontainer.io; frame-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io; child-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io; worker-src 'self' blob: https://*.staticblitz.com https://*.webcontainer.io;",
    },
  },
})
