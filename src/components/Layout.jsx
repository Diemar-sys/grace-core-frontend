// src/components/Layout.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../services/frappeAuth";
import { getRoleConfig } from "../config/roles";
import { TENANT } from "../config/tenant";
import "../styles/Layout.css";

// ── Iconos ────────────────────────────────────────────
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/></svg>
);
const CatalogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M12 7v14m4-9h2m-2-4h2M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3zm3-6h2M6 8h2"/></svg>
);
const BoxSearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M12 22V12m8.27 6.27L22 20m-1-9.502V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l.98-.559"/><path d="M3.29 7 12 12l8.71-5"/><circle cx="18.5" cy="16.5" r="2.5"/></svg>
);
const CartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
);
const TruckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"/><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2M9 18h5"/><circle cx="16" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
);
const POSIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><rect width="14" height="8" x="5" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h2m4 0h6"/></svg>
);

// ── Nav items ─────────────────────────────────────────
const NAV_ITEMS = [
  { path: "/catalogo", label: "Catálogo", icon: <CatalogIcon /> },
  { path: "/inventario", label: "Inventario", icon: <BoxSearchIcon /> },
  { path: "/compras", label: "Compras", icon: <CartIcon /> },
  { path: "/proveedores", label: "Proveedores", icon: <TruckIcon /> },
  { path: "/pos", label: "Punto de Venta", icon: <POSIcon /> },
];

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
  const navItems = NAV_ITEMS.filter(i => roleConfig.rutas.includes(i.path));

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
            <UserIcon />
            {user?.fullName || user?.email || "Usuario"}
            {user?.posProfile && (
              <span className="user-branch-badge">
                {typeof user.posProfile === 'string' ? user.posProfile : user.posProfile?.name}
              </span>
            )}
          </div>
          <button className="panel-logout-btn" onClick={handleLogout}>
            <LogoutIcon /> Salir
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
          <Link
            to="/panel?seccion=reportes"
            className={"layout-menu-btn" + (enReportes ? " active" : "")}
          >
            Reportes
          </Link>
          <span className="layout-menu-btn disabled">Estadísticas</span>
          {roleConfig.rutas.includes('/panel') && (
            <Link
              to="/egresos"
              className={"layout-menu-btn" + (enEgresos ? " active" : "")}
            >
              Egresos
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