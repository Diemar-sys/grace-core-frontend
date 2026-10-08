// Precio y visibilidad de la Venta B2B (salen de components/NuevaVentaB2B.jsx el 07-oct, sin cambios de lógica).
import { getTasa } from '../config/impuestos';
import { inventory } from '../services/frappeInventory';

type Item = Record<string, any>;

/** El pan ya no se vende por Venta B2B: se cobra desde la Hoja del día (Diemar 22-sep). */
const esPan = (item: Item | null | undefined): boolean =>
  (item?.custom_tipo_item || '').trim().toUpperCase() === 'PRODUCTO TERMINADO';

/**
 * Precio B2B por unidad base, SIN impuesto (el impuesto se suma encima al vender).
 *  • Abarrote: custom_precio_de_venta YA trae el impuesto (es el precio de tienda).
 *    Se le quita aquí para que base + impuesto = precio de tienda. Regla de Diemar
 *    17-sep: el abarrote se vende igual en tienda y en B2B. Antes se cobraba el
 *    impuesto encima del precio de tienda (VELAS $40.02 → $46.42). El backend
 *    (sales_invoice.validar_precio_de_tienda) rechaza la venta si este rate no cuadra.
 *  • Materia prima: al COSTO sin impuesto (precio_por_kg). Modelo 2026-05-20.
 *  • Pan: el pan se cobra desde la Hoja del día, Diemar 22-sep — NO tiene precio
 *    B2B; `visibleEnB2B` lo saca del buscador antes de que se pueda seleccionar.
 */
// Excepción (Diemar 24-sep): a DELI la NATA se le vende a precio de COMPRA. Regla,
// no número: el precio sale de custom_precio_de_compra. Clave «cliente|item_code».
// Misma tabla que el backend (sales_invoice.A_PRECIO_DE_COMPRA), que es quien manda.
const A_PRECIO_DE_COMPRA = new Set(['DELI|7500000000063']);  // NATA DELICIAS DE LA CUENTA

export function precioB2B(item: Item, esAbarrote: boolean, cliente = ''): number {
  const tienda = A_PRECIO_DE_COMPRA.has(`${cliente}|${item.item_code}`)
    ? item.custom_precio_de_compra
    : item.custom_precio_de_venta;
  if (esAbarrote && tienda) {
    return parseFloat(tienda) / (1 + getTasa(item.custom_impuesto));
  }
  const precio = item.custom_precio_por_kg || item.custom_precio_de_venta || item.standard_rate;
  return parseFloat(precio) || 0;
}

/**
 * Qué items aparecen en el buscador de Venta B2B.
 *  • Pan (`PRODUCTO TERMINADO`): nunca — se cobra desde la Hoja del día (22-sep).
 *  • Materia prima con PUERTA REAL (`bloqueaMP`): oculta salvo reventa o
 *    marcada "Vendible a sucursales" item por item desde el Catálogo.
 */
export function visibleEnB2B(it: Item, bloqueaMP: boolean): boolean {
  if (esPan(it)) return false;
  if (bloqueaMP && it.custom_tipo_item === 'MATERIA PRIMA'
      && !inventory.esProductoParaVenta(it.item_group)
      && !it.custom_vendible_b2b) return false;
  return true;
}

/** Precio unitario que paga el cliente, impuesto incluido (el de la lista del piso). */
export const precioConImpuesto = (f: Item): number =>
  parseFloat(f.rate || 0) * (1 + parseFloat(f.impuesto_rate || 0));
