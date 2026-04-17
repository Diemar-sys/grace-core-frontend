// src/pages/Panel.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../services/frappeAuth";
import "../styles/Panel.css";

// ── Iconos topbar ─────────────────────────────────────
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
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

// ── Iconos de módulos ─────────────────────────────────
const IconCatalogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 7v14" /><path d="M16 12h2" /><path d="M16 8h2" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    <path d="M6 12h2" /><path d="M6 8h2" />
  </svg>
);
const IconInventario = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12" /><path d="M20.27 18.27 22 20" />
    <path d="M21 10.498V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l.98-.559" />
    <path d="M3.29 7 12 12l8.71-5" /><circle cx="18.5" cy="16.5" r="2.5" />
  </svg>
);
const IconCompras = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);
const IconProveedores = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" />
    <path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" />
    <path d="M9 18h5" /><circle cx="16" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
  </svg>
);
const IconPOS = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="8" x="5" y="2" rx="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" />
    <path d="M6 18h2" /><path d="M12 18h6" />
  </svg>
);
const IconProduccion = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    className="lucide lucide-wheat-icon lucide-wheat">
    <path d="M2 22 16 8" />
    <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
    <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
    <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
    <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
  </svg>
);

// ── Módulos de Operaciones ────────────────────────────
const MODULOS = [
  { path: "/catalogo", icon: <IconCatalogo />, nombre: "Catálogo", sub: "Catálogos", color: "#d08700", bg: "#fff8e6" },
  { path: "/inventario", icon: <IconInventario />, nombre: "Inventario", sub: "Inventarios", color: "#2e7d32", bg: "#e8f5e9" },
  { path: "/compras", icon: <IconCompras />, nombre: "Compras", sub: "Entradas", color: "#1565c0", bg: "#e3f0ff" },
  { path: "/proveedores", icon: <IconProveedores />, nombre: "Proveedores", sub: "Catálogos", color: "#6a1b9a", bg: "#f3e5f5" },
  { path: "/pos", icon: <IconPOS />, nombre: "Punto de Venta", sub: "Ventas", color: "#bf360c", bg: "#fbe9e7" },
  { path: "/produccion", icon: <IconProduccion />, nombre: "Producción", sub: "Recetas y consumo", color: "#3b848aff", bg: "#d1f0f3ff" },
];

// ── Opciones del menú principal ───────────────────────
const MENU = [
  { key: "operaciones", label: "Operaciones" },
  { key: "consultas", label: "Consultas" },
  { key: "procesos", label: "Procesos" },
  { key: "reportes", label: "Reportes" },
  { key: "estadisticas", label: "Estadísticas" },
  { key: "configuracion", label: "Configuración" },
];

// ── Contenido por sección ─────────────────────────────
/**
 * Subcomponente para renderizar un aviso estandarizado de módulos en desarrollo.
 * @param {Object} props - Constelación de props.
 * @param {string} props.titulo - Nombre del módulo faltante.
 * @returns {JSX.Element} Panel tipo caja informativa.
 */
function Proximamente({ titulo }) {
  return (
    <div className="panel-soon">
      <ClockIcon />
      <h3>{titulo}</h3>
      <p>Este módulo estará disponible próximamente.</p>
    </div>
  );
}

/**
 * Subcomponente de contenido que inyecta lae cuadrícula de botones (módulos operativos).
 * @returns {JSX.Element} Grid interactivo de operaciones (catálogo, inventario, compras, etc.).
 */
function ContenidoOperaciones() {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  return (
    <>
      <div className="panel-greeting">
        <h2>Operaciones</h2>
        <p>{fecha}</p>
      </div>
      <div className="panel-grid">
        {MODULOS.map(mod => (
          <Link key={mod.path} to={mod.path} className="panel-module"
            style={{ "--mod-color": mod.color, "--mod-bg": mod.bg }}>
            <div className="panel-module-icon">{mod.icon}</div>
            <span className="panel-module-name">{mod.nombre}</span>
            <span className="panel-module-sub">{mod.sub}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

/**
 * Subcomponente de contenido para la sección Consultas.
 * Muestra los mismos módulos que Operaciones pero en modo solo lectura.
 * @returns {JSX.Element} Grid de consultas.
 */
function ContenidoConsultas() {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  return (
    <>
      <div className="panel-greeting">
        <h2>Consultas</h2>
        <p>{fecha}</p>
        <span style={{ fontSize: 12, color: '#7a3f0a', background: '#fff1de', padding: '3px 10px', borderRadius: 20, display: 'inline-block', marginTop: 4 }}>
          SÓLO LECTURA
        </span>
      </div>
      <div className="panel-grid">
        {MODULOS.map(mod => (
          <Link key={mod.path} to={`${mod.path}?modo=consulta`} className="panel-module"
            style={{ "--mod-color": mod.color, "--mod-bg": mod.bg }}>
            <div className="panel-module-icon">{mod.icon}</div>
            <span className="panel-module-name">{mod.nombre}</span>
            <span className="panel-module-sub">Solo lectura</span>
          </Link>
        ))}
      </div>
    </>
  );
}

// ── Componente principal ──────────────────────────────
/**
 * Dashboard o Panel de control principal tras el inicio de sesión.
 * Sirve como Home interno brindando acceso rápido a los módulos del ERP.
 * Configura la barra superior, menú de navegación secundario y enruta el contenido.
 *
 * @returns {JSX.Element} Panel principal.
 */
function Panel() {
  const navigate = useNavigate();
  const user = auth.getUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [seccion, setSeccion] = useState(searchParams.get("seccion") || "operaciones");

  useEffect(() => {
    const s = searchParams.get("seccion");
    if (s && s !== seccion) setSeccion(s);
  }, [searchParams]);

  const handleTabChange = (key) => {
    setSeccion(key);
    searchParams.set("seccion", key);
    setSearchParams(searchParams, { replace: true });
  };

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  return (
    <div className="panel-root">

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
            <span>Sistema ERP Web</span>
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
      <nav className="panel-menubar">
        {MENU.map(item => (
          <button
            key={item.key}
            className={"panel-menu-btn" + (seccion === item.key ? " active" : "")}
            onClick={() => handleTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* CONTENIDO */}
      <div className="panel-body">
        {seccion === "operaciones" && <ContenidoOperaciones />}
        {seccion === "consultas" && <ContenidoConsultas />}
        {seccion === "procesos" && <Proximamente titulo="Procesos" />}
        {seccion === "reportes" && <Proximamente titulo="Reportes" />}
        {seccion === "estadisticas" && <Proximamente titulo="Estadísticas" />}
        {seccion === "configuracion" && <Proximamente titulo="Configuración" />}
      </div>

    </div>
  );
}

export default Panel;