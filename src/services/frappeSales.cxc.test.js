import { describe, it, expect } from 'vitest';
import { agruparCuentasPorCobrar } from './frappeSales';

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
});
