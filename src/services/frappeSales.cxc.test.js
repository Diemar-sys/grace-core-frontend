import { describe, it, expect } from 'vitest';
import { agruparCuentasPorCobrar, saldoCobrable } from './frappeSales';

const sis = [
  { customer: 'DELI', customer_name: 'Deli', grand_total: 300, outstanding_amount: 200 },
  { customer: 'DELI', customer_name: 'Deli', grand_total: 100, outstanding_amount: 0   },
  { customer: 'ZAKIA', customer_name: 'Zakia', grand_total: 80, outstanding_amount: 80 },
];

describe('agruparCuentasPorCobrar', () => {
  it('agrupa por cliente; pagado = total - pendiente', () => {
    const f = agruparCuentasPorCobrar(sis);
    const deli = f.find(r => r.customer === 'DELI');
    expect(deli).toEqual({ customer: 'DELI', customer_name: 'Deli', n: 2, total: 400, pagado: 200, pendiente: 200 });
  });
  it('ordena por deuda pendiente desc', () => {
    // DELI debe 200, ZAKIA debe 80 → DELI primero
    expect(agruparCuentasPorCobrar(sis)[0].customer).toBe('DELI');
  });
  it('vacío → []', () => {
    expect(agruparCuentasPorCobrar([])).toEqual([]);
  });

  // Caso real DULCE CARAMELO: 3 facturas que individualmente redondean a $0.00.
  // Sumadas daban 0.006111 -> el reporte pintaba "$0.01 se debe" pero el modal de
  // cobro las descartaba y respondía "ya estaban saldadas".
  it('el polvo sub-centavo no se acumula como deuda', () => {
    const polvo = [
      { customer: 'DULCE', customer_name: 'Dulce', grand_total: 22378.46304,  outstanding_amount: 0.00304  },
      { customer: 'DULCE', customer_name: 'Dulce', grand_total: 6088.3128,    outstanding_amount: 0.0028   },
      { customer: 'DULCE', customer_name: 'Dulce', grand_total: 22468.540271, outstanding_amount: 0.000271 },
    ];
    const [fila] = agruparCuentasPorCobrar(polvo);
    expect(fila.pendiente).toBe(0);
    expect(fila.pagado).toBeCloseTo(fila.total, 6); // todo cuenta como cobrado
  });

  it('un saldo de 1 centavo SÍ es deuda', () => {
    const [fila] = agruparCuentasPorCobrar([
      { customer: 'DELI', customer_name: 'Deli', grand_total: 100, outstanding_amount: 0.01 },
    ]);
    expect(fila.pendiente).toBe(0.01);
  });
});

describe('saldoCobrable', () => {
  it('lo que redondea a cero es cero', () => {
    expect(saldoCobrable(0.004)).toBe(0);
    expect(saldoCobrable(0.000271)).toBe(0);
    expect(saldoCobrable(0)).toBe(0);
  });
  it('desde medio centavo ya es cobrable, y conserva el valor EXACTO', () => {
    // exacto = Frappe rechaza allocated > outstanding si se redondea hacia arriba
    expect(saldoCobrable(0.005)).toBe(0.005);
    expect(saldoCobrable(786.055904)).toBe(786.055904);
  });
  it('tolera basura', () => {
    expect(saldoCobrable(null)).toBe(0);
    expect(saldoCobrable(undefined)).toBe(0);
    expect(saldoCobrable('12.5')).toBe(12.5);
  });
});
