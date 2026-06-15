// src/utils/stockMP.js
// Helpers compartidos para cargar stock por almacén con presentación.
// Bin.actual_qty ya viene en UNIDAD BASE (stock_uom, ej. Kg) gracias a la conversión
// UOM nativa en la compra; la presentación (ej. BULTO) se deriva dividiendo entre
// custom_cantidad_por_presentación. Usado por RegistroSalida, RegistroMerma.

import { inventory as defaultInventory } from '../services/frappeInventory';

/**
 * Transforma filas de stock crudas a un mapa por item_code. `actual_qty` ya está en
 * unidad base (stock_uom); `stockKg` es esa cantidad base y `presentaciones` su
 * equivalente en presentación (base / cantPres).
 * Función PURA — sin red ni efectos. Testeable de forma aislada.
 * @param {Array<Object>} items - Filas de stock de ERPNext.
 * @returns {Object<string, {actual:number, cantPres:number, presentacion:string, uom:string, stockKg:number, presentaciones:number}>}
 */
export function buildStockMapKg(items = []) {
  const map = {};
  items.forEach(it => {
    const actual = parseFloat(it.actual_qty) || 0;
    const cantPres = parseFloat(it.custom_cantidad_por_presentación) || 1;
    map[it.item_code] = {
      actual,
      cantPres,
      presentacion: it.custom_presentación || '',
      uom: it.stock_uom || '',
      stockKg: actual,
      presentaciones: actual / cantPres,
    };
  });
  return map;
}

/**
 * Carga el stock de un almacén y lo expone por item_code con info de presentación.
 * @param {string} warehouse
 * @param {{inventory?: object}} [deps] - Inyección de dependencias (default: singleton real).
 * @returns {Promise<Object<string, object>>}
 */
export async function fetchStockMapKg(warehouse, { inventory = defaultInventory } = {}) {
  const items = await inventory.getProductosConStock({ warehouse });
  return buildStockMapKg(items);
}

