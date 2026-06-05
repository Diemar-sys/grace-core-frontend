import { posService } from '../services/frappePOS';
import { stockService } from '../services/frappeStock';
import { db } from './db';
export { seedCatalogo, seedStock };

async function seedCatalogo() {
    try {
        const items = await posService.buscarProductos();
        await db.catalogo.bulkPut(items);
    } catch (error) {
        console.error('Error en el sembrado del catálogo:', error);
    }
}

async function seedStock() {
    try {
        const warehouse = await posService.getWarehouse();
        if (!warehouse) return;
        const filas = await stockService.getStockPorAlmacen(warehouse);
        const stockFlaco = filas.map(r => ({
            item_code: r.item_code,
            qty: r.actual_qty,
        }));
        await db.stock.bulkPut(stockFlaco);
    } catch (error) {
        console.error('Error en el sembrado del stock:', error);
    }
}
