import { describe, it, expect } from 'vitest';
import { calcularTotalesVenta } from './frappeSales';

// El grand_total que arma ERPNext = subtotal (sin redondear) + filas de impuesto
// (redondeadas a 2) + fila de Ajuste por Redondeo. Reproducirlo aquí es la única
// forma de comprobar que el ajuste realmente cuadra el total.
const grandTotalErpnext = (filas) => {
  const t = calcularTotalesVenta(filas);
  return t.subtotal + t.impuestos + t.ajusteSAT;
};

const decimales = (n) => {
  const s = String(Math.round(n * 1e6) / 1e6);
  return s.includes('.') ? s.split('.')[1].length : 0;
};

const iva16 = (qty, rate) => ({ qty, rate, impuesto_key: 'iva16', impuesto_rate: 0.16, impuesto_label: 'IVA 16%' });
const tasa0 = (qty, rate) => ({ qty, rate, impuesto_key: 'tasa0', impuesto_rate: 0, impuesto_label: 'Tasa 0' });

describe('calcularTotalesVenta — ajuste SAT', () => {
  // Caso real: ACC-SINV-2026-00056. Antes del fix ERPNext guardaba 50.336 y la
  // factura quedaba con 0.004 pendiente aunque el cliente pagara completo.
  it('cuadra el total cuando el IVA crudo tiene mas de 2 decimales', () => {
    const filas = [iva16(1, 43.4)]; // 43.4 * 0.16 = 6.944 -> se envia 6.94
    expect(calcularTotalesVenta(filas).impuestos).toBe(6.94);
    expect(grandTotalErpnext(filas)).toBeCloseTo(50.34, 6);
  });

  it('el total nunca tiene mas de 2 decimales', () => {
    const casos = [
      [iva16(10.08, 53.2976)],
      [iva16(3, 19.99), tasa0(7, 12.345)],
      [iva16(1, 0.01)],
      [tasa0(2.5, 33.333333)],
      [iva16(18, 15.86), iva16(10, 77), tasa0(1, 158.628089)],
    ];
    for (const filas of casos) {
      expect(decimales(grandTotalErpnext(filas))).toBeLessThanOrEqual(2);
    }
  });

  it('total = subtotal + impuestos redondeados + ajuste', () => {
    const filas = [iva16(10.08, 53.2976), tasa0(3, 11.11)];
    const t = calcularTotalesVenta(filas);
    expect(t.total).toBeCloseTo(t.subtotal + t.impuestos + t.ajusteSAT, 9);
  });

  it('sin impuestos ni decimales el ajuste es 0', () => {
    expect(calcularTotalesVenta([tasa0(4, 100)]).ajusteSAT).toBe(0);
  });

  it('lista vacia no truena', () => {
    expect(calcularTotalesVenta([]).total).toBe(0);
  });
});
