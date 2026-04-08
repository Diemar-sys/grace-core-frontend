// src/components/Layout.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../services/frappeAuth";
import "../styles/Layout.css";

// ── Iconos ────────────────────────────────────────────
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const CatalogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 7v14" /><path d="M16 12h2" /><path d="M16 8h2" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    <path d="M6 12h2" /><path d="M6 8h2" />
  </svg>
);
const BoxSearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12" /><path d="M20.27 18.27 22 20" />
    <path d="M21 10.498V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l.98-.559" />
    <path d="M3.29 7 12 12l8.71-5" /><circle cx="18.5" cy="16.5" r="2.5" />
  </svg>
);
const CartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);
const TruckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" />
    <path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" />
    <path d="M9 18h5" /><circle cx="16" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
  </svg>
);
const POSIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="8" x="5" y="2" rx="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" />
    <path d="M6 18h2" /><path d="M12 18h6" />
  </svg>
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

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  const [searchParams] = useSearchParams();
  const modoConsulta = searchParams.get('modo') === 'consulta';
  const enOperaciones = NAV_ITEMS.some(i => i.path === location.pathname) && !modoConsulta;
  const enConsultas   = modoConsulta;

  return (
    <div className="layout-container">

      {/* TOPBAR */}
      <header className="panel-topbar">
        <div className="panel-topbar-left">
          <img
            src="/logo_GRACE.png"
            alt="Grace Panadería & Repostería"
            className="logo-imagen-pq"
          />
          <div>
            <h1>Panaderías Grace</h1>
            <span>Sistema de Gestión</span>
          </div>
        </div>
        <div className="panel-topbar-right">
          <div className="panel-user-chip">
            <UserIcon />
            {user?.fullName || user?.email || "Usuario"}
          </div>
          <button className="panel-logout-btn" onClick={handleLogout}>
            <LogoutIcon /> Salir
          </button>
        </div>
      </header>

      {/* BARRA DE MENÚ */}
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
        <span className="layout-menu-btn disabled">Reportes</span>
        <span className="layout-menu-btn disabled">Estadísticas</span>
        <span className="layout-menu-btn disabled">Configuración</span>
      </nav>

      {/* CONTENIDO */}
      <main className="main-content">
        {children}
      </main>

    </div>
  );
}

export default Layout;