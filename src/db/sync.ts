import { posService as defaultPos } from '../services/frappePOS';
import { stockService as defaultStock } from '../services/frappeStock';
import { db as defaultDb } from './db';
import { logError } from '../utils/errorFrappe';
export { seedCatalogo, seedStock, drainOutbox };

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

// Single-flight: dos drains concurrentes pelearían por las mismas filas.
let _draining = false;

/**
 * Drena el outbox: empuja cada venta 'pendiente' a ERPNext (en orden) y la
 * saca del outbox al confirmarse. Orden sagrado del sync: push ANTES de pull —
 * tras drenar con éxito se relee el stock autoritativo (seedStock); leerlo
 * antes resucitaría stock ya vendido.
 *
 * Por venta:
 *  - respuesta OK (incluida duplicada=true) → delete del outbox.
 *  - null (sin red) → abortar el loop; las demás siguen 'pendiente' y las
 *    reintenta el próximo trigger (online / mount / post-venta).
 *  - throw (server la rechazó: datos malos, permisos) → estado 'error' y
 *    CONTINUAR; una venta podrida no debe bloquear la cola para siempre.
 *
 * @param {{posService?, stockService?, db?}} [deps]
 * @returns {Promise<number>} ventas enviadas en esta pasada.
 */
async function drainOutbox({ posService = defaultPos, stockService = defaultStock, db = defaultDb } = defaultDeps) {
    if (_draining) return 0;
    _draining = true;
    try {
        const pendientes = await db.outbox.where('estado').equals('pendiente').sortBy('created_at');
        let enviadas = 0;
        for (const venta of pendientes) {
            let res;
            try {
                res = await posService.crearVentaOffline(venta);
            } catch (error) {
                logError(`drainOutbox ${venta.uuid}`, error);
                await db.outbox.update(venta.uuid, { estado: 'error', error: String(error?.message || error) });
                continue;
            }
            if (res === null) break; // sin red — reintento en el próximo trigger
            await db.outbox.delete(venta.uuid);
            enviadas++;
        }
        if (enviadas > 0) await seedStock({ posService, stockService, db });
        return enviadas;
    } catch (error) {
        logError('drainOutbox', error);
        return 0;
    } finally {
        _draining = false;
    }
}
