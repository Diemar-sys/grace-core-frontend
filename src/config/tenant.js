/**
 * tenant.js — Configuración del cliente/negocio.
 *
 * TODA la identidad del negocio vive aquí y se lee desde variables de entorno.
 * Para adaptar el sistema a otro negocio basta con cambiar el archivo .env
 * sin tocar ninguna línea de código fuente.
 *
 * Variables disponibles: ver .env.example en la raíz del proyecto.
 */

const env = import.meta.env;

export const TENANT = {
  // ── Identidad visual ──────────────────────────────────────────────────────
  /** Nombre corto que aparece en el topbar y tickets */
  nombre:     env.VITE_EMPRESA_NOMBRE     || 'Panaderías Grace',
  /** Subtítulo debajo del nombre (giro del negocio) */
  subtitulo:  env.VITE_EMPRESA_SUBTITULO  || 'Panadería & Repostería',
  /** Nombre completo en mayúsculas para encabezados de tickets */
  nombreFull: env.VITE_EMPRESA_NOMBRE_FULL || 'PANADERÍAS GRACE',
  /** Dirección impresa en tickets */
  direccion:  env.VITE_EMPRESA_DIRECCION  || 'AV. SANTUARIO DEL MILAGRO',
  /** Teléfono impreso en tickets */
  telefono:   env.VITE_EMPRESA_TELEFONO   || '4425991147',
  /** Sitio web impreso al pie de los tickets */
  web:        env.VITE_EMPRESA_WEB        || 'www.panaderiasgrace.mx',
  /** Ruta del logo en /public (sin barra inicial) */
  logo:       env.VITE_EMPRESA_LOGO       || '/logo_GRACE.png',

  // ── ERPNext / Frappe ──────────────────────────────────────────────────────
  /** Nombre exacto de la empresa en ERPNext (campo "Company") */
  erpCompany:         env.VITE_ERP_COMPANY            || 'Panaderias Grace',
  /** Nombre del almacén central de insumos */
  bodegaCentral:      env.VITE_BODEGA_CENTRAL          || 'BODEGA CENTRAL - INSUMOS - PG',
  /** Cliente genérico para ventas al público */
  defaultCustomer:    env.VITE_DEFAULT_CUSTOMER        || 'Público en General',
  /** POS Profile de respaldo si el usuario no tiene uno asignado */
  posProfileDefault:  env.VITE_POS_PROFILE_DEFAULT     || 'Grace POS',
  /** Nombre del módulo Python en Frappe (gestion_panaderia, mi_negocio_app, etc.) */
  frappeApp:          env.VITE_FRAPPE_APP              || 'gestion_panaderia',

  // ── Sucursales ────────────────────────────────────────────────────────────
  /** Lista de sucursales separadas por coma en la variable de entorno */
  sucursales: env.VITE_SUCURSALES
    ? env.VITE_SUCURSALES.split(',').map(s => s.trim()).filter(Boolean)
    : ['Santuarios', 'Pirámides', 'Puerta Real', 'Paseos del Bosque'],
};
