/**
 * main.jsx
 * Punto de entrada principal de la aplicación React.
 * Inicializa el árbol de renderizado, inyecta los estilos globales (index.css)
 * y configura el proveedor global de conexión al backend via `frappe-react-sdk`.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { FrappeProvider } from 'frappe-react-sdk'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FrappeProvider
      url={import.meta.env.VITE_FRAPPE_URL}
      enableSocket={false}
      tokenParams={{
        useToken: true,
        token: () => `${import.meta.env.VITE_API_KEY}:${import.meta.env.VITE_API_SECRET}`
      }}
    >
      <App />
    </FrappeProvider>
  </React.StrictMode>,
)