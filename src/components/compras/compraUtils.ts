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
  // Ajuste SAT: lleva el total (pre-descuento) a 2 decimales exactos sin redondeo intermedio.
  const ajusteSAT      = Math.round((Math.round(rawTotal * 100) / 100 - rawTotal) * 1e6) / 1e6;
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

export const calcVariacion = (fila: any) => {
  const actual   = parseFloat(fila.rate || 0);
  const catalogo = parseFloat(fila.precio_catalogo || 0);
  if (!catalogo || !actual) return null;
  const diff = actual - catalogo;
  const pct  = (diff / catalogo) * 100;
  return { diff, pct, actual, catalogo, cambio: Math.abs(diff) > 0.005 };
};
