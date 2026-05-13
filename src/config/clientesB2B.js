/**
 * Sucursales internas — NO son clientes B2B reales.
 *
 * Decisión arquitectónica 2026-05-12:
 * - PUERTA REAL es sucursal interna administrada por hermano del dueño.
 *   Dueño legal sigue siendo matriz (Panaderias Grace).
 * - Envío matriz → sucursal = Stock Entry Material Transfer (BODEGA → warehouse sucursal).
 *   NO Sales Invoice (no genera ingreso, es movimiento interno).
 * - Ventas reales en sucursal (workers libreta) ocurren EN la sucursal, no desde matriz.
 *
 * Este módulo expone el set de customers que NO deben aparecer en el flujo B2B.
 * Si alguno está registrado como Customer en ERPNext (legacy), se filtra del buscador.
 *
 * Clientes B2B reales (externos): DULCE CARAMEL, DELI, ZAKIA, etc. NO se incluyen aquí.
 */

const SUCURSALES_INTERNAS = new Set([
  'PUERTA REAL',
]);

/** ¿El customer es sucursal interna (no debe usarse en B2B sales)? */
export function esSucursalInterna(customerName) {
  if (!customerName) return false;
  return SUCURSALES_INTERNAS.has(customerName);
}

/** Set de nombres de sucursales internas (para filtros). */
export function getSucursalesInternas() {
  return [...SUCURSALES_INTERNAS];
}
