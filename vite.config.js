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
    rollupOptions: {
      output: {
        // El orden IMPORTA: son `if` en cascada sobre la misma ruta y varios
        // paquetes traen «react» en el nombre. `dexie-react-hooks` caía en
        // vendor-react, que entonces importaba dexie de vendor-db → ciclo
        // («Circular chunk: vendor-db -> vendor-react -> vendor-db»).
        // Regla: del nombre más específico al más genérico.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('dexie')) return 'vendor-db';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
        },
      },
    },
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
