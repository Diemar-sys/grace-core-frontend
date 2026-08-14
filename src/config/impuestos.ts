/**
 * Catálogo único de impuestos aplicables.
 * Fuente de verdad para tasas, etiquetas UI y mapeo a Item Tax Template de ERPNext.
 *
 * Uso:
 *   import { IMPUESTOS_LIST, IMPUESTOS_MAP, getTasa, buildTaxes } from '../config/impuestos';
 */

/**
 * Tasas planas — la fracción que se le suma a la base para llegar al precio final.
 *
 * `iva16_ieps` no es 0.16 + 0.08. Cuando un producto causa los dos, el IEPS entra
 * PRIMERO y el IVA se calcula sobre base + IEPS (misma cascada que la gasolina):
 *   1.08 × 1.16 = 1.2528  →  25.28%, no 24%.
 * Sobre $100 la diferencia es $1.28 por pieza; a volumen de panadería, no es ruido.
 */
export const IMPUESTOS_TASAS = { tasa0: 0, iva16: 0.16, ieps: 0.08, iva16_ieps: 0.2528 };

/** Lista ordenada para selects/UI. */
export const IMPUESTOS_LIST = [
  { key: 'tasa0',      label: 'Tasa 0',            rate: 0 },
  { key: 'iva16',      label: 'IVA 16%',           rate: 0.16 },
  { key: 'ieps',       label: 'IEPS 8%',           rate: 0.08 },
  { key: 'iva16_ieps', label: 'IVA 16% + IEPS 8%', rate: 0.2528 },
];

/**
 * Traduce dos casillas (IVA / IEPS) a la clave que guarda el Item.
 * Ninguna marcada = tasa 0: no es un impuesto, es la ausencia de los dos.
 */
export function claveImpuesto(conIva: boolean, conIeps: boolean) {
  if (conIva && conIeps) return 'iva16_ieps';
  if (conIva)  return 'iva16';
  if (conIeps) return 'ieps';
  return 'tasa0';
}

/**
 * Desglosa cuánto impuesto lleva un importe base, por concepto.
 * Única fuente de la cascada IEPS → IVA. Para las claves de un solo impuesto
 * devuelve exactamente lo de siempre; solo la clave doble estrena aritmética.
 */
export function desglosarImpuesto(base: number, clave: string) {
  const b = Number(base) || 0;
  const conIeps = clave === 'ieps'  || clave === 'iva16_ieps';
  const conIva  = clave === 'iva16' || clave === 'iva16_ieps';
  const ieps = conIeps ? b * 0.08 : 0;
  const iva  = conIva  ? (b + ieps) * 0.16 : 0;   // el IEPS es parte de la base del IVA
  return { ieps, iva };
}

/**
 * A qué columna del desglose por tasa pertenece la base de una fila.
 * La base va a UN solo grupo: subtotalIva16 + subtotalIeps + subtotalTasa0 se
 * suman para formar el subtotal, así que contarla dos veces inflaría el total.
 * Con ambos impuestos manda IVA — es el grupo que el SAT mira primero.
 * ponytail: el CFDI real lo timbra CONTPAQi, aquí solo se necesita que el total cuadre.
 */
export function grupoSubtotal(clave: string) {
  if (clave === 'iva16' || clave === 'iva16_ieps') return 'subtotalIva16';
  if (clave === 'ieps') return 'subtotalIeps';
  return 'subtotalTasa0';
}

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
export function buildTaxes(claveImpuesto: string) {
  const cfg = getAppConfigSync();
  // La clave doble manda las DOS plantillas: son cuentas distintas, dos renglones.
  const claves = claveImpuesto === 'iva16_ieps' ? ['ieps', 'iva16'] : [claveImpuesto];
  return claves
    .map(k => cfg.item_tax_templates?.[k])
    .filter(Boolean)
    .map(tmpl => ({ item_tax_template: tmpl }));
}

/** Tasa numérica por clave. Default 0 si no existe. */
export function getTasa(clave: string) {
  return IMPUESTOS_TASAS[clave as keyof typeof IMPUESTOS_TASAS] ?? 0;
}
