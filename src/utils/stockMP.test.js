import { describe, it, expect, vi } from 'vitest';
import { buildStockMapKg, fetchStockMapKg } from './stockMP';

const FILAS = [
  { item_code: 'HARINA', actual_qty: '5', custom_cantidad_por_presentación: '25',
    custom_presentación: 'BULTO', stock_uom: 'Kg' },
  { item_code: 'SAL', actual_qty: '2', custom_cantidad_por_presentación: '',
    custom_presentación: '', stock_uom: 'Kg' },
];

describe('stockMP — buildStockMapKg (conversión presentación→Kg)', () => {
  it('convierte bultos a Kg (actual * cantPres)', () => {
    const map = buildStockMapKg(FILAS);
    expect(map.HARINA.stockKg).toBe(125);   // 5 bultos * 25 Kg
    expect(map.HARINA.actual).toBe(5);
    expect(map.HARINA.cantPres).toBe(25);
  });

  it('cantPres ausente → default 1 (no multiplica por 0)', () => {
    const map = buildStockMapKg(FILAS);
    expect(map.SAL.cantPres).toBe(1);
    expect(map.SAL.stockKg).toBe(2);
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
  });
});
