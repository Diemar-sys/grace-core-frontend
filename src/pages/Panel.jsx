// src/pages/Panel.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { auth } from "../services/frappeAuth";
import { getRoleConfig } from "../config/roles";
import { TENANT } from "../config/tenant";
import { MODULOS, MODULOS_CONSULTAS, MODULOS_REPORTES, MODULOS_CONFIG } from "../config/modulos";
import "../styles/Panel.css";

// ── Iconos topbar ─────────────────────────────────────
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

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
function ContenidoOperaciones({ modulosPermitidos }) {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const modulos = MODULOS.filter(m => modulosPermitidos.includes(m.key));
  return (
    <>
      <div className="panel-greeting">
        <h2>Operaciones</h2>
        <p>{fecha}</p>
      </div>
      <div className="panel-grid">
        {modulos.map(mod => (
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

function ContenidoReportes() {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  return (
    <>
      <div className="panel-greeting">
        <h2>Reportes</h2>
        <p>{fecha}</p>
      </div>
      <div className="panel-grid">
        {MODULOS_REPORTES.map(mod => (
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

function ContenidoConfiguracion() {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  return (
    <>
      <div className="panel-greeting"><h2>Configuración</h2><p>{fecha}</p></div>
      <div className="panel-grid">
        {MODULOS_CONFIG.map(mod => (
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

function ContenidoConsultas({ modulosPermitidos }) {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const modulos = MODULOS_CONSULTAS.filter(m => modulosPermitidos.includes(m.key));
  return (
    <>
      <div className="panel-greeting">
        <h2>Consultas</h2>
        <p>{fecha}</p>
      </div>
      <div className="panel-grid">
        {modulos.map(mod => (
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
  const roleConfig = getRoleConfig(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [seccion, setSeccion] = useState(searchParams.get("seccion") || "operaciones");

  useEffect(() => {
    const s = searchParams.get("seccion");
    if (s && s !== seccion) setSeccion(s);
  }, [searchParams, seccion]);

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

      {/* BARRA DE MENÚ — habilitado por capacidad del nivel */}
      <nav className="panel-menubar">
        {MENU.map(item => {
          // procesos/estadisticas: siempre "próximamente" (deshabilitado).
          const habilitado = {
            operaciones:   roleConfig.modulosPanel.length > 0,
            consultas:     roleConfig.modulosPanel.length > 0,
            procesos:      false,
            reportes:      !!roleConfig.reportes,
            estadisticas:  false,
            configuracion: !!user?.puedeCuentas,
          }[item.key];
          const isActive = seccion === item.key;

          if (!habilitado) {
            return (
              <span key={item.key} className="panel-menu-btn disabled"
                style={{ opacity: 0.35, cursor: 'default' }}>
                {item.label}
              </span>
            );
          }
          return (
            <button key={item.key}
              className={"panel-menu-btn" + (isActive ? " active" : "")}
              onClick={() => handleTabChange(item.key)}>
              {item.label}
            </button>
          );
        })}
        {/* Egresos no lleva pestaña: entra por su tile dentro de Operaciones. */}
      </nav>

      {/* CONTENIDO */}
      <div className="panel-body">
        {seccion === "operaciones" && <ContenidoOperaciones modulosPermitidos={roleConfig.modulosPanel} />}
        {seccion === "consultas" && <ContenidoConsultas modulosPermitidos={roleConfig.modulosPanel} />}
        {seccion === "procesos" && <Proximamente titulo="Procesos" />}
        {seccion === "reportes" && (roleConfig.reportes
          ? <ContenidoReportes />
          : <Proximamente titulo="Reportes" />)}
        {seccion === "estadisticas" && <Proximamente titulo="Estadísticas" />}
        {seccion === "configuracion" && (user?.puedeCuentas
          ? <ContenidoConfiguracion />
          : <Proximamente titulo="Configuración" />)}
      </div>

    </div>
  );
}

export default Panel;