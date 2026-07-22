import { describe, it, expect } from 'vitest';
import {
  subtotalFila, impuestoFila, totalFila, calcVariacion, parseImpuesto, totalPorFila,
  calcularTotalesEfectivos, agruparFacturas, listarNotas, calcConversion,
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

  it('descuento tasa 0 (caso real): subtotal 50160 − 13680 = 36480', () => {
    const calc = { subtotal: 50160, iva: 0, ieps: 0,
                   subtotalIva16: 0, subtotalIeps: 0, subtotalTasa0: 50160 };
    const r = calcularTotalesEfectivos({ calc, descuento: 13680 });
    // Opción B: la base gravable (valuación) NO baja; el descuento se resta al final.
    expect(r.baseGravable).toBeCloseTo(50160, 6);
    expect(r.total).toBeCloseTo(36480, 6);
  });

  it('descuento NO escala el IVA — va después de impuestos (Opción B)', () => {
    // 1000 base, IVA 160. Descuento 100 → base e IVA intactos, total = 1160 − 100 = 1060.
    const r = calcularTotalesEfectivos({ calc: calcBase, descuento: 100 });
    expect(r.baseGravable).toBeCloseTo(1000, 6);
    expect(r.iva).toBeCloseTo(160, 6);
    expect(r.total).toBeCloseTo(1060, 6);
  });

  it('descuento 0 = idéntico a sin descuento (retrocompat)', () => {
    const a = calcularTotalesEfectivos({ calc: calcBase });
    const b = calcularTotalesEfectivos({ calc: calcBase, descuento: 0 });
    expect(b.total).toBe(a.total);
    expect(b.iva).toBe(a.iva);
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

describe('calcConversion — factor de presentación', () => {
  it('CAJA 0.45 Kg → usarPresentacion=true (antes bug: factor > 1 lo excluía)', () => {
    const { factor, usarPresentacion } = calcConversion('0.45', 'CAJA');
    expect(factor).toBeCloseTo(0.45);
    expect(usarPresentacion).toBe(true);
  });

  it('BULTO 25 Kg → usarPresentacion=true', () => {
    const { factor, usarPresentacion } = calcConversion('25', 'BULTO');
    expect(factor).toBe(25);
    expect(usarPresentacion).toBe(true);
  });

  it('BIDON 19 Kg → usarPresentacion=true', () => {
    const { usarPresentacion } = calcConversion('19', 'BIDON');
    expect(usarPresentacion).toBe(true);
  });

  it('sin presentación → usarPresentacion=false aunque tenga factor', () => {
    const { usarPresentacion } = calcConversion('25', '');
    expect(usarPresentacion).toBe(false);
  });

  it('factor=1 (SUELTO) → usarPresentacion=false (sin conversión, es directo en Kg)', () => {
    const { usarPresentacion } = calcConversion('1', 'SUELTO');
    expect(usarPresentacion).toBe(false);
  });

  it('sin datos → factor=1, usarPresentacion=false', () => {
    const { factor, usarPresentacion } = calcConversion('', '');
    expect(factor).toBe(1);
    expect(usarPresentacion).toBe(false);
  });
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const mkCompra = (overrides) => ({
  name: 'PR-001', supplier: 'SUP-A', supplier_name: 'Proveedor A',
  posting_date: '2026-06-01', docstatus: 1,
  custom_tipo_comprobante: 'Factura', custom_consolidado: 0,
  supplier_delivery_note: '', custom_facturado_a: 'ALMA RODRIGUEZ',
  total: '100', grand_total: '116', custom_pagado: 0,
  ...overrides,
});

describe('agruparFacturas — vista Facturas', () => {
  it('factura directa → 1 grupo, esConsolidacion=false', () => {
    const grupos = agruparFacturas([mkCompra({ supplier_delivery_note: 'FAC-001' })]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].esConsolidacion).toBe(false);
    expect(grupos[0].folio).toBe('FAC-001');
  });

  it('nota suelta (sin consolidar) → excluida de vista Facturas', () => {
    const grupos = agruparFacturas([
      mkCompra({ custom_tipo_comprobante: 'Nota', custom_consolidado: 0 }),
    ]);
    expect(grupos).toHaveLength(0);
  });

  it('nota consolidada sin folio → excluida de vista Facturas', () => {
    const grupos = agruparFacturas([
      mkCompra({ custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: '' }),
    ]);
    expect(grupos).toHaveLength(0);
  });

  it('2 notas consolidadas mismo proveedor+folio → colapsan en 1 grupo', () => {
    const base = { supplier: 'SUP-A', custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: 'FAC-X' };
    const grupos = agruparFacturas([
      mkCompra({ ...base, name: 'PR-001', total: '100', grand_total: '116' }),
      mkCompra({ ...base, name: 'PR-002', total: '200', grand_total: '232' }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].esConsolidacion).toBe(true);
    expect(grupos[0].notas).toHaveLength(2);
    expect(grupos[0].grand_total).toBeCloseTo(348, 2);
  });

  it('2 notas distintos proveedores → 2 grupos separados', () => {
    const base = { custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: 'FAC-X' };
    const grupos = agruparFacturas([
      mkCompra({ ...base, supplier: 'SUP-A', name: 'PR-001' }),
      mkCompra({ ...base, supplier: 'SUP-B', name: 'PR-002' }),
    ]);
    expect(grupos).toHaveLength(2);
  });

  it('ordena por fecha desc', () => {
    const grupos = agruparFacturas([
      mkCompra({ name: 'PR-001', supplier_delivery_note: 'F1', posting_date: '2026-05-01' }),
      mkCompra({ name: 'PR-002', supplier_delivery_note: 'F2', posting_date: '2026-06-15' }),
    ]);
    expect(grupos[0].folio).toBe('F2');
    expect(grupos[1].folio).toBe('F1');
  });

  it('pagadas cuenta correctamente dentro del grupo', () => {
    const base = { supplier: 'SUP-A', custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: 'FAC-Y' };
    const grupos = agruparFacturas([
      mkCompra({ ...base, name: 'PR-001', custom_pagado: 1 }),
      mkCompra({ ...base, name: 'PR-002', custom_pagado: 0 }),
    ]);
    expect(grupos[0].pagadas).toBe(1);
    expect(grupos[0].notas).toHaveLength(2);
  });

  it('factura totalmente cancelada → VISIBLE con total 0 y flag cancelada', () => {
    const grupos = agruparFacturas([
      mkCompra({ supplier_delivery_note: 'FAC-CANC', docstatus: 2, total: '500', grand_total: '580' }),
    ]);
    expect(grupos).toHaveLength(1);       // ya NO desaparece (bug)
    expect(grupos[0].cancelada).toBe(true);
    expect(grupos[0].total).toBe(0);      // cancelado no suma
    expect(grupos[0].activas).toBe(0);
  });

  it('grupo mixto (activa + cancelada) → visible, total solo de la activa', () => {
    const base = { supplier: 'SUP-A', custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: 'FAC-Z' };
    const grupos = agruparFacturas([
      mkCompra({ ...base, name: 'PR-001', total: '100', grand_total: '116' }),
      mkCompra({ ...base, name: 'PR-002', docstatus: 2, total: '200', grand_total: '232' }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].cancelada).toBe(false);
    expect(grupos[0].activas).toBe(1);
    expect(grupos[0].notas).toHaveLength(2);       // la cancelada sigue en el detalle
    expect(grupos[0].grand_total).toBeCloseTo(116, 2);
  });
});

describe('listarNotas — vista Notas', () => {
  it('nota suelta → tipo individual', () => {
    const items = listarNotas([
      mkCompra({ custom_tipo_comprobante: 'Nota', custom_consolidado: 0 }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe('individual');
  });

  it('factura directa → excluida de vista Notas', () => {
    const items = listarNotas([mkCompra({ custom_tipo_comprobante: 'Factura' })]);
    expect(items).toHaveLength(0);
  });

  it('2 notas consolidadas mismo grupo → 1 item tipo grupo con 2 notas', () => {
    const base = { supplier: 'SUP-A', custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: 'FAC-Z' };
    const items = listarNotas([
      mkCompra({ ...base, name: 'PR-001' }),
      mkCompra({ ...base, name: 'PR-002' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe('grupo');
    expect(items[0].grupo.notas).toHaveLength(2);
  });

  it('mix: nota suelta + grupo consolidado → ambos aparecen', () => {
    const items = listarNotas([
      mkCompra({ name: 'PR-001', custom_tipo_comprobante: 'Nota', custom_consolidado: 0 }),
      mkCompra({ name: 'PR-002', custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: 'FAC-Z' }),
    ]);
    expect(items).toHaveLength(2);
    const tipos = items.map(i => i.tipo);
    expect(tipos).toContain('individual');
    expect(tipos).toContain('grupo');
  });

  it('notas consolidadas sin folio → cada una tiene key propio (supplier|name) → 2 grupos de 1', () => {
    // Sin folio el key cae a supplier+name, así que no se pueden colapsar entre sí.
    // Cada nota aparece como su propio grupo. (Con folio sí colapsan, ver test anterior.)
    const base = { supplier: 'SUP-A', custom_tipo_comprobante: 'Nota', custom_consolidado: 1, supplier_delivery_note: '' };
    const items = listarNotas([
      mkCompra({ ...base, name: 'PR-001' }),
      mkCompra({ ...base, name: 'PR-002' }),
    ]);
    expect(items).toHaveLength(2);
    items.forEach(i => {
      expect(i.tipo).toBe('grupo');
      expect(i.grupo.notas).toHaveLength(1);
    });
  });
});
