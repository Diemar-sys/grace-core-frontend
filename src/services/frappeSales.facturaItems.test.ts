import { describe, it, expect, vi } from 'vitest';
import { factorImpuestoRenglon, ventasService } from './frappeSales';

// 23-sep: el modal de cobro pintaba `rate` (base SIN impuesto): la MANTECADA de
// $14 salía en $12.07 y el MARMOLEADO en $12.96. Renglones reales de la factura
// ACC-SINV-2026-00115 de dev (DELI, cobro desde la hoja).

describe('factorImpuestoRenglon', () => {
  it('IVA solo, IEPS solo y los dos en cascada (1.2528, no 1.24)', () => {
    expect(factorImpuestoRenglon('{"IVA - PG": 16.0}')).toBeCloseTo(1.16, 10);
    expect(factorImpuestoRenglon('{"IEPS - PG - PG": 8.0}')).toBeCloseTo(1.08, 10);
    expect(factorImpuestoRenglon({ 'IEPS - PG - PG': 8, 'IVA - PG': 16 })).toBeCloseTo(1.2528, 10);
  });
  it('sin impuesto o con basura no inventa impuesto', () => {
    expect(factorImpuestoRenglon('{}')).toBe(1);
    expect(factorImpuestoRenglon('')).toBe(1);
    expect(factorImpuestoRenglon(null)).toBe(1);
    expect(factorImpuestoRenglon('no es json')).toBe(1);
  });
});

describe('getFacturaItems', () => {
  it('precio e importe son lo que paga el cliente, con el impuesto del renglón', async () => {
    const svc = ventasService as any;
    const fetchOriginal = svc._fetch;
    svc._fetch = vi.fn(async (url: string) => (url.includes('/Sales Invoice/')
      ? { data: { items: [
        { item_code: '1001', item_name: 'MANTECADA GDE', qty: 24, rate: 12.068966, amount: 289.655184,
          item_tax_rate: '{"IVA - PG": 16.0}' },
        { item_code: '1006', item_name: 'MARMOLEADO', qty: 12, rate: 12.962963, amount: 155.555556,
          item_tax_rate: '{"IEPS - PG - PG": 8.0}' },
        { item_code: '1047', item_name: 'CONCHAS', qty: 42, rate: 14, amount: 588, item_tax_rate: '{}' },
      ] } }
      : { data: [] }));
    try {
      const items = await ventasService.getFacturaItems('ACC-SINV-2026-00115');
      const por = Object.fromEntries(items.map((i: any) => [i.item_code, i]));
      expect(por['1001'].precio).toBeCloseTo(14, 4);
      expect(por['1001'].importe).toBeCloseTo(336, 3);
      expect(por['1006'].precio).toBeCloseTo(14, 4);
      expect(por['1047'].precio).toBe(14);
      expect(por['1047'].importe).toBe(588);
      // la base sin impuesto sigue disponible para quien la necesite
      expect(por['1001'].rate).toBeCloseTo(12.068966, 6);
    } finally {
      svc._fetch = fetchOriginal;
    }
  });
});

// 23-sep: la preventa #87 no se podía confirmar en prod: fecha nueva (hoy) con
// vencimiento y calendario de pagos viejos
describe('confirmarBorrador', () => {
  it('🔴 vacía vencimiento y calendario de pagos para que ERPNext los recalcule', async () => {
    const svc = ventasService as any;
    const original = svc._fetch;
    let body: any = null;
    svc._fetch = vi.fn(async (_url: string, opts: any) => { body = JSON.parse(opts.body); return { data: {} }; });
    try { await ventasService.confirmarBorrador('ACC-SINV-2026-00117'); } finally { svc._fetch = original; }
    expect(body).toEqual({ docstatus: 1, due_date: null, payment_schedule: [] });
  });
});
