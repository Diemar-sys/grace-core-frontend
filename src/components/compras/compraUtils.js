import { IMPUESTOS_MAP } from '../../config/impuestos';

export const MARGEN_DEFAULT = 100;

export const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

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

export const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const totalPorFila = (f) => parseFloat(f.bultos || 0) * parseFloat(f.kg_por_bulto || 0);

// Sin redondeo intermedio por línea — espejo del cálculo server-side de ERPNext
// con Currency Precision = 6. UI suma con precisión completa y redondea solo al
// mostrar via fmt(). Así total UI coincide con grand_total de ERPNext.
export const subtotalFila = (f) => parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);
export const impuestoFila = (f) => subtotalFila(f) * parseFloat(f.impuesto_rate || 0);
export const totalFila    = (f) => subtotalFila(f) + impuestoFila(f);

/**
 * Calcula los totales EFECTIVOS de una compra: aplica overrides manuales sobre los
 * valores calculados y deriva el ajuste por redondeo SAT (espejo de ERPNext, precisión 6).
 * Función PURA — produce el grand_total que se envía a ERPNext. Testeable de forma aislada.
 *
 * @param {object} p
 * @param {{subtotal:number, iva:number, ieps:number, subtotalIva16:number, subtotalIeps:number, subtotalTasa0:number}} p.calc - Totales calculados desde las filas.
 * @param {{iva?:any, ieps?:any, subtotalIva16?:any, subtotalIeps?:any, subtotalTasa0?:any}} [p.overrides] - Valores ingresados a mano.
 * @param {{iva?:boolean, ieps?:boolean, subtotalIva16?:boolean, subtotalIeps?:boolean, subtotalTasa0?:boolean, ajuste?:boolean}} [p.manual] - Qué campos están en modo manual.
 * @param {string|number} [p.ajuste] - Ajuste manual de balance.
 * @returns {object} Totales efectivos + ajusteSAT/ajusteParaErp + total.
 */
export const calcularTotalesEfectivos = ({ calc, overrides = {}, manual = {}, ajuste = 0 }) => {
  const num = (v) => parseFloat(v || 0);

  const iva  = (manual.iva  && calc.iva  > 0) ? num(overrides.iva)  : calc.iva;
  const ieps = (manual.ieps && calc.ieps > 0) ? num(overrides.ieps) : calc.ieps;

  const subtotalIva16 = manual.subtotalIva16 ? num(overrides.subtotalIva16) : calc.subtotalIva16;
  const subtotalIeps  = manual.subtotalIeps  ? num(overrides.subtotalIeps)  : calc.subtotalIeps;
  const subtotalTasa0 = manual.subtotalTasa0 ? num(overrides.subtotalTasa0) : calc.subtotalTasa0;

  const subtotalEfectivo = subtotalIva16 + subtotalIeps + subtotalTasa0;
  const subtotalDiff     = subtotalEfectivo - calc.subtotal;

  const rawTotal       = subtotalEfectivo + iva + ieps;
  // Ajuste SAT: lleva el total a 2 decimales exactos sin redondeo intermedio (precisión 6).
  const ajusteSAT      = Math.round((Math.round(rawTotal * 100) / 100 - rawTotal) * 1e6) / 1e6;
  const ajusteEfectivo = manual.ajuste ? num(ajuste) : ajusteSAT;
  const ajusteParaErp  = ajusteEfectivo + subtotalDiff;

  return {
    iva, ieps, subtotalIva16, subtotalIeps, subtotalTasa0,
    subtotalEfectivo, subtotalDiff, rawTotal,
    ajusteSAT, ajusteEfectivo, ajusteParaErp,
    total: rawTotal + ajusteEfectivo,
  };
};

export const calcVariacion = (fila) => {
  const actual   = parseFloat(fila.rate || 0);
  const catalogo = parseFloat(fila.precio_catalogo || 0);
  if (!catalogo || !actual) return null;
  const diff = actual - catalogo;
  const pct  = (diff / catalogo) * 100;
  return { diff, pct, actual, catalogo, cambio: Math.abs(diff) > 0.005 };
};
