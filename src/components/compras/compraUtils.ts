import { IMPUESTOS_MAP } from '../../config/impuestos';

export const MARGEN_DEFAULT = 10;

export const escHTML = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c] as string));

export const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: '', item_name: '', uom: '', presentacion: '',
  bultos: '', kg_por_bulto: '', rate: '',
  precio_catalogo: '',
  precio_por_kg: '',
  impuesto_key: 'tasa0', impuesto_label: 'Tasa 0', impuesto_rate: 0,
});

export const parseImpuesto = (description = '') => {
  if (description.includes('IVA')) return IMPUESTOS_MAP['iva16'];
  if (description.includes('IEPS')) return IMPUESTOS_MAP['ieps'];
  return IMPUESTOS_MAP['tasa0'];
};

export const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const totalPorFila = (f: any) => parseFloat(f.bultos || 0) * parseFloat(f.kg_por_bulto || 0);

// Determina si aplica conversión de presentación al enviar a ERPNext.
// factor !== 1 cubre tanto > 1 (BULTO 25 Kg) como < 1 (CAJA 0.45 Kg).
export function calcConversion(kg_por_bulto: any, presentacion: any) {
  const factor = parseFloat(kg_por_bulto) || 1;
  return { factor, usarPresentacion: factor !== 1 && !!presentacion };
}

// Sin redondeo intermedio por línea — espejo del cálculo server-side de ERPNext
// con Currency Precision = 6. UI suma con precisión completa y redondea solo al
// mostrar via fmt(). Así total UI coincide con grand_total de ERPNext.
export const subtotalFila = (f: any) => parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);
export const impuestoFila = (f: any) => subtotalFila(f) * parseFloat(f.impuesto_rate || 0);
export const totalFila    = (f: any) => subtotalFila(f) + impuestoFila(f);

// Totales calculados desde las filas (base para calcularTotalesEfectivos).
interface CalcTotales {
  subtotal: number;
  iva: number;
  ieps: number;
  subtotalIva16: number;
  subtotalIeps: number;
  subtotalTasa0: number;
}
type CampoTotal = 'iva' | 'ieps' | 'subtotalIva16' | 'subtotalIeps' | 'subtotalTasa0';

/**
 * Calcula los totales EFECTIVOS de una compra: aplica overrides manuales sobre los
 * valores calculados y deriva el ajuste por redondeo SAT (espejo de ERPNext, precisión 6).
 * Función PURA — produce el grand_total que se envía a ERPNext. Testeable de forma aislada.
 */
export const calcularTotalesEfectivos = ({ calc, overrides = {}, manual = {}, ajuste = 0, descuento = 0 }: {
  calc: CalcTotales;
  overrides?: Partial<Record<CampoTotal, any>>;
  manual?: Partial<Record<CampoTotal | 'ajuste', boolean>>;
  ajuste?: number | string;
  descuento?: number | string;
}) => {
  const num = (v: any) => parseFloat(v || 0);

  const subtotalIva16 = manual.subtotalIva16 ? num(overrides.subtotalIva16) : calc.subtotalIva16;
  const subtotalIeps  = manual.subtotalIeps  ? num(overrides.subtotalIeps)  : calc.subtotalIeps;
  const subtotalTasa0 = manual.subtotalTasa0 ? num(overrides.subtotalTasa0) : calc.subtotalTasa0;

  const subtotalEfectivo = subtotalIva16 + subtotalIeps + subtotalTasa0;
  const subtotalDiff     = subtotalEfectivo - calc.subtotal;

  // Descuento comercial (Opción B): NO baja la base gravable ni la valuación.
  // IVA/IEPS se calculan sobre el valor COMPLETO; el descuento se resta al final
  // (después de impuestos). En ERPNext = deducción categoría "Total" → baja el
  // grand_total a pagar pero deja el valuation_rate del inventario intacto.
  const descuentoNum = num(descuento);
  const baseGravable = subtotalEfectivo;

  // IVA/IEPS sobre el subtotal completo. El override manual (cuadre CFDI) se respeta.
  const iva  = (manual.iva  && calc.iva  > 0) ? num(overrides.iva)  : calc.iva;
  const ieps = (manual.ieps && calc.ieps > 0) ? num(overrides.ieps) : calc.ieps;

  const rawTotal       = baseGravable + iva + ieps;

  // Ajuste SAT: lleva el total (pre-descuento) al MISMO peso que imprime el CFDI.
  //
  // El proveedor redondea cada renglón a 2 decimales y suma esos redondeados; aquí
  // se sumaba con precisión completa y se redondeaba al final. No es lo mismo:
  // factura 11885 (18-ago) daba 1,080.87 contra 1,080.88 del papel, y la suma cruda
  // —1,080.87468— se quedó a 0.00032 del medio centavo. Subtotales, IVA y IEPS
  // cuadraban uno por uno; solo el total no, porque los renglones impresos no eran
  // los que se estaban sumando. Un total que no es la suma de lo que está escrito
  // arriba es un fantasma en pantalla.
  //
  // Ahora el objetivo es la suma de los renglones YA redondeados, que es tanto lo
  // que se pinta como lo que el proveedor cobra. rawTotal sigue crudo: la
  // diferencia viaja en el ajuste, que es justo para lo que existe.
  const r2             = (n: number) => Math.round(n * 100) / 100;
  const totalCfdi      = r2(r2(subtotalIva16) + r2(subtotalIeps) + r2(subtotalTasa0) + r2(iva) + r2(ieps));
  const ajusteSAT      = Math.round((totalCfdi - rawTotal) * 1e6) / 1e6;
  const ajusteEfectivo = manual.ajuste ? num(ajuste) : ajusteSAT;
  const ajusteParaErp  = ajusteEfectivo + subtotalDiff;

  return {
    iva, ieps, subtotalIva16, subtotalIeps, subtotalTasa0,
    subtotalEfectivo, subtotalDiff, rawTotal,
    descuento: descuentoNum, baseGravable, factorNet: 1,
    ajusteSAT, ajusteEfectivo, ajusteParaErp,
    total: rawTotal + ajusteEfectivo - descuentoNum,
  };
};

// ── Agrupación de compras (vista Facturas) ───────────────────────────────────
// Recibe filteredCompras y devuelve grupos por proveedor+folio, ordenados por fecha desc.
export function agruparFacturas(filteredCompras: any[]): any[] {
  const grupos = new Map<string, any>();
  for (const c of filteredCompras) {
    const esConsolidada = !!(c.custom_consolidado && c.custom_tipo_comprobante === 'Nota');
    const esFactura = c.custom_tipo_comprobante === 'Factura';
    if (!esConsolidada && !esFactura) continue;
    const folio = c.supplier_delivery_note || '';
    if (esConsolidada && !folio) continue;
    const key = c.supplier + '|' + (folio || c.name);
    const g = grupos.get(key) || {
      key, supplier: c.supplier, supplier_name: c.supplier_name, folio,
      facturado_a: c.custom_facturado_a, total: 0, grand_total: 0,
      posting_date: c.posting_date, pagadas: 0, activas: 0, notas: [], esConsolidacion: false,
    };
    // ponytail: cancelado (docstatus 2) entra al grupo pa que sea VISIBLE, pero no suma a total/pago
    if (c.docstatus !== 2) {
      g.total      += parseFloat(c.total || 0);
      g.grand_total += parseFloat(c.grand_total || 0);
      if (c.custom_pagado) g.pagadas += 1;
      g.activas += 1;
    }
    if ((c.posting_date || '') > (g.posting_date || '')) g.posting_date = c.posting_date;
    g.esConsolidacion = g.esConsolidacion || esConsolidada;
    g.notas.push(c);
    grupos.set(key, g);
  }
  return [...grupos.values()]
    .map(g => ({ ...g, cancelada: g.activas === 0 })) // todas las notas canceladas
    .sort((a, b) => (b.posting_date || '').localeCompare(a.posting_date || ''));
}

// ── Lista de notas (vista Notas) ─────────────────────────────────────────────
// Devuelve items planos con tipo 'individual' | 'grupo' (consolidadas plegadas).
export function listarNotas(filteredCompras: any[]): any[] {
  const grupos = new Map<string, any>();
  const items: any[]  = [];
  for (const c of filteredCompras) {
    const consolidada = c.custom_consolidado && c.custom_tipo_comprobante === 'Nota';
    if (!consolidada) {
      if (c.custom_tipo_comprobante === 'Factura') continue;
      items.push({ tipo: 'individual', compra: c });
      continue;
    }
    const folio = c.supplier_delivery_note || '';
    const key   = c.supplier + '|' + (folio || c.name);
    let g = grupos.get(key);
    if (!g) {
      g = { key, supplier: c.supplier, supplier_name: c.supplier_name, folio,
        facturado_a: c.custom_facturado_a, total: 0, grand_total: 0,
        posting_date: c.posting_date, pagadas: 0, notas: [] };
      grupos.set(key, g);
      items.push({ tipo: 'grupo', grupo: g });
    }
    g.total      += parseFloat(c.total || 0);
    g.grand_total += parseFloat(c.grand_total || 0);
    if ((c.posting_date || '') > (g.posting_date || '')) g.posting_date = c.posting_date;
    if (c.custom_pagado) g.pagadas += 1;
    g.notas.push(c);
  }
  return items;
}

/**
 * Vista Total: mercancía (Purchase Receipt) + servicios (Egreso) en un solo listado,
 * ordenado por el consecutivo No. de compra que ambos comparten.
 * Solo entran compras recibidas (docstatus 1): un borrador o una cancelada no es dinero gastado.
 */
export function mezclarComprasYGastos(compras: any[], egresos: any[]) {
  return [
    ...compras.filter(c => c.docstatus === 1).map(c => ({
      key: c.name, esGasto: false, raw: c,
      no: c.custom_no_de_compra, fecha: c.posting_date,
      proveedor: c.supplier_name || c.supplier,
      facturado_a: c.custom_facturado_a || 'SIN FACTURA',
      total: parseFloat(c.grand_total || 0), pagado: !!c.custom_pagado,
    })),
    ...egresos.map(e => ({
      key: e.name, esGasto: true, raw: e,
      no: e.no_de_compra, fecha: e.fecha,
      proveedor: e.proveedor || e.concepto || '—',
      facturado_a: e.facturado_a || 'SIN FACTURA',
      total: parseFloat(e.monto || 0), pagado: !!e.pagado,
    })),
  ].sort((a, b) => (b.no || 0) - (a.no || 0));
}

/**
 * Gasolina: no se recalculan los impuestos, se COPIAN del CFDI.
 * El IEPS es cuota fija por litro que Hacienda mueve con los estímulos, y el IVA
 * va sobre base + IEPS — replicar esa aritmética siempre dejaba centavos de
 * diferencia contra la factura. Ahora IVA y total se teclean tal cual vienen
 * impresos y el IEPS sale por resta: cuadra por construcción.
 * Sin total capturado (carga sin factura) se asume que no hubo IEPS.
 */
export function calcGasolina({ litros, precio, iva, total }: { litros?: any; precio?: any; iva?: any; total?: any }) {
  const num = (v: any) => parseFloat(v) || 0;
  const vacio = (v: any) => v === '' || v == null;
  const base = num(litros) * num(precio);
  // Vacío = auto (carga sin IEPS al 16%). Con valor = override del CFDI, manda tal cual.
  const ivaNum   = vacio(iva)   ? base * 0.16   : num(iva);
  const totalNum = vacio(total) ? base + ivaNum : num(total);
  const ieps = totalNum - base - ivaNum;   // derivado: lo que la factura cobró de más
  return { base, ieps, baseGravable: totalNum - ivaNum, iva: ivaNum, total: totalNum };
}

/**
 * Renglones para el detalle de un gasto.
 * Normalmente son sus partidas. Los gastos de GAS no usan partidas: guardan el
 * desglose (litros, aditivo, descuento) como JSON en `descripcion` — ver
 * printService.imprimirEgresoTicket, que lee ese mismo JSON. Sin esto, el modal
 * escupía el JSON crudo en pantalla.
 * @returns filas para la tabla y, si no hay desglose, el texto libre a mostrar.
 */
export function desgloseEgreso(egreso: any): { filas: any[]; texto: string | null } {
  if (egreso?.partidas?.length) return { filas: egreso.partidas, texto: null };

  const raw = (egreso?.descripcion || '').trim();
  if (raw.startsWith('{')) {
    try {
      const d = JSON.parse(raw);
      const filas = [];
      if (Number(d.gas_litros))     filas.push({ concepto: 'GAS',     cantidad: d.gas_litros,     precio: d.gas_precio,     importe: d.gas_subtotal });
      if (Number(d.aditivo_litros)) filas.push({ concepto: 'ADITIVO', cantidad: d.aditivo_litros, precio: d.aditivo_precio, importe: d.aditivo_subtotal });
      if (Number(d.gasolina_litros)) {
        filas.push({ concepto: 'GASOLINA', cantidad: d.gasolina_litros, precio: d.gasolina_precio, importe: d.gasolina_base });
        // ieps_cuota solo existe en gastos viejos (cuando se tecleaba la cuota).
        if (Number(d.ieps_importe)) filas.push({ concepto: 'IEPS', cantidad: d.gasolina_litros, precio: d.ieps_cuota || '', importe: d.ieps_importe });
      }
      if (Number(d.descuento))      filas.push({ concepto: 'DESCUENTO', cantidad: '', precio: '', importe: -Number(d.descuento) });
      // JSON reconocido: nunca se muestra crudo, aunque no arme ningún renglón.
      return { filas, texto: null };
    } catch { /* no era JSON válido → cae a texto libre */ }
  }
  return { filas: [], texto: raw || null };
}

export const calcVariacion = (fila: any) => {
  const actual   = parseFloat(fila.rate || 0);
  const catalogo = parseFloat(fila.precio_catalogo || 0);
  if (!catalogo || !actual) return null;
  const diff = actual - catalogo;
  const pct  = (diff / catalogo) * 100;
  return { diff, pct, actual, catalogo, cambio: Math.abs(diff) > 0.005 };
};

/**
 * Qué precios movió esta compra en el Catálogo.
 *
 * El «antes» se lee del servidor justo antes de confirmar, NO de
 * `fila.precio_catalogo`: ese campo solo se llena cuando el insumo se elige del
 * buscador, así que por cualquier otro camino (borrador restaurado, fila
 * recargada) quedaba vacío, `calcVariacion` devolvía null y el aviso no salía
 * nunca — el precio cambiaba mudo.
 *
 * Espeja las mismas reglas que el hook `sincronizar_precio_catalogo` del
 * backend, que es quien de verdad escribe: rate 0 no cuenta (regalo/ajuste),
 * diferencias sub-centavo no cuentan, y si el insumo viene en varias filas gana
 * la última. Si divergen, el modal mentiría sobre lo que pasó.
 *
 * @param items - Filas de la compra ({item_code, item_name, rate}).
 * @param catalogoAntes - {item_code: {custom_precio_de_compra, item_name}} leído
 *                        del servidor ANTES de confirmar.
 */
export const cambiosDePrecio = (items: any[], catalogoAntes: Record<string, any>) => {
  const porItem = new Map<string, any>();
  (items || []).forEach(f => {
    const ahora = parseFloat(f.rate || 0);
    if (!(ahora > 0)) return;
    const prev = (catalogoAntes || {})[f.item_code];
    const antes = parseFloat(prev?.custom_precio_de_compra || 0);
    if (!(antes > 0)) return;               // sin precio previo no hay «antes» que mostrar
    if (Math.abs(ahora - antes) < 0.005) return;
    porItem.set(f.item_code, {
      item_code: f.item_code,
      item_name: f.item_name || prev.item_name || f.item_code,
      antes, ahora,
    });
  });
  return [...porItem.values()];
};
