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
 * Modelo 2026-05-18:
 * - PUERTA REAL es Customer B2B normal: se le vende pan + abarrotes vía
 *   Sales Invoice (genera deuda, se cobra en Libreta).
 * - Solo la materia prima va por Stock Entry Material Transfer.
 * - `sucursales_internas` queda normalmente vacío; se conserva el
 *   mecanismo por si en el futuro hay una sucursal de transferencia pura.
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

/**
 * Clientes que reciben su materia prima por transferencia, no por venta B2B.
 * Para ellos la materia prima se oculta del buscador de productos en Venta B2B
 * (pan y abarrotes sí se les venden; la MP va por el módulo Envío a Sucursal).
 *
 * Hoy solo ALEJANDRO TORRES (antes "PUERTA REAL", Customer renombrado
 * 2026-07-03; sucursal del hermano del dueño). Si en el futuro hay otro
 * cliente con el mismo trato, agregar su nombre aquí.
 *
 * Nota: esto es una guía de UX, no una barrera de seguridad. El bloqueo
 * real (que la MP no entre a un Sales Invoice de este cliente) debe vivir
 * en un hook de backend, igual que las validaciones P0.
 */
const CLIENTES_MP_POR_TRANSFERENCIA = ['ALEJANDRO TORRES'];

/** ¿A este cliente se le oculta la materia prima en el buscador de Venta B2B? */
export function ocultaMateriaPrima(customerName) {
  return !!customerName && CLIENTES_MP_POR_TRANSFERENCIA.includes(customerName);
}
