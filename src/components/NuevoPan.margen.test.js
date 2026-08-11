import { describe, it, expect } from 'vitest';
import { margen, comparaConSucursal } from './NuevoPan';

describe('margen del pan', () => {
  it('calcula ganancia y porcentaje contra el costo', () => {
    const m = margen(20, 8);
    expect(m.ganancia).toBeCloseTo(12, 6);
    expect(m.porcentaje).toBeCloseTo(150, 6);
  });

  it('no compara si falta el costo estimado', () => {
    expect(margen(20, '')).toBeNull();
    expect(margen(20, 0)).toBeNull();
  });

  it('no compara si el canal está vacío (hereda el precio de sucursal)', () => {
    expect(margen('', 8)).toBeNull();
    expect(margen(0, 8)).toBeNull();
  });

  // Vender por debajo del costo tiene que salir en pantalla: es el error caro.
  it('marca la pérdida cuando el precio queda bajo el costo', () => {
    const m = margen(6, 8);
    expect(m.ganancia).toBeCloseTo(-2, 6);
    expect(m.porcentaje).toBeLessThan(0);
  });

  it('acepta los strings que entrega el input', () => {
    expect(margen('18.50', '7.25').ganancia).toBeCloseTo(11.25, 6);
  });
});

describe('comparación contra el precio de Sucursal', () => {
  it('reporta cuánto más barato queda el canal', () => {
    const c = comparaConSucursal(18, 20);
    expect(c.dif).toBeCloseTo(-2, 6);
    expect(c.igual).toBe(false);
  });

  it('reporta cuando el canal sale más caro', () => {
    expect(comparaConSucursal(22, 20).dif).toBeCloseTo(2, 6);
  });

  // El error silencioso: capturar en Pueblos el mismo precio que en Sucursal
  // deja el canal sin efecto y nada lo delata.
  it('marca como igual el mismo precio', () => {
    expect(comparaConSucursal(5, 5).igual).toBe(true);
    expect(comparaConSucursal('20.00', 20).igual).toBe(true);
  });

  it('no distingue diferencias por debajo del medio centavo', () => {
    expect(comparaConSucursal(20.002, 20).igual).toBe(true);
    expect(comparaConSucursal(20.01, 20).igual).toBe(false);
  });

  it('calla si falta cualquiera de los dos precios', () => {
    expect(comparaConSucursal('', 20)).toBeNull();
    expect(comparaConSucursal(18, '')).toBeNull();
    expect(comparaConSucursal(0, 0)).toBeNull();
  });
});
