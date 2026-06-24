import { describe, it, expect } from 'vitest';
import { calcTotalesPartidas } from './Egresos';

// Único check del agrupamiento por tasa (la suma/ajuste vive en calcularTotalesEfectivos, ya testeado).
describe('calcTotalesPartidas — agrupa bases por tasa', () => {
  it('mete cada partida en su bucket y calcula IVA/IEPS por tasa', () => {
    const { calc } = calcTotalesPartidas([
      { cantidad: 1, precio: 100, impuesto_key: 'iva16' }, // base 100, IVA 16
      { cantidad: 2, precio: 50,  impuesto_key: 'ieps'  }, // base 100, IEPS 8
      { cantidad: 1, precio: 200, impuesto_key: 'tasa0' }, // base 200, sin imp
    ]);
    expect(calc.subtotalIva16).toBe(100);
    expect(calc.subtotalIeps).toBe(100);
    expect(calc.subtotalTasa0).toBe(200);
    expect(calc.iva).toBeCloseTo(16, 6);
    expect(calc.ieps).toBeCloseTo(8, 6);
    expect(calc.subtotal).toBe(400);
  });

  it('total = subtotal + impuestos, cuadrado a 2 decimales (ajuste SAT auto)', () => {
    const { ef } = calcTotalesPartidas([{ cantidad: 1, precio: 100, impuesto_key: 'iva16' }]);
    expect(ef.total).toBeCloseTo(116, 2);
  });

  it('partida sin impuesto_key cae a tasa0', () => {
    const { calc } = calcTotalesPartidas([{ cantidad: 1, precio: 99 }]);
    expect(calc.subtotalTasa0).toBe(99);
    expect(calc.iva).toBe(0);
  });
});
