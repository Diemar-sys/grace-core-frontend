// src/components/Layout.jsx
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { auth } from "../services/frappeAuth";
import { getRoleConfig } from "../config/roles";
import { TENANT } from "../config/tenant";
import "../styles/Layout.css";

// ── Layout ────────────────────────────────────────────
/**
 * Componente Layout principal.
 * Envuelve todas las vistas protegidas, renderizando el Topbar (con usuario y logo)
 * y la barra de navegación lateral/superior (Menubar) según los permisos.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - El contenido específico de la página activa.
 * @returns {JSX.Element} Estructura base de la aplicación.
 */
function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.getUser();
  const roleConfig = getRoleConfig(user?.role);

  const handleLogout = async () => {
    // try/finally: pase lo que pase con auth.logout() (red caída, etc.),
    // SIEMPRE navegamos a /login. El estado local ya se limpió dentro de logout().
    try {
      await auth.logout();
    } finally {
      navigate('/login');
    }
  };

  const [searchParams] = useSearchParams();
  const modoConsulta = searchParams.get('modo') === 'consulta';

  // Rutas que pertenecen a Operaciones (todas las páginas de módulos sin ?modo=consulta)
  const RUTAS_OPERACIONES = new Set([
    '/catalogo', '/inventario', '/compras', '/venta-b2b',
    '/envio-sucursal', '/proveedores', '/pos', '/produccion',
  ]);
  const enOperaciones = RUTAS_OPERACIONES.has(location.pathname) && !modoConsulta;

  // Consultas: rutas /consultas/... O cualquier módulo con ?modo=consulta
  const enConsultas = location.pathname.startsWith('/consultas') || modoConsulta;

  // Reportes
  const enReportes = location.pathname.startsWith('/reportes');

  // Egresos
  const enEgresos = location.pathname.startsWith('/egresos');
  const mostrarMenubar = roleConfig.rutas.includes('/panel');

  return (
    <div className="layout-container">

      {/* TOPBAR */}
      <header className="panel-topbar">
        <div className="panel-topbar-left">
          <img
            src={TENANT.logo}
            alt={TENANT.nombre}
            className="logo-imagen-pq"
          />
          <div>
            <h1>{TENANT.nombre}</h1>
            <span>Sistema ERP Web</span>
          </div>
        </div>
        <div className="panel-topbar-right">
          <div className="panel-user-chip">
            <User size={18} />
            {user?.fullName || user?.email || "Usuario"}
            {user?.posProfile && (
              <span className="user-branch-badge">
                {typeof user.posProfile === 'string' ? user.posProfile : user.posProfile?.name}
              </span>
            )}
          </div>
          <button className="panel-logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {/* BARRA DE MENÚ */}
      {mostrarMenubar && (
        <nav className="layout-menubar">
          <Link
            to="/panel?seccion=operaciones"
            className={"layout-menu-btn" + (enOperaciones ? " active" : "")}
          >
            Operaciones
          </Link>
          <Link
            to="/panel?seccion=consultas"
            className={"layout-menu-btn" + (enConsultas ? " active" : "")}
          >
            Consultas
          </Link>
          <span className="layout-menu-btn disabled">Procesos</span>
          {roleConfig.reportes ? (
            <Link
              to="/panel?seccion=reportes"
              className={"layout-menu-btn" + (enReportes ? " active" : "")}
            >
              Reportes
            </Link>
          ) : (
            <span className="layout-menu-btn disabled">Reportes</span>
          )}
          <span className="layout-menu-btn disabled">Estadísticas</span>
          {roleConfig.rutas.includes('/egresos') && (
            <Link
              to="/egresos"
              className={"layout-menu-btn" + (enEgresos ? " active" : "")}
            >
              Egresos
            </Link>
          )}
          {roleConfig.rutas.includes('/nomina') && (
            <Link
              to="/nomina"
              className={"layout-menu-btn" + (location.pathname.startsWith('/nomina') ? " active" : "")}
            >
              Nómina
            </Link>
          )}
          <span className="layout-menu-btn disabled">Configuración</span>
        </nav>
      )}

      {/* CONTENIDO */}
      <main className="main-content">
        {children}
      </main>

    </div>
  );
}

export default Layout;