// src/App.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../modulos/acceso/Login';
import Recuperar from '../modulos/acceso/Recuperar';
import Panel from '../modulos/acceso/Panel';
import ProtectedRoute from './ProtectedRoute';
import ErrorBoundary from './ErrorBoundary';
import BannerConexion from './BannerConexion';
import { useSesionCompartida } from '../compartido/hooks/useSesionCompartida';
import AvisoSesion from './AvisoSesion';
import AvisoMantenimiento from './AvisoMantenimiento';
import { useAvisoMantenimiento, MantenimientoContext } from '../compartido/hooks/useAvisoMantenimiento';

// Carga inmediata: vistas operativas principales
import Catalogo from '../modulos/operaciones/catalogo/Catalogo';
import POS from '../modulos/operaciones/punto-de-venta/POS';
import Inventario from '../modulos/operaciones/inventario/Inventario';
import Compras from '../modulos/operaciones/compras/Compras';
import VentaB2B from '../modulos/operaciones/venta-b2b/VentaB2B';
import EnvioSucursal from '../modulos/operaciones/envio-sucursal/EnvioSucursal';
import Produccion from '../modulos/operaciones/produccion/Produccion';
import Pedido from '../modulos/operaciones/pedido/Pedido';
import Egresos from '../modulos/operaciones/egresos/Egresos';
import Proveedores from '../modulos/operaciones/proveedores/Proveedores';

// Code Splitting (React.lazy): vistas secundarias y reportes pesados
const ConsultaPedido = lazy(() => import('../modulos/consultas/pedido/ConsultaPedido'));
const ConsultaTablero = lazy(() => import('../modulos/consultas/tablero/ConsultaTablero'));
const ConsultasPOS = lazy(() => import('../modulos/consultas/punto-de-venta/ConsultasPOS'));
const Kardex = lazy(() => import('../modulos/consultas/kardex/Kardex'));
const Liquidacion = lazy(() => import('../modulos/repartidor/liquidacion/Liquidacion'));
const MiCuenta = lazy(() => import('../modulos/cliente/mi-cuenta/MiCuenta'));
const ReportesVentasCategoria = lazy(() => import('../modulos/reportes/ventas-categoria/ReportesVentasCategoria'));
const ReporteGastos = lazy(() => import('../modulos/reportes/gastos/ReporteGastos'));
const ReporteGastosAnual = lazy(() => import('../modulos/reportes/gastos-anual/ReporteGastosAnual'));
const ReporteCompras = lazy(() => import('../modulos/reportes/compras/ReporteCompras'));
const ReporteValorizacion = lazy(() => import('../modulos/reportes/valorizacion/ReporteValorizacion'));
const ReportePorGrupo = lazy(() => import('../modulos/reportes/por-grupo/ReportePorGrupo'));
const ReporteCuentasPorPagar = lazy(() => import('../modulos/reportes/cuentas-por-pagar/ReporteCuentasPorPagar'));
const ReporteCuentasPorCobrar = lazy(() => import('../modulos/reportes/cuentas-por-cobrar/ReporteCuentasPorCobrar'));
const Nomina = lazy(() => import('../modulos/procesos/nomina/Nomina'));
const Cuentas = lazy(() => import('../modulos/configuracion/cuentas/Cuentas'));
const Auditoria = lazy(() => import('../modulos/configuracion/auditoria/Auditoria'));
const HojaDelDia = lazy(() => import('../modulos/operaciones/hoja/HojaDelDia'));

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
  // una sola sesión por navegador: si otra pestaña sale o cambia de usuario, esta se bloquea con un aviso
  const cambioSesion = useSesionCompartida();
  // aviso de mantenimiento (mantenimiento.sh aviso/on): para todas las pantallas, Login incluido
  const mantenimiento = useAvisoMantenimiento();
  return (
    <MantenimientoContext.Provider value={mantenimiento}>
    {/* Fuera del ErrorBoundary: en mantenimiento una pantalla perezosa da 503, el boundary
        cambia todo por «Algo salió mal» y se llevaba el aviso con él (22-oct). */}
    <AvisoMantenimiento estado={mantenimiento} />
    <BrowserRouter>
      <ErrorBoundary>
      {/* Fuera de <Routes>: el aviso de red sale en cualquier pantalla,
          incluido el Panel, que no pasa por Layout. */}
      <BannerConexion />
      <AvisoSesion cambio={cambioSesion} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Ruta pública */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          {/* 09-nov: sin sesión. /update-password es el enlace del correo (nombre que pone Frappe) */}
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/update-password" element={<Recuperar />} />

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
            path="/reportes/por-grupo"
            element={
              <ProtectedRoute>
                <ReportePorGrupo />
              </ProtectedRoute>
            }
          />
          {/* 19-nov: la ruta vieja (marcadores) */}
          <Route path="/reportes/camionetas" element={<Navigate to="/reportes/por-grupo" replace />} />
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
            path="/hoja"
            element={
              <ProtectedRoute>
                <HojaDelDia />
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
          {/* Cierre de ruta. Es la UNICA pantalla del nivel Repartidor: su
              config de roles no incluye /panel, asi que cualquier otra ruta lo
              devuelve aqui. */}
          <Route
            path="/liquidacion"
            element={
              <ProtectedRoute>
                <Liquidacion />
              </ProtectedRoute>
            }
          />
          {/* 16-oct: la UNICA pantalla del nivel Cliente (Alejandro): ve solo lo suyo. */}
          <Route
            path="/mi-cuenta"
            element={
              <ProtectedRoute>
                <MiCuenta />
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
    </MantenimientoContext.Provider>
  );
}

export default App;