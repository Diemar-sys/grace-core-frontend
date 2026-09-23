// Lógica PURA de la Hoja del día. Lo tecleado son cadenas (lección del 04-sep):
// se convierten aquí, no en el input.
import type { RenglonHoja } from '../services/frappeHoja';
import { cantidad } from './cierreRuta';

export { cantidad };

const centavos = (n: number) => Math.round(Number((n * 100).toPrecision(12))) / 100;

export interface Bloque { categoria: string; renglones: RenglonHoja[]; subtotal: number }

/** O(n): el servidor ya ordena por departamento → categoría; aquí solo se corta. */
export function bloquesDeHoja(renglones: RenglonHoja[]): Bloque[] {
  const bloques: Bloque[] = [];
  for (const r of renglones) {
    let b = bloques[bloques.length - 1];
    if (!b || b.categoria !== r.categoria) bloques.push(b = { categoria: r.categoria, renglones: [], subtotal: 0 });
    b.renglones.push(r);
    b.subtotal = centavos(b.subtotal + r.importe);
  }
  return bloques;
}

const enviadoDe = (r: RenglonHoja, captura: Record<string, string>) =>
  r.item_code in captura ? cantidad(captura[r.item_code]) : r.enviado;

export function totalCapturado(renglones: RenglonHoja[], captura: Record<string, string>): number {
  return centavos(renglones.reduce((s, r) => s + enviadoDe(r, captura) * r.precio, 0));
}

export function cambiosEnviado(renglones: RenglonHoja[], captura: Record<string, string>) {
  return renglones
    .filter(r => r.item_code in captura && cantidad(captura[r.item_code]) !== r.enviado)
    .map(r => ({ item_code: r.item_code, enviado: cantidad(captura[r.item_code]) }));
}
