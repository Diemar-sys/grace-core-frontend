import { describe, it, expect, vi } from 'vitest';
import { seedCatalogo, seedStock } from './sync';

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
