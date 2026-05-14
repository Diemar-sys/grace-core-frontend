/**
 * Helpers sucursales internas / extendidas.
 *
 * Backend = single source of truth (custom fields
 * Customer.custom_es_sucursal_interna + Warehouse.custom_es_sucursal_extendida).
 *
 * Frontend pre-carga al login via `loadSucursalesConfig()`; este módulo
 * solo expone wrappers sync que leen el cache. Si en algún momento se
 * agrega una sucursal nueva en ERPNext desk, basta con relogin para que
 * el frontend la vea (o llamar loadSucursalesConfig() manualmente).
 *
 * Decisión arquitectónica 2026-05-12:
 * - PUERTA REAL es sucursal interna administrada por hermano del dueño.
 * - Envío matriz → sucursal = Stock Entry Material Transfer (no Sales Invoice).
 * - Backend hook bloquea SI con customer en sucursales internas.
 */

import { getSucursalesConfigSync } from '../services/sucursalesConfig';

/** ¿El customer es sucursal interna (no debe usarse en B2B sales)? */
export function esSucursalInterna(customerName) {
  if (!customerName) return false;
  const { sucursales_internas } = getSucursalesConfigSync();
  return sucursales_internas.includes(customerName);
}

/** Lista de nombres de sucursales internas (para filtros). */
export function getSucursalesInternas() {
  return [...getSucursalesConfigSync().sucursales_internas];
}

/** Lista de sucursales destino para Envío Sucursal (con warehouse asociado). */
export function getSucursalesDestino() {
  return [...getSucursalesConfigSync().sucursales_destino];
}
