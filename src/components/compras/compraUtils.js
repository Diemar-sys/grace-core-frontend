import { IMPUESTOS_MAP } from '../../config/impuestos';

export const MARGEN_DEFAULT = 100;

export const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: '', item_name: '', uom: '',
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

export const calcVariacion = (fila) => {
  const actual   = parseFloat(fila.rate || 0);
  const catalogo = parseFloat(fila.precio_catalogo || 0);
  if (!catalogo || !actual) return null;
  const diff = actual - catalogo;
  const pct  = (diff / catalogo) * 100;
  return { diff, pct, actual, catalogo, cambio: Math.abs(diff) > 0.005 };
};
