// src/config/modulos.jsx
//
// Los tiles del panel: qué módulo se pinta, a qué ruta va y con qué cara.
//
// Viven aquí y no en Panel.jsx porque Panel.rutas.test.js los recorre para
// verificar que cada tile tenga su ruta dada de alta en roles.ts y en las rutas
// de Layout.jsx. Un tile sin eso se pinta pero rebota al panel, y parece que el
// clic no hace nada; ya pasó dos veces. Una página que exporta datos además de
// su componente pierde el fast refresh, así que los datos se mudaron solos.
//
// La `key` es la del módulo en roles.ts, NO la ruta: varios tiles comparten
// módulo (Catálogo y Kardex cuelgan de inventario) y el permiso es del módulo.

import {
  IconAuditoria,
  IconCatalogo,
  IconCompras,
  IconCuentas,
  IconEgresos,
  IconEnvioSucursal,
  IconInventario,
  IconPOS,
  IconProduccion,
  IconProveedores,
  IconReporte,
  IconVentaB2B,
} from "./iconosModulos";

// ── Módulos de Operaciones ────────────────────────────
export const MODULOS = [
  { key: "catalogo",    path: "/catalogo",    icon: <IconCatalogo />,   nombre: "Catálogo",        sub: "Catálogos",         color: "#d08700",    bg: "#fff8e6" },
  { key: "inventario",  path: "/inventario",  icon: <IconInventario />, nombre: "Inventario",      sub: "Inventarios",       color: "#2e7d32",    bg: "#e8f5e9" },
  { key: "compras",     path: "/compras",     icon: <IconCompras />,    nombre: "Compras",         sub: "Entradas",          color: "#1565c0",    bg: "#e3f0ff" },
  { key: "venta_b2b",   path: "/venta-b2b",   icon: <IconVentaB2B />,   nombre: "Venta B2B",       sub: "Mayoreo",           color: "#388e3c",    bg: "#e8f5e9" },
  { key: "envio_sucursal", path: "/envio-sucursal", icon: <IconEnvioSucursal />, nombre: "Envío a Sucursal", sub: "Transferencia interna", color: "#0891b2",  bg: "#cffafe" },
  { key: "proveedores", path: "/proveedores", icon: <IconProveedores />,nombre: "Proveedores",     sub: "Catálogos",         color: "#6a1b9a",    bg: "#f3e5f5" },
  { key: "pos",         path: "/pos",         icon: <IconPOS />,        nombre: "Punto de Venta",  sub: "Ventas",            color: "#bf360c",    bg: "#fbe9e7" },
  { key: "pedido",      path: "/pedido",      icon: <IconProduccion />, nombre: "Pedido del día",  sub: "Importar de Drive", color: "#7c3aed",    bg: "#ede9fe" },
  { key: "produccion",  path: "/produccion",  icon: <IconProduccion />, nombre: "Producción",      sub: "Recetas y consumo", color: "#3b848aff",  bg: "#d1f0f3ff" },
  { key: "egresos",     path: "/egresos",     icon: <IconEgresos />,    nombre: "Egresos",         sub: "Gastos y pagos",    color: "#dc2626",    bg: "#fee2e2" },
];

export const MODULOS_CONSULTAS = [
  { key: "catalogo",    path: "/catalogo?modo=consulta",    icon: <IconCatalogo />,    nombre: "Catálogo",       sub: "Ver registros",      color: "#d08700",   bg: "#fff8e6" },
  { key: "inventario",  path: "/inventario?modo=consulta",  icon: <IconInventario />,  nombre: "Inventario",     sub: "Ver registros",      color: "#2e7d32",   bg: "#e8f5e9" },
  { key: "inventario",  path: "/consultas/kardex",          icon: <IconInventario />,  nombre: "Kardex",         sub: "Movimientos por producto", color: "#0f766e", bg: "#ccfbf1" },
  { key: "compras",     path: "/compras?modo=consulta",     icon: <IconCompras />,     nombre: "Compras",        sub: "Ver registros",      color: "#1565c0",   bg: "#e3f0ff" },
  { key: "venta_b2b",   path: "/venta-b2b?modo=consulta",   icon: <IconVentaB2B />,    nombre: "Venta B2B",      sub: "Historial de ventas", color: "#388e3c",   bg: "#e8f5e9" },
  { key: "envio_sucursal", path: "/envio-sucursal?modo=consulta", icon: <IconEnvioSucursal />, nombre: "Envío a Sucursal", sub: "Ver registros", color: "#0891b2", bg: "#cffafe" },
  { key: "proveedores", path: "/proveedores?modo=consulta", icon: <IconProveedores />, nombre: "Proveedores",    sub: "Ver registros",      color: "#6a1b9a",   bg: "#f3e5f5" },
  { key: "pos",         path: "/consultas/pos",             icon: <IconPOS />,         nombre: "Punto de Venta", sub: "Historial de ventas", color: "#bf360c",   bg: "#fbe9e7" },
  { key: "produccion",  path: "/produccion?modo=consulta",  icon: <IconProduccion />,  nombre: "Producción",     sub: "Ver registros",      color: "#3b848aff", bg: "#d1f0f3ff" },
  { key: "egresos",     path: "/egresos?modo=consulta",     icon: <IconEgresos />,     nombre: "Egresos",        sub: "Ver registros",      color: "#dc2626",   bg: "#fee2e2" },
];

// ── Módulos de Reportes ───────────────────────────────

export const MODULOS_REPORTES = [
  { key: "egresos", path: "/reportes/gastos", icon: <IconReporte />, nombre: "Gastos", sub: "Gasto por cuenta y periodo", color: "#b45309", bg: "#fef3c7" },
  { key: "gastos_anual", path: "/reportes/gastos-anual", icon: <IconReporte />, nombre: "Gastos del Año", sub: "Todo el gasto por mes y categoría", color: "#b91c1c", bg: "#fee2e2" },
  { key: "ventas_categoria", path: "/reportes/ventas-categoria", icon: <IconReporte />, nombre: "Ventas por Categoría", sub: "B2B agrupado por item_group", color: "#7c2d12", bg: "#fed7aa" },
  { key: "compras_reporte", path: "/reportes/compras", icon: <IconReporte />, nombre: "Compras", sub: "Resumen fiscal mensual por proveedor", color: "#1565c0", bg: "#e3f0ff" },
  { key: "cxp_reporte", path: "/reportes/cuentas-por-pagar", icon: <IconReporte />, nombre: "Cuentas por Pagar", sub: "Saldo de egresos por proveedor", color: "#b45309", bg: "#fef3c7" },
  { key: "cxc_reporte", path: "/reportes/cuentas-por-cobrar", icon: <IconReporte />, nombre: "Cuentas por Cobrar", sub: "Saldo de ventas B2B por cliente", color: "#15803d", bg: "#dcfce7" },
];

// ── Configuración ─────────────────────────────────────

export const MODULOS_CONFIG = [
  { key: "cuentas", path: "/cuentas", icon: <IconCuentas />, nombre: "Cuentas", sub: "Usuarios y permisos", color: "#475569", bg: "#e2e8f0" },
  { key: "auditoria", path: "/auditoria", icon: <IconAuditoria />, nombre: "Auditoría", sub: "Quién registró cada movimiento", color: "#6a1b9a", bg: "#f3e5f5" },
];
