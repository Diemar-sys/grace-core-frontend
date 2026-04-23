// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Panel from './pages/Panel';
import Catalogo from './pages/Catalogo';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import POS from './pages/POS';
import Inventario from './pages/Inventario';
import Produccion from './pages/Produccion';
import ProtectedRoute from './components/ProtectedRoute';
import ConsultasPOS from './pages/ConsultasPOS';

/**
 * Componente principal de la aplicación.
 * Configura el enrutador (React Router) y define las rutas públicas y privadas.
 * Utiliza `ProtectedRoute` para asegurar las vistas de administración.
 *
 * @returns {JSX.Element} Aplicación montada con rutas configuradas.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route
          path="/panel"
          element={
            <ProtectedRoute>
              <Panel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogo"
          element={
            <ProtectedRoute>
              <Catalogo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <ProtectedRoute>
              <Inventario />
            </ProtectedRoute>
          }
        />
        <Route
          path="/proveedores"
          element={
            <ProtectedRoute>
              <Proveedores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compras"
          element={
            <ProtectedRoute>
              <Compras />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <POS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/produccion"
          element={
            <ProtectedRoute>
              <Produccion />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultas/pos"
          element={
            <ProtectedRoute>
              <ConsultasPOS />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;