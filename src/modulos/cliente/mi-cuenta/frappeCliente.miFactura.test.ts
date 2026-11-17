import { describe, it, expect, vi } from 'vitest';
import { clienteService } from './frappeCliente';

// 29-oct: Mi cuenta → Facturas enseña lo que se cobró con el MISMO cálculo que el cobro de B2B
// (renglonDeFactura): de la Hoja con `custom_impuesto`, abarrote con el impuesto del renglón.
describe('miFactura', () => {
  const pedir = async (message: any) => {
    const svc = clienteService as any;
    const original = svc._fetch;
    svc._fetch = vi.fn(async () => ({ message }));
    try { return await clienteService.miFactura('ACC-SINV-1'); } finally { svc._fetch = original; }
  };

  it('factura de la Hoja: precio con el impuesto del catálogo (ieps), no el de la plantilla', async () => {
    const r = await pedir({ de_hoja: true, renglones: [
      { item_code: '1001', item_name: 'MANTECADA GDE', qty: 24, rate: 12.962963, amount: 311.111112,
        item_tax_rate: '{"IVA - PG": 16.0}', stock_uom: 'PZA', custom_impuesto: 'ieps' }] });
    expect(r[0].precio).toBeCloseTo(14, 4);
    expect(r[0].importe).toBeCloseTo(336, 3);
    expect(r[0].uom).toBe('PZA');
  });

  it('abarrote: el impuesto del renglón', async () => {
    const r = await pedir({ de_hoja: false, renglones: [
      { item_code: 'A1', item_name: 'NESCAFÉ ORIGINAL', qty: 16, rate: 12.068966, amount: 193.103456,
        item_tax_rate: '{"IVA - PG": 16.0}', stock_uom: 'PZA', custom_impuesto: 'tasa0' }] });
    expect(r[0].precio).toBeCloseTo(14, 4);
    expect(r[0].importe).toBeCloseTo(224, 3);
  });
});
