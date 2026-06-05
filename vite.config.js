// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
