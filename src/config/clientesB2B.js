/**
 * Mapping cliente B2B → warehouse destino (sucursal extendida).
 *
 * Si el cliente NO está en el map, la venta es "cliente puro": Sales Invoice
 * baja stock de Bodega Central y el destino sale del sistema.
 *
 * Si SÍ está, Sales Invoice + Delivery Note implícito mueve stock a su tienda.
 */
export const TARGET_WAREHOUSE_POR_CLIENTE = {
  'PUERTA REAL': 'TIENDA - PUERTA - PG',
};

/** Devuelve el warehouse destino para un cliente, o null si es cliente puro. */
export function getTargetWarehouse(customerName) {
  return TARGET_WAREHOUSE_POR_CLIENTE[customerName] || null;
}

/** ¿El cliente tiene sucursal extendida con warehouse propio? */
export function esSucursalExtendida(customerName) {
  return !!TARGET_WAREHOUSE_POR_CLIENTE[customerName];
}
