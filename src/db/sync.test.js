import { describe, it, expect, vi } from 'vitest';
import { seedCatalogo, seedStock, drainOutbox } from './sync';

const fakeDb = () => ({
  catalogo: { bulkPut: vi.fn().mockResolvedValue() },
  stock:    { bulkPut: vi.fn().mockResolvedValue() },
});

describe('sync — seedCatalogo (DI, sin red/IndexedDB)', () => {
  it('siembra el catálogo y devuelve true', async () => {
    const db = fakeDb();
    const posService = { buscarProductos: vi.fn().mockResolvedValue([{ item_code: 'PAN' }]) };
    const ok = await seedCatalogo({ posService, db });
    expect(ok).toBe(true);
    expect(db.catalogo.bulkPut).toHaveBeenCalledWith([{ item_code: 'PAN' }]);
  });

  it('falla controlado (false) si el servicio revienta — no propaga', async () => {
    const db = fakeDb();
    const posService = { buscarProductos: vi.fn().mockRejectedValue(new Error('red caída')) };
    const ok = await seedCatalogo({ posService, db });
    expect(ok).toBe(false);
    expect(db.catalogo.bulkPut).not.toHaveBeenCalled();
  });
});

describe('sync — seedStock (DI)', () => {
  it('convierte filas a {item_code, qty} y siembra', async () => {
    const db = fakeDb();
    const posService = { getWarehouse: vi.fn().mockResolvedValue('BODEGA') };
    const stockService = {
      getStockPorAlmacen: vi.fn().mockResolvedValue([{ item_code: 'PAN', actual_qty: 12 }]),
    };
    const ok = await seedStock({ posService, stockService, db });
    expect(ok).toBe(true);
    expect(db.stock.bulkPut).toHaveBeenCalledWith([{ item_code: 'PAN', qty: 12 }]);
  });

  it('sin almacén → false, no consulta stock', async () => {
    const db = fakeDb();
    const posService = { getWarehouse: vi.fn().mockResolvedValue(null) };
    const stockService = { getStockPorAlmacen: vi.fn() };
    const ok = await seedStock({ posService, stockService, db });
    expect(ok).toBe(false);
    expect(stockService.getStockPorAlmacen).not.toHaveBeenCalled();
  });
});

// ── drainOutbox ──────────────────────────────────────────────

const venta = (uuid, created_at) => ({ uuid, estado: 'pendiente', created_at, items: [], pagos: [], total: 10 });

const fakeDbOutbox = (pendientes) => ({
  outbox: {
    where:  vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({ sortBy: vi.fn().mockResolvedValue(pendientes) }),
    }),
    delete: vi.fn().mockResolvedValue(),
    update: vi.fn().mockResolvedValue(),
  },
  stock: { bulkPut: vi.fn().mockResolvedValue() },
});

// posService que además satisface el seedStock del pull post-drain
const fakePos = (crearImpl) => ({
  crearVentaOffline: crearImpl,
  getWarehouse: vi.fn().mockResolvedValue('TIENDA'),
});
const fakeStockSvc = () => ({ getStockPorAlmacen: vi.fn().mockResolvedValue([]) });

describe('sync — drainOutbox (DI)', () => {
  it('envía pendientes en orden, las borra del outbox y hace pull (seedStock) al final', async () => {
    const db = fakeDbOutbox([venta('a', '2026-07-01'), venta('b', '2026-07-02')]);
    const posService = fakePos(vi.fn().mockResolvedValue({ name: 'SI-001', duplicada: false }));
    const stockService = fakeStockSvc();
    const n = await drainOutbox({ posService, stockService, db });
    expect(n).toBe(2);
    expect(db.outbox.delete).toHaveBeenCalledWith('a');
    expect(db.outbox.delete).toHaveBeenCalledWith('b');
    // pull DESPUÉS de push: stock autoritativo releído
    expect(stockService.getStockPorAlmacen).toHaveBeenCalled();
  });

  it('duplicada=true (el server ya la tenía) cuenta como éxito → sale del outbox', async () => {
    const db = fakeDbOutbox([venta('a')]);
    const posService = fakePos(vi.fn().mockResolvedValue({ name: 'SI-001', duplicada: true }));
    const n = await drainOutbox({ posService, stockService: fakeStockSvc(), db });
    expect(n).toBe(1);
    expect(db.outbox.delete).toHaveBeenCalledWith('a');
  });

  it('sin red (null) → aborta el loop; nada se borra ni se marca', async () => {
    const db = fakeDbOutbox([venta('a'), venta('b')]);
    const posService = fakePos(vi.fn().mockResolvedValue(null));
    const stockService = fakeStockSvc();
    const n = await drainOutbox({ posService, stockService, db });
    expect(n).toBe(0);
    expect(db.outbox.delete).not.toHaveBeenCalled();
    expect(db.outbox.update).not.toHaveBeenCalled();
    // sin push exitoso NO hay pull (evita resucitar stock vendido)
    expect(stockService.getStockPorAlmacen).not.toHaveBeenCalled();
  });

  it('rechazo del server → marca error y CONTINÚA con la siguiente (no bloquea la cola)', async () => {
    const db = fakeDbOutbox([venta('mala'), venta('buena')]);
    const posService = fakePos(
      vi.fn()
        .mockRejectedValueOnce(new Error('item no existe'))
        .mockResolvedValueOnce({ name: 'SI-002', duplicada: false })
    );
    const n = await drainOutbox({ posService, stockService: fakeStockSvc(), db });
    expect(n).toBe(1);
    expect(db.outbox.update).toHaveBeenCalledWith('mala', expect.objectContaining({ estado: 'error' }));
    expect(db.outbox.delete).toHaveBeenCalledWith('buena');
  });
});
