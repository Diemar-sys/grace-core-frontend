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
import './styles/global.css'  // tokens + estilos compartidos: siempre disponibles
import { FrappeProvider } from 'frappe-react-sdk'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Auth por cookie de sesión (login propio). NUNCA volver a tokenParams
        con VITE_API_KEY/SECRET: todo lo VITE_ se hornea en el bundle público
        y las llaves quedan descargables por cualquier navegador de la LAN. */}
    <FrappeProvider
      url={import.meta.env.VITE_FRAPPE_URL}
      enableSocket={false}
    >
      <App />
    </FrappeProvider>
  </React.StrictMode>,
)