// Entrega de un pueblo (13-nov, Diemar; el modelo del 12-nov estaba mal). Por día se le mandó PAN y
// regresó EFECTIVO; de ese efectivo pagó agua, luz, sueldo… y entregó el resto:
//     DIFERENCIA = EFECTIVO − PAN      (los gastos NO la mueven; se queda en su día)
//     ENTREGADO  = EFECTIVO − GASTOS
// 17-nov (Diemar): los gastos son PURO INFORME: pueden pasar del efectivo y puede haber gastos sin
// efectivo; ENTREGADO puede salir negativo. Aquí solo se suma lo tecleado para enseñarlo antes de
// guardar; la regla de verdad (y el rechazo) vive en el servidor: `caja_cobro.armar_entrega`.
// 17-nov: PÉRDIDA se llama MERMA (pan que ya no se rescata); los gastos guardados antes dicen PÉRDIDA.
export const CONCEPTOS_ENTREGA = ['AGUA', 'LUZ', 'RENTA', 'SUELDO', 'MERMA', 'OTRO'] as const;
const CONCEPTO_VIEJO: Record<string, string> = { 'PÉRDIDA': 'MERMA' };
export type ConceptoEntrega = typeof CONCEPTOS_ENTREGA[number];
export interface GastoEntrega { concepto: ConceptoEntrega; monto: number; nota?: string }
export interface TecleoEntrega { efectivo: string; montos: Partial<Record<ConceptoEntrega, string>>; nota: string }

const pesos = (centavos: number) => `$${(centavos / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Texto → centavos enteros (sin polvo de coma flotante). Vacío = 0; lo que no es número = NaN. */
const aCentavos = (texto: string | undefined) => (texto == null || texto.trim() === '' ? 0 : Math.round(Number(texto) * 100));

/** La diferencia con su signo a la vista: +$200.00 (regresó de más), −$1,400.00 (regresó de menos), $0.00. */
export const conSigno = (monto: number) => {
  const c = Math.round(monto * 100);
  return c > 0 ? `+${pesos(c)}` : c < 0 ? `−${pesos(-c)}` : pesos(0);
};
/** Color de la diferencia, como TEXTO (sin píldora; `.dif` en global.css): en 0 verde, de más azul, de menos rojo. */
export const claseDiferencia = (monto: number) => {
  const c = Math.round(monto * 100);
  return c === 0 ? 'dif dif--cero' : c > 0 ? 'dif dif--mas' : 'dif dif--menos';
};

/** `debe`: el pan de ese día que falta (todo el pan, si es la primera entrega del día). */
export function resumenEntrega(debe: number, t: TecleoEntrega) {
  const debeC = Math.round(debe * 100);
  const efectivoC = aCentavos(t.efectivo);
  const porConcepto = CONCEPTOS_ENTREGA.map(concepto => ({ concepto, centavos: aCentavos(t.montos[concepto]) }));
  const gastosC = porConcepto.reduce((s, g) => s + g.centavos, 0);
  const gastos: GastoEntrega[] = porConcepto.filter(g => g.centavos > 0).map(g => ({
    concepto: g.concepto, monto: g.centavos / 100, ...(g.concepto === 'OTRO' ? { nota: t.nota.trim() } : {}),
  }));
  const otro = porConcepto.find(g => g.concepto === 'OTRO')!.centavos;
  const error = [efectivoC, ...porConcepto.map(g => g.centavos)].some(c => !Number.isFinite(c) || c < 0) ? 'Los montos van en positivo.'
    : efectivoC === 0 && gastosC === 0 ? 'Escribe el efectivo que regresó o un gasto.'
    : otro > 0 && !t.nota.trim() ? 'OTRO: escribe en qué se fue.'
    : '';
  return { efectivo: efectivoC / 100, gastosTotal: gastosC / 100, diferencia: (efectivoC - debeC) / 100,
           entregado: (efectivoC - gastosC) / 100, gastos, error };
}

/** Gastos de un día del Estado de cuenta → solo la RAZÓN, sin montos (17-nov, Diemar: los montos van en
 *  Reportes). `concepto` del egreso de entrega = «SUELDO · MILA · nota»; OTRO enseña su nota. Un egreso
 *  capturado a mano (sin esa forma) enseña su subcategoría o su concepto. Sin repetir. */
export function razonesGasto(egresos: { concepto?: string | null; subcategoria?: string | null }[] = []): string[] {
  const razones = egresos.map(e => {
    const [crudo, , nota] = (e.concepto ?? '').split(' · ');
    const primero = CONCEPTO_VIEJO[crudo] ?? crudo;
    if (primero === 'OTRO' && nota) return nota;
    if ((CONCEPTOS_ENTREGA as readonly string[]).includes(primero)) return primero;
    return (e.subcategoria && e.subcategoria !== 'OTROS GASTOS' ? e.subcategoria : e.concepto) || 'GASTO';
  });
  return [...new Set(razones)];
}
