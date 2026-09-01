// src/components/egresos/simpleCalc.ts
import { IMPUESTOS_MAP } from '../../config/impuestos';

/**
 * Gasto simple: un monto y un solo impuesto encima.
 *
 * Vivia DUPLICADO — SubcatForm lo calculaba para pintar y Egresos.jsx lo volvia
 * a calcular para guardar. Dos cuentas del mismo numero siempre terminan
 * discrepando; aqui hay una sola.
 *
 * Los dos overrides existen porque el calculo es una suposicion y el papel que
 * tiene enfrente quien captura es la verdad. Un recibo con el impuesto redondeado
 * distinto, o un total que no sale de multiplicar, se teclea tal cual.
 */
const num = (v: unknown): number => parseFloat(String(v ?? '')) || 0;
const vacio = (v: unknown): boolean => v === '' || v == null;
const aCentavos = (n: number): number => Math.round(n * 100);

export interface SimpleInput {
  monto?: unknown;
  impuestoKey?: string;
  /** Override del impuesto. Vacio = la tasa sobre el monto. */
  impuestoManual?: unknown;
  /** Override del total. Vacio = monto + impuesto. */
  totalManual?: unknown;
}

export interface SimpleCalc {
  base: number;
  impuesto: number;
  total: number;
}

export function calcSimple({ monto, impuestoKey, impuestoManual, totalManual }: SimpleInput): SimpleCalc {
  const base = num(monto);
  const entry = IMPUESTOS_MAP[impuestoKey || 'tasa0'] || IMPUESTOS_MAP['tasa0'];
  // A centavos enteros: base * rate arrastra ruido de flotante y ese ruido
  // termina en el monto que se guarda.
  const impuesto = vacio(impuestoManual)
    ? aCentavos(base * entry.rate) / 100
    : num(impuestoManual);
  const total = vacio(totalManual)
    ? (aCentavos(base) + aCentavos(impuesto)) / 100
    : num(totalManual);
  return { base, impuesto, total };
}
