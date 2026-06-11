// vite.config.js
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
  build: {
    // assets de React a /static → evita colisión con /assets de ERPNext (proxy)
    assetsDir: 'static',
  },
  server: {
    host: true,
    proxy: {
      // Captura /api, /files y /assets → backend Frappe (Docker)
      '^/(api|files|assets)': {
        target: 'http://bakedata.local:8080',
        changeOrigin: true,        // Host=bakedata.local → nginx rutea al site
        secure: false,
        cookieDomainRewrite: '',
      },
    },
  },
})
