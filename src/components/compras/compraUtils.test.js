import { describe, it, expect } from 'vitest';
import {
  subtotalFila, impuestoFila, totalFila, calcVariacion, parseImpuesto, totalPorFila,
  calcularTotalesEfectivos,
} from './compraUtils';

describe('compraUtils — subtotales e impuestos', () => {
  it('subtotalFila = bultos * rate', () => {
    expect(subtotalFila({ bultos: '3', rate: '10.50' })).toBe(31.5);
  });

  it('subtotalFila trata vacíos como 0 (sin NaN)', () => {
    expect(subtotalFila({ bultos: '', rate: '' })).toBe(0);
    expect(subtotalFila({})).toBe(0);
  });

  it('impuestoFila aplica la tasa al subtotal', () => {
    // 100 de subtotal * 16% IVA
    expect(impuestoFila({ bultos: '10', rate: '10', impuesto_rate: 0.16 })).toBeCloseTo(16, 6);
  });

  it('impuestoFila tasa 0 = sin impuesto', () => {
    expect(impuestoFila({ bultos: '5', rate: '20', impuesto_rate: 0 })).toBe(0);
  });

  it('totalFila = subtotal + impuesto', () => {
    expect(totalFila({ bultos: '10', rate: '10', impuesto_rate: 0.16 })).toBeCloseTo(116, 6);
  });

  it('totalPorFila = bultos * kg_por_bulto', () => {
    expect(totalPorFila({ bultos: '4', kg_por_bulto: '2.5' })).toBe(10);
  });

  it('no redondea intermedio (espejo de ERPNext precision 6)', () => {
    // 3 * 33.333333 = 99.999999, NO 100
    expect(subtotalFila({ bultos: '3', rate: '33.333333' })).toBeCloseTo(99.999999, 6);
  });
});

describe('compraUtils — parseImpuesto', () => {
  it('detecta IVA por descripción', () => {
    expect(parseImpuesto('IVA 16%').key).toBe('iva16');
  });
  it('detecta IEPS', () => {
    expect(parseImpuesto('IEPS 8%').key).toBe('ieps');
  });
  it('default tasa 0 si no reconoce', () => {
    expect(parseImpuesto('cualquier cosa').key).toBe('tasa0');
    expect(parseImpuesto().key).toBe('tasa0');
  });
});

describe('compraUtils — calcularTotalesEfectivos (grand_total a ERPNext)', () => {
  // Caso base: solo IVA, sin overrides. 1000 base + 160 IVA = 1160 exacto.
  const calcBase = { subtotal: 1000, iva: 160, ieps: 0,
                     subtotalIva16: 1000, subtotalIeps: 0, subtotalTasa0: 0 };

  it('sin overrides usa los valores calculados', () => {
    const r = calcularTotalesEfectivos({ calc: calcBase });
    expect(r.iva).toBe(160);
    expect(r.subtotalEfectivo).toBe(1000);
    expect(r.total).toBeCloseTo(1160, 6);
  });

  it('ajuste SAT lleva el total a 2 decimales exactos', () => {
    // subtotal 99.999999 → rawTotal con cola; ajusteSAT corrige a centavos
    const calc = { subtotal: 99.999999, iva: 0, ieps: 0,
                   subtotalIva16: 0, subtotalIeps: 0, subtotalTasa0: 99.999999 };
    const r = calcularTotalesEfectivos({ calc });
    expect(Number((r.total).toFixed(2))).toBe(100);
    expect(r.ajusteSAT).toBeCloseTo(0.000001, 9);
  });

  it('override de IVA manual reemplaza el calculado (solo si calc.iva > 0)', () => {
    const r = calcularTotalesEfectivos({
      calc: calcBase,
      overrides: { iva: '155' },
      manual: { iva: true },
    });
    expect(r.iva).toBe(155);
    expect(r.total).toBeCloseTo(1155, 6);
  });

  it('override de IVA se ignora si no hay IVA calculado (calc.iva = 0)', () => {
    const calc = { ...calcBase, iva: 0 };
    const r = calcularTotalesEfectivos({ calc, overrides: { iva: '999' }, manual: { iva: true } });
    expect(r.iva).toBe(0);
  });

  it('override de subtotal genera subtotalDiff (ajuste para ERP)', () => {
    const r = calcularTotalesEfectivos({
      calc: calcBase,
      overrides: { subtotalIva16: '1010' },
      manual: { subtotalIva16: true },
    });
    expect(r.subtotalEfectivo).toBe(1010);
    expect(r.subtotalDiff).toBeCloseTo(10, 6);
    expect(r.ajusteParaErp).toBeCloseTo(r.ajusteEfectivo + 10, 6);
  });

  it('ajuste manual reemplaza el ajuste SAT', () => {
    const r = calcularTotalesEfectivos({ calc: calcBase, manual: { ajuste: true }, ajuste: '2.5' });
    expect(r.ajusteEfectivo).toBe(2.5);
    expect(r.total).toBeCloseTo(1162.5, 6);
  });

  it('defensivo: sin overrides/manual no lanza', () => {
    expect(() => calcularTotalesEfectivos({ calc: calcBase })).not.toThrow();
  });
});

describe('compraUtils — calcVariacion (precio vs catálogo)', () => {
  it('null si falta catálogo o actual', () => {
    expect(calcVariacion({ rate: '10', precio_catalogo: '' })).toBeNull();
    expect(calcVariacion({ rate: '', precio_catalogo: '10' })).toBeNull();
  });

  it('calcula diff y pct con signo', () => {
    const v = calcVariacion({ rate: '12', precio_catalogo: '10' });
    expect(v.diff).toBeCloseTo(2, 6);
    expect(v.pct).toBeCloseTo(20, 6);
    expect(v.cambio).toBe(true);
  });

  it('cambio=false si diferencia despreciable (<0.005)', () => {
    const v = calcVariacion({ rate: '10.002', precio_catalogo: '10' });
    expect(v.cambio).toBe(false);
  });
});
