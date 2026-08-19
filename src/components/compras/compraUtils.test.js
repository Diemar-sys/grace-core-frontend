import { describe, it, expect } from 'vitest';
import {
  subtotalFila, impuestoFila, totalFila, calcVariacion, parseImpuesto, totalPorFila,
  calcularTotalesEfectivos, agruparFacturas, listarNotas, calcConversion, mezclarComprasYGastos, desgloseEgreso, calcGasolina, cambiosDePrecio } from './compraUtils';

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

  // Factura 11885 de MATERIAS PRIMAS PLASTICOS (18-ago-2026), capturada tal cual:
  // dos precios del proveedor traen más de 2 decimales (97.5539 y 110.268), y ahí
  // nace la cola. El papel dice 1,080.88; sumando crudo daban 1,080.87.
  it('el total es el del CFDI: suma de renglones redondeados, no redondeo de la suma', () => {
    const subtotalIva16 = 20 * 9.8 + 1 * 110.268 + 4 * 40 + 4 * 46.4;   // 651.868
    const subtotalTasa0 = 2 * 97.5539;                                   // 195.1078
    const subtotalIeps  = 3 * 40;                                        // 120
    const calc = {
      subtotal: subtotalIva16 + subtotalIeps + subtotalTasa0,
      iva: subtotalIva16 * 0.16,        // 104.29888
      ieps: subtotalIeps * 0.08,        // 9.6
      subtotalIva16, subtotalIeps, subtotalTasa0,
    };
    const r = calcularTotalesEfectivos({ calc });

    // Lo que se imprime, renglón por renglón, igual que la factura.
    expect(Number(r.subtotalIva16.toFixed(2))).toBe(651.87);
    expect(Number(r.subtotalTasa0.toFixed(2))).toBe(195.11);
    expect(Number(r.subtotalIeps.toFixed(2))).toBe(120.00);
    expect(Number(r.iva.toFixed(2))).toBe(104.30);
    expect(Number(r.ieps.toFixed(2))).toBe(9.60);

    // Y el total cuadra con esos renglones (966.98 + 104.30 + 9.60), no con la
    // suma cruda 1080.87468 que se quedaba a 0.00032 del medio centavo.
    expect(Number(r.total.toFixed(2))).toBe(1080.88);
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

describe('mezclarComprasYGastos — vista Total', () => {
  const compras = [
    { name: 'PR-1', docstatus: 1, custom_no_de_compra: 180, posting_date: '2026-07-23',
      supplier_name: 'EL TRIGAL', grand_total: '1000', custom_pagado: 1 },
    { name: 'PR-2', docstatus: 0, custom_no_de_compra: 186, posting_date: '2026-07-24',
      supplier_name: 'BORRADOR', grand_total: '99' },
    { name: 'PR-3', docstatus: 2, custom_no_de_compra: 187, posting_date: '2026-07-24',
      supplier_name: 'CANCELADA', grand_total: '77' },
  ];
  const egresos = [
    { name: 'EGR-1', no_de_compra: 185, fecha: '2026-07-24', proveedor: 'ROYAL PEST',
      concepto: 'FUMIGACION', monto: '580', pagado: 0, facturado_a: 'LUIS TORRES' },
  ];

  it('intercala gastos y compras por No. de compra descendente', () => {
    expect(mezclarComprasYGastos(compras, egresos).map(r => r.no)).toEqual([185, 180]);
  });

  it('deja fuera borradores y canceladas (no son dinero gastado)', () => {
    const nos = mezclarComprasYGastos(compras, egresos).map(r => r.no);
    expect(nos).not.toContain(186);
    expect(nos).not.toContain(187);
  });

  it('normaliza ambos lados a la misma fila', () => {
    const [gasto, compra] = mezclarComprasYGastos(compras, egresos);
    expect(gasto).toMatchObject({ esGasto: true, proveedor: 'ROYAL PEST', total: 580, pagado: false });
    expect(compra).toMatchObject({ esGasto: false, proveedor: 'EL TRIGAL', total: 1000, pagado: true });
  });

  it('sin proveedor cae al concepto (gasolina sin proveedor)', () => {
    const sinProv = [{ name: 'EGR-2', no_de_compra: 174, monto: '500', concepto: 'TORNADO VAN 4' }];
    expect(mezclarComprasYGastos([], sinProv)[0].proveedor).toBe('TORNADO VAN 4');
  });
});

describe('desgloseEgreso — detalle de un gasto', () => {
  // JSON real del gasto #156 (DIESGAS): GAS no usa partidas, guarda el desglose
  // como JSON en descripcion. El modal lo escupía crudo en pantalla.
  const GAS_156 = '{"gas_litros":"277.56","gas_precio":"9.103422","gas_subtotal":2526.74581032,'
    + '"aditivo_litros":"1","aditivo_precio":"71.782121","aditivo_subtotal":71.782121,'
    + '"subtotal":2598.5279313200003,"descuento":119.63,"base_gravable":2478.89793132,'
    + '"iva":396.62366901120004,"total":2875.5216003312003}';

  it('desdobla el JSON de gas en renglones (gas, aditivo, descuento)', () => {
    const { filas, texto } = desgloseEgreso({ subcategoria: 'GAS', descripcion: GAS_156 });
    expect(texto).toBeNull();
    expect(filas.map(f => f.concepto)).toEqual(['GAS', 'ADITIVO', 'DESCUENTO']);
    expect(filas[0]).toMatchObject({ cantidad: '277.56', precio: '9.103422', importe: 2526.74581032 });
    expect(filas[2].importe).toBe(-119.63);
  });

  it('los importes cuadran contra el total del egreso', () => {
    const { filas } = desgloseEgreso({ descripcion: GAS_156 });
    const suma = filas.reduce((s, f) => s + Number(f.importe), 0);
    expect(suma).toBeCloseTo(2478.89793132, 6); // base gravable, antes de IVA
  });

  it('nunca devuelve el JSON como texto, aunque no arme renglones', () => {
    expect(desgloseEgreso({ descripcion: '{"gas_litros":"0"}' })).toEqual({ filas: [], texto: null });
  });

  it('las partidas mandan sobre la descripción', () => {
    const partidas = [{ concepto: 'ESCALERA', cantidad: 1, precio: 2400, importe: 2400 }];
    expect(desgloseEgreso({ partidas, descripcion: 'nota suelta' }).filas).toBe(partidas);
  });

  it('texto libre se muestra tal cual', () => {
    expect(desgloseEgreso({ descripcion: 'PAGO EN EFECTIVO' }).texto).toBe('PAGO EN EFECTIVO');
    expect(desgloseEgreso({}).texto).toBeNull();
  });
});

describe('calcGasolina — IVA y total copiados del CFDI', () => {
  // 38.5 L a $13.42/L; el CFDI trae IVA $122.43 y total $887.64
  const carga = { litros: '38.5', precio: '13.42', iva: '122.43', total: '887.64' };

  it('el total guardado es EXACTAMENTE el del CFDI (cero desfase)', () => {
    const { total, iva } = calcGasolina(carga);
    expect(total).toBe(887.64);
    expect(iva).toBe(122.43);
  });

  it('el IEPS sale por resta, no se teclea', () => {
    const { base, ieps, baseGravable } = calcGasolina(carga);
    expect(base).toBeCloseTo(516.67, 2);
    expect(ieps).toBeCloseTo(248.54, 2);          // 887.64 − 516.67 − 122.43
    expect(baseGravable).toBeCloseTo(765.21, 2);  // total − IVA
    expect(ieps).not.toBeCloseTo(base * 0.08, 2); // el bug viejo: IEPS 8%
  });

  it('sin capturar nada de la factura: IVA 16% de la base y cero IEPS', () => {
    const { iva, ieps, total } = calcGasolina({ litros: '10', precio: '20' });
    expect(iva).toBeCloseTo(32, 6);
    expect(ieps).toBe(0);
    expect(total).toBeCloseTo(232, 6);
  });

  it('IVA en cero es un override válido, no un campo vacío', () => {
    const { iva, total } = calcGasolina({ litros: '10', precio: '20', iva: '0' });
    expect(iva).toBe(0);
    expect(total).toBeCloseTo(200, 6);
  });

  it('sin total capturado asume que no hubo IEPS', () => {
    const { ieps, baseGravable, total } = calcGasolina({ litros: '10', precio: '20', iva: '32' });
    expect(ieps).toBe(0);
    expect(baseGravable).toBeCloseTo(200, 6);
    expect(total).toBeCloseTo(232, 6);
  });

  it('total menor que base + IVA da IEPS negativo (la UI lo alerta)', () => {
    const { ieps } = calcGasolina({ litros: '10', precio: '20', iva: '32', total: '200' });
    expect(ieps).toBeLessThan(0);
  });

  it('campos vacíos no producen NaN', () => {
    expect(calcGasolina({})).toEqual({ base: 0, ieps: 0, baseGravable: 0, iva: 0, total: 0 });
  });

  it('desgloseEgreso desdobla la gasolina en combustible + IEPS', () => {
    const g = calcGasolina(carga);
    const descripcion = JSON.stringify({
      gasolina_litros: carga.litros, gasolina_precio: carga.precio, gasolina_base: g.base,
      ieps_importe: g.ieps, base_gravable: g.baseGravable, iva: g.iva, total: g.total,
    });
    const { filas, texto } = desgloseEgreso({ subcategoria: 'GASOLINA', descripcion });
    expect(texto).toBeNull();
    expect(filas.map(f => f.concepto)).toEqual(['GASOLINA', 'IEPS']);
    expect(filas[0].importe).toBeCloseTo(516.67, 2);
    expect(filas[1].importe).toBeCloseTo(248.54, 2);
  });

  it('gastos viejos (con ieps_cuota) siguen mostrando la cuota por litro', () => {
    const descripcion = JSON.stringify({
      gasolina_litros: '38.5', gasolina_precio: '13.42', gasolina_base: 516.67,
      ieps_cuota: '6.4556', ieps_importe: 248.5406,
    });
    const { filas } = desgloseEgreso({ subcategoria: 'GASOLINA', descripcion });
    expect(filas[1].precio).toBe('6.4556');
  });
});

describe('cambiosDePrecio', () => {
  const CAT = { HARINA: { custom_precio_de_compra: 383, item_name: 'HARINA REAL ALTEÑA' } };

  it('reporta el insumo que se compró más caro, con su precio anterior', () => {
    const r = cambiosDePrecio([{ item_code: 'HARINA', item_name: 'HARINA', rate: '500' }], CAT);
    expect(r).toEqual([{ item_code: 'HARINA', item_name: 'HARINA', antes: 383, ahora: 500 }]);
  });

  it('también reporta cuando BAJA: el catálogo sigue el precio pagado', () => {
    const r = cambiosDePrecio([{ item_code: 'HARINA', item_name: 'HARINA', rate: '300' }], CAT);
    expect(r[0]).toMatchObject({ antes: 383, ahora: 300 });
  });

  it('no depende de precio_catalogo en la fila: ese era el bug', () => {
    // La fila viene SIN precio_catalogo (borrador restaurado, item recargado).
    const r = cambiosDePrecio([{ item_code: 'HARINA', item_name: 'HARINA', rate: '500' }], CAT);
    expect(r).toHaveLength(1);
  });

  it('mismo precio o diferencia sub-centavo no es un cambio', () => {
    expect(cambiosDePrecio([{ item_code: 'HARINA', rate: '383' }], CAT)).toEqual([]);
    expect(cambiosDePrecio([{ item_code: 'HARINA', rate: '383.004' }], CAT)).toEqual([]);
  });

  it('rate 0 no cuenta: el backend tampoco lo escribe', () => {
    expect(cambiosDePrecio([{ item_code: 'HARINA', rate: '0' }], CAT)).toEqual([]);
  });

  it('sin precio previo no hay «antes» que mostrar', () => {
    expect(cambiosDePrecio([{ item_code: 'NUEVO', rate: '100' }], CAT)).toEqual([]);
    expect(cambiosDePrecio([{ item_code: 'X', rate: '100' }], { X: { custom_precio_de_compra: 0 } })).toEqual([]);
  });

  it('el mismo insumo en dos filas: gana la última, igual que el backend', () => {
    const r = cambiosDePrecio([
      { item_code: 'HARINA', item_name: 'HARINA', rate: '400' },
      { item_code: 'HARINA', item_name: 'HARINA', rate: '500' },
    ], CAT);
    expect(r).toHaveLength(1);
    expect(r[0].ahora).toBe(500);
  });

  it('toma el nombre del catálogo si la fila no lo trae', () => {
    const r = cambiosDePrecio([{ item_code: 'HARINA', rate: '500' }], CAT);
    expect(r[0].item_name).toBe('HARINA REAL ALTEÑA');
  });

  it('sin catálogo previo no truena', () => {
    expect(cambiosDePrecio([{ item_code: 'HARINA', rate: '500' }], {})).toEqual([]);
    expect(cambiosDePrecio(null, null)).toEqual([]);
  });
});
