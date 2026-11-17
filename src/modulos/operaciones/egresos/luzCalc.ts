// src/components/egresos/luzCalc.ts
/**
 * Recibo de CFE. No es un gasto con IVA encima del monto: tiene su propia forma.
 *
 *   Energía            1,231.21
 *   IVA 16%              196.99   <- 16% de la ENERGIA SOLA
 *   Fac. del Periodo   1,428.20
 *   DAP                   98.50   <- derecho de alumbrado publico: NO causa IVA
 *   Total              1,526.70
 *   A pagar            1,526      <- CFE no cobra centavos: se TRUNCA
 *
 * El DAP fuera de la base esta verificado contra el recibo: metiendolo, el IVA
 * daria 212.75 y el papel dice 196.99.
 *
 * Se trunca, NO se redondea: 1,526.70 redondeado da 1,527 y serian un peso de
 * mas en cada recibo. El truncado es lo que trae el codigo de barras.
 */

/** Centavos enteros. Aisla el ruido del flotante antes de cualquier decision. */
const aCentavos = (n: number): number => Math.round(n * 100);
const num = (v: unknown): number => parseFloat(String(v ?? '')) || 0;
const vacio = (v: unknown): boolean => v === '' || v == null;

export interface LuzInput {
  energia?: unknown;
  dap?: unknown;
  /** Override del IVA del recibo. Vacio = 16% de la energia. */
  iva?: unknown;
  /** Override del total a pagar. Vacio = total truncado a pesos. */
  totalPagar?: unknown;
}

export interface LuzCalc {
  energia: number;
  dap: number;
  iva: number;
  /** Energia + IVA, como lo llama el recibo. */
  facPeriodo: number;
  /** Energia + IVA + DAP: lo que dice el renglon "Total". */
  totalFactura: number;
  /** Lo que de verdad sale del banco. Es el monto del egreso. */
  totalPagar: number;
  /** totalPagar - totalFactura. Negativo casi siempre. Va como partida propia. */
  redondeo: number;
}

export function calcLuz({ energia, dap, iva, totalPagar }: LuzInput): LuzCalc {
  const e = num(energia);
  const d = num(dap);

  // IVA: 16% de la energia, a centavos. Con valor manda el recibo tal cual.
  const ivaNum = vacio(iva) ? aCentavos(e * 0.16) / 100 : num(iva);

  const facPeriodo   = (aCentavos(e) + aCentavos(ivaNum)) / 100;
  const totalFactura = (aCentavos(facPeriodo) + aCentavos(d)) / 100;

  // Truncar SOBRE centavos enteros, no sobre el flotante: Math.floor(1526.9999999998)
  // da 1526 cuando la verdad son 1527, y eso es un peso de menos en el pago.
  const pagarAuto = Math.floor(aCentavos(totalFactura) / 100);
  const pagar = vacio(totalPagar) ? pagarAuto : num(totalPagar);

  return {
    energia: e,
    dap: d,
    iva: ivaNum,
    facPeriodo,
    totalFactura,
    totalPagar: pagar,
    redondeo: (aCentavos(pagar) - aCentavos(totalFactura)) / 100,
  };
}
