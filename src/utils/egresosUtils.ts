import { IMPUESTOS_MAP, desglosarImpuesto, grupoSubtotal } from '../config/impuestos';
import { calcularTotalesEfectivos } from '../components/compras/compraUtils';

function n(v: any): number {
  return parseFloat(v) || 0;
}

// Proveedor (supplier_name) → autocompleta Agua. Match por substring, sin acentos/caso.
const AUTO_AGUA = [
  { match: 'bonafont',          concepto: 'Agua para consumo humano' },
  { match: 'pipa de agua',      concepto: 'Pipa de agua' },
];

export function autoAgua(label?: string) {
  const t = (label || '').toLowerCase();
  const hit = AUTO_AGUA.find(a => t.includes(a.match));
  return hit ? { subcategoria: 'Agua', concepto: hit.concepto } : null;
}

// Agrupa bases por tasa (estilo Compras) y deriva total + ajuste SAT vía la
// misma función pura que usa Compras. ajusteManual sobrescribe el redondeo auto.
export function calcTotalesPartidas(partidas: any[], ajuste?: any, ajusteManual?: boolean) {
  const calc = (partidas || []).reduce((a, p) => {
    const base = n(p.cantidad) * n(p.precio);
    const key  = p.impuesto_key || 'tasa0';
    // Misma aritmética que Compras y B2B: la cascada IEPS → IVA vive en un solo lado.
    const { ieps, iva } = desglosarImpuesto(base, key);
    a.subtotal += base;
    a.iva  += iva;
    a.ieps += ieps;
    a[grupoSubtotal(key)] += base;
    return a;
  }, { subtotal: 0, iva: 0, ieps: 0, subtotalIva16: 0, subtotalIeps: 0, subtotalTasa0: 0 });
  const ef = calcularTotalesEfectivos({ calc, manual: { ajuste: !!ajusteManual }, ajuste: ajuste || 0 });
  return { calc, ef };
}
