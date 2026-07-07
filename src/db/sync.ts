import { posService as defaultPos } from '../services/frappePOS';
import { stockService as defaultStock } from '../services/frappeStock';
import { db as defaultDb, type CatalogoItem, type OutboxVenta } from './db';
import { logError } from '../utils/errorFrappe';

// Contratos mínimos de los servicios que este módulo consume. Los servicios
// reales aún son .js (tipados como any al importarse); estas interfaces tipan
// lo que sync toca. Se afinan cuando frappePOS/frappeStock migren a TS.
interface PosService {
  buscarProductos(): Promise<CatalogoItem[]>;
  getWarehouse(): Promise<string | null>;
  crearVentaOffline(venta: OutboxVenta): Promise<unknown | null>;
}

interface StockService {
  // frappeStock aún es .js (JSDoc devuelve Object[]); tipamos laxo aquí y
  // afinamos con cast al consumir. Se estrecha cuando frappeStock migre a TS.
  getStockPorAlmacen(warehouse: string): Promise<unknown[]>;
}

interface StockSourceRow {
  item_code: string;
  actual_qty: number;
}

interface Deps {
  posService?: PosService;
  stockService?: StockService;
  db?: typeof defaultDb;
}

// Dependencias inyectables (default: singletons reales). Permiten testear el
// sembrado offline con mocks, sin red ni IndexedDB real.
const defaultDeps: Deps = { posService: defaultPos, stockService: defaultStock, db: defaultDb };

function msg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Siembra el catálogo de productos en Dexie para uso offline del POS.
 *  @returns true si sembró, false si falló (degradado, no fatal). */
async function seedCatalogo({ posService = defaultPos, db = defaultDb }: Deps = defaultDeps): Promise<boolean> {
    try {
        const items = await posService.buscarProductos();
        await db.catalogo.bulkPut(items);
        return true;
    } catch (error) {
        logError('seedCatalogo', error);
        return false;
    }
}

/** Siembra el stock del almacén del usuario en Dexie para uso offline del POS.
 *  @returns true si sembró, false si no hay almacén o falló. */
async function seedStock({ posService = defaultPos, stockService = defaultStock, db = defaultDb }: Deps = defaultDeps): Promise<boolean> {
    try {
        const warehouse = await posService.getWarehouse();
        if (!warehouse) return false;
        const filas = await stockService.getStockPorAlmacen(warehouse) as StockSourceRow[];
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
 * @returns ventas enviadas en esta pasada.
 */
async function drainOutbox({ posService = defaultPos, stockService = defaultStock, db = defaultDb }: Deps = defaultDeps): Promise<number> {
    if (_draining) return 0;
    _draining = true;
    try {
        const pendientes = await db.outbox.where('estado').equals('pendiente').sortBy('created_at');
        let enviadas = 0;
        for (const venta of pendientes) {
            let res: unknown;
            try {
                res = await posService.crearVentaOffline(venta);
            } catch (error) {
                logError(`drainOutbox ${venta.uuid}`, error);
                await db.outbox.update(venta.uuid, { estado: 'error', error: msg(error) });
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

export { seedCatalogo, seedStock, drainOutbox };
