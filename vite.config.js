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
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
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
      // Impresión en dev → print-server local. Quita el prefijo /print.
      '^/print': {
        target: 'http://localhost:6789',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/print/, ''),
      },
    },
  },
})
