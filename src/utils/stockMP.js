// src/utils/stockMP.js
// Helpers compartidos para cargar stock por almacén con presentación.
// Convierte actual_qty (unidad natural, ej. BULTO) a stock_uom (Kg) usando
// custom_cantidad_por_presentación. Usado por RegistroSalida, RegistroMerma.

import { inventory } from '../services/frappeInventory';

/**
 * Carga el stock de un almacén y lo expone por item_code con info de presentación.
 * @param {string} warehouse
 * @returns {Promise<Object<string, {actual:number, cantPres:number, presentacion:string, uom:string, stockKg:number}>>}
 */
export async function fetchStockMapKg(warehouse) {
  const items = await inventory.getProductosConStock({ warehouse });
  const map = {};
  items.forEach(it => {
    const actual = parseFloat(it.actual_qty) || 0;
    const cantPres = parseFloat(it.custom_cantidad_por_presentación) || 1;
    map[it.item_code] = {
      actual,
      cantPres,
      presentacion: it.custom_presentación || '',
      uom: it.stock_uom || '',
      stockKg: actual * cantPres,
    };
  });
  return map;
}

