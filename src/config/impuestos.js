/**
 * Catálogo único de impuestos aplicables.
 * Fuente de verdad para tasas, etiquetas UI y mapeo a Item Tax Template de ERPNext.
 *
 * Uso:
 *   import { IMPUESTOS_LIST, IMPUESTOS_MAP, getTasa, buildTaxes } from '../config/impuestos';
 */

/** Tasas planas — útiles para cálculos rápidos por clave. */
export const IMPUESTOS_TASAS = { tasa0: 0, iva16: 0.16, ieps: 0.08 };

/** Lista ordenada para selects/UI. */
export const IMPUESTOS_LIST = [
  { key: 'tasa0', label: 'Tasa 0',  rate: 0 },
  { key: 'iva16', label: 'IVA 16%', rate: 0.16 },
  { key: 'ieps',  label: 'IEPS 8%', rate: 0.08 },
];

/** Acceso por clave — { tasa0: {...}, iva16: {...}, ieps: {...} } */
export const IMPUESTOS_MAP = Object.fromEntries(
  IMPUESTOS_LIST.map(i => [i.key, i])
);

import { getAppConfigSync } from '../services/appConfig';

/**
 * Construye el array `taxes` para el payload de ERPNext usando los nombres
 * de Item Tax Template resueltos via AppConfig (no hardcoded).
 *
 * Llamar `loadAppConfig()` al inicio de la sesión para asegurar valores frescos.
 * Si AppConfig no cargado, usa FALLBACK hardcoded del appConfig.
 *
 * @param {string} claveImpuesto - 'tasa0' | 'ieps' | 'iva16'
 * @returns {Array} Child table de Item Tax
 */
export function buildTaxes(claveImpuesto) {
  const cfg = getAppConfigSync();
  const tmpl = cfg.item_tax_templates?.[claveImpuesto];
  if (!tmpl) return [];
  return [{ item_tax_template: tmpl }];
}

/** Tasa numérica por clave. Default 0 si no existe. */
export function getTasa(clave) {
  return IMPUESTOS_TASAS[clave] ?? 0;
}
