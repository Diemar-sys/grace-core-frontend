import { posService as defaultPos } from '../services/frappePOS';
import { stockService as defaultStock } from '../services/frappeStock';
import { db as defaultDb } from './db';
import { logError } from '../utils/errorFrappe';
export { seedCatalogo, seedStock };

// Dependencias inyectables (default: singletons reales). Permiten testear el
// sembrado offline con mocks, sin red ni IndexedDB real.
const defaultDeps = { posService: defaultPos, stockService: defaultStock, db: defaultDb };

/**
 * Siembra el catálogo de productos en Dexie para uso offline del POS.
 * @param {{posService?, db?}} [deps]
 * @returns {Promise<boolean>} true si sembró, false si falló (degradado, no fatal).
 */
async function seedCatalogo({ posService = defaultPos, db = defaultDb } = defaultDeps) {
    try {
        const items = await posService.buscarProductos();
        await db.catalogo.bulkPut(items);
        return true;
    } catch (error) {
        logError('seedCatalogo', error);
        return false;
    }
}

/**
 * Siembra el stock del almacén del usuario en Dexie para uso offline del POS.
 * @param {{posService?, stockService?, db?}} [deps]
 * @returns {Promise<boolean>} true si sembró, false si no hay almacén o falló.
 */
async function seedStock({ posService = defaultPos, stockService = defaultStock, db = defaultDb } = defaultDeps) {
    try {
        const warehouse = await posService.getWarehouse();
        if (!warehouse) return false;
        const filas = await stockService.getStockPorAlmacen(warehouse);
        const stockFlaco = filas.map(r => ({
            item_code: r.item_code,
            qty: r.actual_qty,
        }));
        await db.stock.bulkPut(stockFlaco);
        return true;
    } catch (error) {
        logError('seedStock', error);
        return false;
    }
}
