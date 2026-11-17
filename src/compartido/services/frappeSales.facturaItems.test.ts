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

// 07-oct: foto de la tablet (CxC, cobro de la Hoja): todo a $14, pero el modal pintaba
// MANTECADA $15.04 (plantilla de IVA), BESOS $12.96 (sin plantilla) y MARMOLEADO $14
// (plantilla IEPS). La Hoja cobra con `custom_impuesto`, no con la plantilla.
describe('getFacturaItems — factura de la Hoja', () => {
  const CATALOGO: Record<string, any> = {
    '1001': { item_code: '1001', stock_uom: 'PZA', custom_impuesto: 'ieps' },  // MANTECADA GDE
    '1012': { item_code: '1012', stock_uom: 'PZA', custom_impuesto: 'ieps' },  // BESOS
    '1006': { item_code: '1006', stock_uom: 'PZA', custom_impuesto: 'ieps' },  // MARMOLEADO
    '1068': { item_code: '1068', stock_uom: 'PZA', custom_impuesto: 'tasa0' }, // BISQUET (exento)
  };
  const RATE_IEPS = 12.962963; // 14 / 1.08, como lo guarda hoja_calculo
  const renglones = [
    { item_code: '1001', qty: 6, rate: RATE_IEPS, amount: 77.777778, item_tax_rate: '{"IVA - PG": 16.0}' },
    { item_code: '1012', qty: 6, rate: RATE_IEPS, amount: 77.777778, item_tax_rate: '{}' },
    { item_code: '1006', qty: 6, rate: RATE_IEPS, amount: 77.777778, item_tax_rate: '{"IEPS - PG - PG": 8.0}' },
    { item_code: '1068', qty: 6, rate: 14, amount: 84, item_tax_rate: '{}' },
  ];

  async function abrir(doc: any) {
    const svc = ventasService as any;
    const original = svc._fetch;
    svc._fetch = vi.fn(async (url: string) => {
      if (url.includes('/Sales Invoice/')) return { data: doc };
      // el catálogo devuelve SOLO los campos pedidos: olvidar uno en la consulta truena
      const campos: string[] = JSON.parse(new URLSearchParams(url.split('?')[1]).get('fields') || '[]');
      return { data: Object.values(CATALOGO).map((it) =>
        Object.fromEntries(campos.filter((c) => c in it).map((c) => [c, it[c]]))) };
    });
    try {
      const items = await ventasService.getFacturaItems('ACC-SINV-2026-00999');
      return Object.fromEntries(items.map((i: any) => [i.item_code, i]));
    } finally { svc._fetch = original; }
  }

  it('🔴 el pan de $14 se ve a $14 con plantilla de IVA, sin plantilla, con IEPS y exento', async () => {
    const por = await abrir({ custom_pedido_diario: 'PED-2026-10-06', items: renglones });
    for (const code of ['1001', '1012', '1006', '1068']) {
      expect(por[code].precio, code).toBeCloseTo(14, 4);
      expect(por[code].importe, code).toBeCloseTo(84, 3);
    }
  });

  it('la Venta B2B (sin pedido de la hoja) sigue con la plantilla del renglón', async () => {
    const por = await abrir({ items: renglones });
    expect(por['1001'].precio).toBeCloseTo(15.04, 2);
    expect(por['1012'].precio).toBeCloseTo(12.96, 2);
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
