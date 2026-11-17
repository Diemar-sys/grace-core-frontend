import { describe, it, expect } from 'vitest';
import { calcLuz } from './luzCalc';

/** Recibo real de CFE, 2026-09-01. Los numeros del papel, sin tocar. */
const RECIBO = { energia: '1231.21', dap: '98.50' };

describe('calcLuz — el recibo de CFE', () => {
  it('reproduce el recibo real renglon por renglon', () => {
    const r = calcLuz(RECIBO);
    expect(r.iva).toBe(196.99);          // el papel dice 196.99
    expect(r.facPeriodo).toBe(1428.20);
    expect(r.totalFactura).toBe(1526.70);
    expect(r.totalPagar).toBe(1526);     // el codigo de barras dice 1,526
    expect(r.redondeo).toBe(-0.70);
  });

  it('el DAP NO entra a la base del IVA', () => {
    // Si entrara, el IVA seria 212.75 y el recibo dice 196.99. Es la forma mas
    // facil de equivocarse: sumar todo y aplicarle 16%.
    const r = calcLuz(RECIBO);
    expect(r.iva).not.toBeCloseTo((1231.21 + 98.50) * 0.16, 2);
    expect(r.iva).toBeCloseTo(1231.21 * 0.16, 2);
  });

  it('TRUNCA, no redondea: .70 baja, no sube', () => {
    // Redondear daria 1527 y serian un peso de mas CADA recibo.
    expect(calcLuz(RECIBO).totalPagar).toBe(1526);
    expect(Math.round(1526.70)).toBe(1527);   // lo que NO debe pasar
  });

  it('no pierde un peso entero por el ruido del flotante', () => {
    // Casos REALES hallados por barrido: la suma en punto flotante cae en
    // x.99999999 y un Math.floor sobre el flotante crudo paga UN PESO DE MENOS.
    // El DAP de 3.80 sale de la columna izquierda del recibo, no es inventado.
    //
    //   39.83 + 6.37 + 3.80 = 49.99999999999999  ->  floor ingenuo: 49, correcto: 50
    const casos = [
      { energia: '39.83', dap: '3.80', esperado: 50 },
      { energia: '40.69', dap: '3.80', esperado: 51 },
      { energia: '41.55', dap: '3.80', esperado: 52 },
      { energia: '67.41', dap: '3.80', esperado: 82 },
      { energia: '81.21', dap: '3.80', esperado: 98 },
    ];
    for (const c of casos) {
      const r = calcLuz({ energia: c.energia, dap: c.dap });
      expect(r.totalPagar).toBe(c.esperado);
      expect(r.totalFactura).toBe(c.esperado);   // el total ya era peso exacto
      expect(r.redondeo).toBe(0);                // nada que redondear
    }
  });

  it('la diferencia entre total y pago siempre vive en [0, 1)', () => {
    for (let cent = 0; cent < 3000; cent++) {
      const r = calcLuz({ energia: ((cent * 7.31) / 100).toFixed(2), dap: '98.50' });
      const dif = r.totalFactura - r.totalPagar;
      expect(dif).toBeGreaterThanOrEqual(-1e-9);
      expect(dif).toBeLessThan(1);
    }
  });

  it('el desglose SIEMPRE suma el total que se paga', () => {
    // Invariante que mantiene honesto al reporte: energia + dap + redondeo + iva
    // tiene que dar exactamente el monto guardado. Si esto se rompe, el egreso
    // dice una cosa y sus partidas otra.
    for (const dap of ['0', '98.50', '3.80', '1234.56']) {
      for (const energia of ['0', '1231.21', '99.99', '10000']) {
        const r = calcLuz({ energia, dap });
        const suma = r.energia + r.dap + r.redondeo + r.iva;
        expect(Math.round(suma * 100)).toBe(Math.round(r.totalPagar * 100));
      }
    }
  });

  it('el IVA manual manda sobre el calculado', () => {
    const r = calcLuz({ ...RECIBO, iva: '200.00' });
    expect(r.iva).toBe(200);
    expect(r.totalFactura).toBe(1231.21 + 200 + 98.50);
  });

  it('el total a pagar manual manda, y el redondeo lo refleja', () => {
    const r = calcLuz({ ...RECIBO, totalPagar: '1500' });
    expect(r.totalPagar).toBe(1500);
    expect(r.redondeo).toBe(-26.70);
  });

  it('vacio no truena y no inventa', () => {
    const r = calcLuz({});
    expect(r.totalFactura).toBe(0);
    expect(r.totalPagar).toBe(0);
    expect(r.redondeo).toBe(0);
  });
});
