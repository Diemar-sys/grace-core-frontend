// src/utils/print/egresoDesglose.ts
/**
 * Agrupa las partidas de un egreso por tasa de impuesto, para el ticket.
 *
 * El ticket viejo pintaba UN solo subtotal y lo etiquetaba con el impuesto_tipo
 * del documento. Con un egreso de tasa mixta eso miente: el recibo de CFE lleva
 * energia al 16% y DAP exento, y salia "SUBTOTAL IVA 16% $1,329.01" — como si
 * los 196.99 de IVA fueran el 16% de esa base, cuando serian 212.64.
 *
 * El campo `impuesto` de la partida guarda la ETIQUETA ('IVA 16%', 'Tasa 0'),
 * que es como la escriben todos los egresos. Se agrupa por eso, sin traducir.
 */
export interface PartidaTicket {
  concepto?: string;
  importe?: number | string;
  precio?: number | string;
  cantidad?: number | string;
  impuesto?: string;
}

export interface GrupoTasa {
  label: string;
  subtotal: number;
}

const num = (v: unknown): number => parseFloat(String(v ?? '')) || 0;

/** Importe de la partida: el guardado, o cantidad x precio si no viene. */
export function importePartida(p: PartidaTicket): number {
  if (p.importe !== undefined && p.importe !== null && p.importe !== '') return num(p.importe);
  return num(p.cantidad) * num(p.precio);
}

/**
 * Subtotales por tasa, en el orden en que aparecen las partidas — que es el
 * orden del papel que tiene enfrente quien lo lee.
 */
export function agruparPorTasa(partidas: PartidaTicket[] | null | undefined): GrupoTasa[] {
  if (!partidas?.length) return [];
  // Map para no recorrer la lista una vez por etiqueta: O(n) sobre las partidas.
  const orden: string[] = [];
  const suma = new Map<string, number>();
  for (const p of partidas) {
    const label = (p.impuesto || '').trim() || 'Tasa 0';
    if (!suma.has(label)) { suma.set(label, 0); orden.push(label); }
    suma.set(label, Math.round((suma.get(label)! + importePartida(p)) * 100) / 100);
  }
  return orden.map(label => ({ label, subtotal: suma.get(label)! }));
}

/** Suma de todas las partidas. Es la base antes de impuestos. */
export function subtotalPartidas(partidas: PartidaTicket[] | null | undefined): number {
  if (!partidas?.length) return 0;
  return Math.round(partidas.reduce((a, p) => a + importePartida(p), 0) * 100) / 100;
}

/**
 * Diferencia entre el total guardado y lo que suman sus renglones.
 *
 * NO se guarda en ningun campo: se deriva de lo que ya esta en la base, asi que
 * funciona igual al crear que al reimprimir meses despues. Si el total no es la
 * suma de lo escrito arriba, el ticket tiene que decir por que — un total que no
 * cuadra con sus renglones es un fantasma en pantalla.
 */
export function ajusteDerivado(monto: unknown, subtotal: number, impuesto: unknown): number {
  const t = parseFloat(String(monto ?? '')) || 0;
  const i = parseFloat(String(impuesto ?? '')) || 0;
  const r = Math.round((t - subtotal - i) * 100) / 100;
  // `+ 0` normaliza el CERO NEGATIVO. Math.round(-5.55e-15) devuelve -0, y -0
  // se cuela por cualquier comparacion numerica pero se IMPRIME como "-0.00".
  // Un ticket que dice "AJUSTE $-0.00" es un ajuste que no existe.
  return r + 0;
}
