// src/App.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Panel from './pages/Panel';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import BannerConexion from './components/BannerConexion';

// Carga inmediata: vistas operativas principales
import Catalogo from './pages/Catalogo';
import POS from './pages/POS';
import Inventario from './pages/Inventario';
import Compras from './pages/Compras';
import VentaB2B from './pages/VentaB2B';
import EnvioSucursal from './pages/EnvioSucursal';
import Produccion from './pages/Produccion';
import Pedido from './pages/Pedido';
import Egresos from './pages/Egresos';
import Proveedores from './pages/Proveedores';

// Code Splitting (React.lazy): vistas secundarias y reportes pesados
const ConsultaPedido = lazy(() => import('./pages/ConsultaPedido'));
const ConsultaTablero = lazy(() => import('./pages/ConsultaTablero'));
const ConsultasPOS = lazy(() => import('./pages/ConsultasPOS'));
const Kardex = lazy(() => import('./pages/Kardex'));
const ReportesVentasCategoria = lazy(() => import('./pages/ReportesVentasCategoria'));
const ReporteGastos = lazy(() => import('./pages/ReporteGastos'));
const ReporteGastosAnual = lazy(() => import('./pages/ReporteGastosAnual'));
const ReporteCompras = lazy(() => import('./pages/ReporteCompras'));
const ReporteValorizacion = lazy(() => import('./pages/ReporteValorizacion'));
const ReporteCuentasPorPagar = lazy(() => import('./pages/ReporteCuentasPorPagar'));
const ReporteCuentasPorCobrar = lazy(() => import('./pages/ReporteCuentasPorCobrar'));
const Nomina = lazy(() => import('./pages/Nomina'));
const Cuentas = lazy(() => import('./pages/Cuentas'));
const Auditoria = lazy(() => import('./pages/Auditoria'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#6b7280', fontSize: '14px' }}>
      Cargando sección...
    </div>
  );
}

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
      {/* Fuera de <Routes>: el aviso de red sale en cualquier pantalla,
          incluido el Panel, que no pasa por Layout. */}
      <BannerConexion />
      <Suspense fallback={<PageLoader />}>
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
            path="/pedido"
            element={
              <ProtectedRoute>
                <Pedido />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultas/pedido"
            element={
              <ProtectedRoute>
                <ConsultaPedido />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportes/valorizacion"
            element={
              <ProtectedRoute>
                <ReporteValorizacion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultas/tablero"
            element={
              <ProtectedRoute>
                <ConsultaTablero />
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
            path="/reportes/gastos-anual"
            element={
              <ProtectedRoute>
                <ReporteGastosAnual />
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
            path="/reportes/cuentas-por-cobrar"
            element={
              <ProtectedRoute>
                <ReporteCuentasPorCobrar />
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
          <Route
            path="/auditoria"
            element={
              <ProtectedRoute>
                <Auditoria />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;