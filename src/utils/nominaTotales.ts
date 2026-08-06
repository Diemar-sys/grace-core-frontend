/**
 * Totales de una corrida de nómina.
 *
 * Vive fuera de la pantalla porque lo usan dos caminos: la captura (que suma en
 * vivo lo que se teclea) y la reimpresión de una corrida vieja (que suma los
 * renglones que devuelve el servidor). La misma aritmética en dos lados se
 * desincroniza sola, y aquí el desacuerdo se imprimiría en papel.
 *
 * Replica el `validate()` de `corrida_de_nomina.py`. El servidor sigue siendo la
 * fuente de verdad; esto es para pintar y para imprimir.
 */

const n = (v: unknown) => Number(v || 0);

/**
 * Renglón de captura (strings del input) o del servidor (números): a los dos les
 * sirve. Se listan los campos en vez de usar Record<string, …> porque una
 * interface no encaja en un Record sin firma de índice, y porque así un typo en
 * un nombre de concepto lo caza el compilador en lugar de sumar 0 en silencio.
 */
export interface RenglonSumable {
  sueldo?: number | string | null;
  septimo_dia?: number | string | null;
  prima_dominical?: number | string | null;
  gratificacion?: number | string | null;
  vacaciones?: number | string | null;
  prima_vacacional?: number | string | null;
  isr_mes?: number | string | null;
  isr_art174?: number | string | null;
  imss?: number | string | null;
  infonavit_cf_corresp?: number | string | null;
  ajuste_neto?: number | string | null;
  // Informativos: NO mueven el neto, pero la Lista de Raya los imprime.
  isr_antes_subsidio?: number | string | null;
  subsidio_empleo?: number | string | null;
  prestamo_infonavit_cf?: number | string | null;
}

export interface TotalesNomina {
  sueldo: number; septimo_dia: number; prima_dominical: number;
  gratificacion: number; vacaciones: number; prima_vacacional: number;
  bruto: number;
  isr_mes: number; isr_art174: number; imss: number;
  infonavit_cf_corresp: number; ajuste_neto: number; deducc: number;
  efectivo: number; neto: number; costo: number; impuestos: number;
  // Informativos: se acumulan solo para reproducir la Lista de Raya.
  isr_antes_subsidio: number; subsidio_empleo: number; prestamo_infonavit_cf: number;
}

/** Bruto/deducciones/neto de UN renglón. El efectivo es de la corrida, no entra. */
export function calcRenglon(f: RenglonSumable) {
  const bruto = n(f.sueldo) + n(f.septimo_dia) + n(f.prima_dominical) + n(f.gratificacion)
    + n(f.vacaciones) + n(f.prima_vacacional);
  const deducc = n(f.isr_mes) + n(f.isr_art174) + n(f.imss)
    + n(f.infonavit_cf_corresp) + n(f.ajuste_neto);
  return { bruto, deducc, neto: bruto - deducc, costo: bruto };
}

export function sumarTotales(filas: RenglonSumable[], efectivo: unknown = 0): TotalesNomina {
  const t: TotalesNomina = {
    sueldo: 0, septimo_dia: 0, prima_dominical: 0, gratificacion: 0, vacaciones: 0,
    prima_vacacional: 0, bruto: 0,
    isr_mes: 0, isr_art174: 0, imss: 0, infonavit_cf_corresp: 0, ajuste_neto: 0, deducc: 0,
    efectivo: 0, neto: 0, costo: 0, impuestos: 0,
    isr_antes_subsidio: 0, subsidio_empleo: 0, prestamo_infonavit_cf: 0,
  };
  for (const f of filas || []) {
    const c = calcRenglon(f);
    t.sueldo += n(f.sueldo); t.septimo_dia += n(f.septimo_dia);
    t.prima_dominical += n(f.prima_dominical); t.gratificacion += n(f.gratificacion);
    t.vacaciones += n(f.vacaciones); t.prima_vacacional += n(f.prima_vacacional);
    t.isr_mes += n(f.isr_mes); t.isr_art174 += n(f.isr_art174); t.imss += n(f.imss);
    t.infonavit_cf_corresp += n(f.infonavit_cf_corresp); t.ajuste_neto += n(f.ajuste_neto);
    t.isr_antes_subsidio += n(f.isr_antes_subsidio); t.subsidio_empleo += n(f.subsidio_empleo);
    t.prestamo_infonavit_cf += n(f.prestamo_infonavit_cf);
    t.bruto += c.bruto; t.deducc += c.deducc;
    t.neto += c.neto; t.costo += c.costo;
  }
  // El Art. 174 es ISR de pagos extraordinarios: cuenta como impuesto igual que
  // el ordinario. Ojo: esto NO es el "Total Deducciones" del recibo — ese lleva
  // además el Infonavit, que no es impuesto sino descuento del crédito de
  // vivienda. Para cuadrar contra CONTPAQi el número es `deducc`.
  t.impuestos = t.isr_mes + t.isr_art174 + t.imss + t.ajuste_neto;
  // El efectivo no sale de los renglones: se captura una vez por corrida.
  t.efectivo = n(efectivo);
  return t;
}

/** Cabecera de la corrida que acompaña a los totales en el ticket. */
export interface MetaCorrida {
  folio: string;
  fecha_pago?: string | null;
  nomina_de?: string | null;
  semana_del?: string | null;
  semana_al?: string | null;
}

/**
 * Payload del ticket térmico. Existe para que confirmar y reimprimir manden
 * exactamente lo mismo: si se arman por separado, un día el papel de la
 * reimpresión deja de cuadrar con el original y nadie sabe cuál creer.
 *
 * El neto y el costo llevan el efectivo sumado; los renglones no lo traen.
 */
export function payloadTicketNomina(
  meta: MetaCorrida, t: TotalesNomina, empleados: number,
): Record<string, unknown> {
  return {
    folio: meta.folio,
    fecha_pago: meta.fecha_pago || '',
    nomina_de: meta.nomina_de || '',
    semana_del: meta.semana_del || null,
    semana_al: meta.semana_al || null,
    total_sueldo: t.sueldo,
    total_septimo_dia: t.septimo_dia,
    total_prima_dominical: t.prima_dominical,
    total_gratificacion: t.gratificacion,
    total_vacaciones: t.vacaciones,
    total_prima_vacacional: t.prima_vacacional,
    total_declarado: t.bruto,
    total_isr: t.isr_mes,
    total_isr_art174: t.isr_art174,
    total_imss: t.imss,
    total_infonavit: t.infonavit_cf_corresp,
    total_ajuste: t.ajuste_neto,
    total_retenciones: t.deducc,
    // Informativos: no mueven un peso, pero la Lista de Raya los lista y el
    // contador los busca. Sin ellos el ticket no se puede cotejar contra CONTPAQi.
    total_prestamo_infonavit: t.prestamo_infonavit_cf,
    total_subsidio_empleo: t.subsidio_empleo,
    total_isr_antes_subsidio: t.isr_antes_subsidio,
    total_neto: t.neto + t.efectivo,
    total_efectivo: t.efectivo,
    total_costo: t.costo + t.efectivo,
    empleados,
  };
}
