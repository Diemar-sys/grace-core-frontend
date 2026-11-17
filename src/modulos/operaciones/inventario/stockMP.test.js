import { describe, it, expect, vi } from 'vitest';
import { buildStockMapKg, fetchStockMapKg } from './stockMP';

const FILAS = [
  // actual_qty ya viene en unidad base (Kg) por la conversión UOM nativa
  { item_code: 'HARINA', actual_qty: '125', custom_cantidad_por_presentación: '25',
    custom_presentación: 'BULTO', stock_uom: 'Kg' },
  { item_code: 'SAL', actual_qty: '2', custom_cantidad_por_presentación: '',
    custom_presentación: '', stock_uom: 'Kg' },
];

describe('stockMP — buildStockMapKg (actual_qty ya en base)', () => {
  it('stockKg = actual (base) y presentaciones = actual / cantPres', () => {
    const map = buildStockMapKg(FILAS);
    expect(map.HARINA.stockKg).toBe(125);        // 125 Kg base, sin multiplicar
    expect(map.HARINA.actual).toBe(125);
    expect(map.HARINA.cantPres).toBe(25);
    expect(map.HARINA.presentaciones).toBe(5);   // 125 / 25 = 5 bultos
  });

  it('cantPres ausente → default 1 (presentaciones = base)', () => {
    const map = buildStockMapKg(FILAS);
    expect(map.SAL.cantPres).toBe(1);
    expect(map.SAL.stockKg).toBe(2);
    expect(map.SAL.presentaciones).toBe(2);
  });

  it('lista vacía → mapa vacío, sin throw', () => {
    expect(buildStockMapKg([])).toEqual({});
    expect(() => buildStockMapKg()).not.toThrow();
  });

  it('indexa por item_code para lookup O(1)', () => {
    const map = buildStockMapKg(FILAS);
    expect(Object.keys(map)).toEqual(['HARINA', 'SAL']);
  });
});

describe('stockMP — fetchStockMapKg (DI con mock, sin red)', () => {
  it('usa el inventory inyectado y transforma el resultado', async () => {
    const inventoryMock = { getProductosConStock: vi.fn().mockResolvedValue(FILAS) };
    const map = await fetchStockMapKg('BODEGA CENTRAL', { inventory: inventoryMock });
    expect(inventoryMock.getProductosConStock).toHaveBeenCalledWith({ warehouse: 'BODEGA CENTRAL' });
    expect(map.HARINA.stockKg).toBe(125);
    expect(map.HARINA.presentaciones).toBe(5);
  });
});
