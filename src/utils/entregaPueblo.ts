// Entrega de un pueblo (12-nov, Diemar): por día se le mandó pan, entregó una parte en efectivo y lo demás
// se fue en agua, luz, renta, sueldo… Aquí solo se suma lo tecleado para enseñarlo antes de guardar; la
// regla de verdad (y el rechazo) vive en el servidor: `caja_cobro.armar_entrega`. Misma lista, mismo tope.
export const CONCEPTOS_ENTREGA = ['AGUA', 'LUZ', 'RENTA', 'SUELDO', 'PÉRDIDA', 'OTRO'] as const;
export type ConceptoEntrega = typeof CONCEPTOS_ENTREGA[number];
export interface GastoEntrega { concepto: ConceptoEntrega; monto: number; nota?: string }
export interface TecleoEntrega { entrego: string; montos: Partial<Record<ConceptoEntrega, string>>; nota: string }

const pesos = (centavos: number) => `$${(centavos / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Texto → centavos enteros (sin polvo de coma flotante). Vacío = 0; lo que no es número = NaN. */
const aCentavos = (texto: string | undefined) => (texto == null || texto.trim() === '' ? 0 : Math.round(Number(texto) * 100));

export function resumenEntrega(debe: number, t: TecleoEntrega) {
  const debeC = Math.round(debe * 100);
  const efectivoC = aCentavos(t.entrego);
  const porConcepto = CONCEPTOS_ENTREGA.map(concepto => ({ concepto, centavos: aCentavos(t.montos[concepto]) }));
  const gastosC = porConcepto.reduce((s, g) => s + g.centavos, 0);
  const cobroC = efectivoC + gastosC;
  const gastos: GastoEntrega[] = porConcepto.filter(g => g.centavos > 0).map(g => ({
    concepto: g.concepto, monto: g.centavos / 100, ...(g.concepto === 'OTRO' ? { nota: t.nota.trim() } : {}),
  }));
  const otro = porConcepto.find(g => g.concepto === 'OTRO')!.centavos;
  const error = [efectivoC, ...porConcepto.map(g => g.centavos)].some(c => !Number.isFinite(c) || c < 0) ? 'Los montos van en positivo.'
    : cobroC === 0 ? 'Escribe lo que entregó o en qué se fue.'
    : otro > 0 && !t.nota.trim() ? 'OTRO: escribe en qué se fue.'
    // los gastos justifican la diferencia de ESE día: no pueden pasar de lo que debe
    : gastosC > debeC ? `Los gastos (${pesos(gastosC)}) pasan de lo que se debe de ese día (${pesos(debeC)}).`
    : '';
  // 12-nov: lo entregado de más se balancea con otros días que deban (lo reparte el servidor, del más viejo al más nuevo)
  const sobranteC = Math.max(cobroC - debeC, 0);
  return { efectivo: efectivoC / 100, gastosTotal: gastosC / 100, sinJustificar: Math.max(debeC - cobroC, 0) / 100,
           sobrante: sobranteC / 100, gastos, error };
}
