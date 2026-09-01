import { describe, it, expect } from 'vitest';
import { calcSimple } from './simpleCalc';

describe('calcSimple — gasto con un solo impuesto', () => {
  it('tasa 0 no inventa impuesto', () => {
    const r = calcSimple({ monto: '500', impuestoKey: 'tasa0' });
    expect(r.impuesto).toBe(0);
    expect(r.total).toBe(500);
  });

  it('IVA 16% sobre el monto', () => {
    const r = calcSimple({ monto: '1000', impuestoKey: 'iva16' });
    expect(r.impuesto).toBe(160);
    expect(r.total).toBe(1160);
  });

  it('no arrastra ruido de flotante al total', () => {
    // 1231.21 * 0.16 = 196.99360000000001 en flotante. Sin llevarlo a centavos,
    // el total guardado sale con centesimas de centavo pegadas.
    const r = calcSimple({ monto: '1231.21', impuestoKey: 'iva16' });
    expect(r.impuesto).toBe(196.99);
    expect(r.total).toBe(1428.20);
    expect(Number.isInteger(Math.round(r.total * 100))).toBe(true);
  });

  it('el impuesto manual manda y arrastra al total', () => {
    const r = calcSimple({ monto: '1000', impuestoKey: 'iva16', impuestoManual: '155.50' });
    expect(r.impuesto).toBe(155.50);
    expect(r.total).toBe(1155.50);
  });

  it('el total manual manda sobre todo', () => {
    const r = calcSimple({ monto: '1000', impuestoKey: 'iva16', totalManual: '1150' });
    expect(r.impuesto).toBe(160);   // el impuesto sigue siendo el suyo
    expect(r.total).toBe(1150);     // pero el total lo dice el papel
  });

  it('cero en manual es un CERO, no un vacio', () => {
    // '0' tiene que pisar el calculo. Si se tratara como vacio, poner el
    // impuesto en cero seria imposible y volveria solo al 16%.
    const r = calcSimple({ monto: '1000', impuestoKey: 'iva16', impuestoManual: '0' });
    expect(r.impuesto).toBe(0);
    expect(r.total).toBe(1000);
  });

  it('vacio no truena', () => {
    const r = calcSimple({});
    expect(r).toEqual({ base: 0, impuesto: 0, total: 0 });
  });
});
