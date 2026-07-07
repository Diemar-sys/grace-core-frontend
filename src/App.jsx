// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Panel from './pages/Panel';
import Catalogo from './pages/Catalogo';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import VentaB2B from './pages/VentaB2B';
import EnvioSucursal from './pages/EnvioSucursal';
import POS from './pages/POS';
import Inventario from './pages/Inventario';
import Produccion from './pages/Produccion';
import ProtectedRoute from './components/ProtectedRoute';
import ConsultasPOS from './pages/ConsultasPOS';
import Kardex from './pages/Kardex';
import ReportesVentasCategoria from './pages/ReportesVentasCategoria';
import ReporteGastos from './pages/ReporteGastos';
import ReporteCompras from './pages/ReporteCompras';
import ReporteCuentasPorPagar from './pages/ReporteCuentasPorPagar';
import Egresos from './pages/Egresos';
import Nomina from './pages/Nomina';
import Cuentas from './pages/Cuentas';
import ErrorBoundary from './components/ErrorBoundary';

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
      <ErrorBoundary>
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
          path="/venta-b2b"
          element={
            <ProtectedRoute>
              <VentaB2B />
            </ProtectedRoute>
          }
        />
        <Route
          path="/envio-sucursal"
          element={
            <ProtectedRoute>
              <EnvioSucursal />
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
        <Route
          path="/consultas/kardex"
          element={
            <ProtectedRoute>
              <Kardex />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/ventas-categoria"
          element={
            <ProtectedRoute>
              <ReportesVentasCategoria />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/gastos"
          element={
            <ProtectedRoute>
              <ReporteGastos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/compras"
          element={
            <ProtectedRoute>
              <ReporteCompras />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/cuentas-por-pagar"
          element={
            <ProtectedRoute>
              <ReporteCuentasPorPagar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/egresos"
          element={
            <ProtectedRoute>
              <Egresos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nomina"
          element={
            <ProtectedRoute>
              <Nomina />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cuentas"
          element={
            <ProtectedRoute>
              <Cuentas />
            </ProtectedRoute>
          }
        />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;