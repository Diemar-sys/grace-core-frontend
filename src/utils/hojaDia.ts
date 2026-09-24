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

/**
 * Acomodo de la hoja en 4 columnas, dictado por Diemar el 23-sep (como el Excel).
 * Nombres = el Item Group del catálogo. Es acomodo de pantalla, no regla de negocio.
 */
export const COLUMNAS_HOJA: string[][] = [
  ['PAN MANTECA', 'PAN POLVORON', 'PAN DONAS Y FRITAS', 'PAN DANES', 'PAN CONCHA'],
  ['PAN FEITE', 'PAN OTROS', 'PAN SURTIDO', 'PIZZERIA', 'PAN RELLENO'],
  ['GALLETAS', 'GELATINAS Y FLANES', 'POSTRES', 'PAN POSTRE', 'PAN TEMPORADA ROSCA DE REYES'],
  ['PASTELES', 'PAN BLANCO', 'PAN TEMPORADA MUERTO'],
];

/** Lo que la camioneta casi nunca lleva (Diemar 23-sep). */
export const FUERA_DE_CAMIONETA = new Set(['PIZZERIA']);

const seMovio = (b: Pick<Bloque, 'renglones'>) => b.renglones.some(r => r.pedido > 0 || r.enviado > 0);

/**
 * Reparte los bloques en las columnas de COLUMNAS_HOJA. O(n) con un Map. Una
 * categoría que no está en el acomodo (nueva en el catálogo) va al final de la
 * última columna: nunca se esconde, o se cobraría en 0 sin que nadie la vea.
 * En camioneta se quita FUERA_DE_CAMIONETA, salvo que ese día sí se haya pedido
 * o enviado algo de ahí: esconderlo lo cobraría en 0.
 */
export function columnasDeHoja<T extends Pick<Bloque, 'categoria' | 'renglones'>>(bloques: T[], camioneta = false): T[][] {
  const visibles = camioneta ? bloques.filter(b => !FUERA_DE_CAMIONETA.has(b.categoria) || seMovio(b)) : bloques;
  const porCategoria = new Map(visibles.map(b => [b.categoria, b]));
  const columnas = COLUMNAS_HOJA.map(cats => cats.flatMap(c => {
    const b = porCategoria.get(c);
    if (!b) return [];
    porCategoria.delete(c);
    return [b];
  }));
  columnas[columnas.length - 1].push(...porCategoria.values());
  return columnas;
}

const enviadoDe = (r: RenglonHoja, captura: Record<string, string>) =>
  r.item_code in captura ? cantidad(captura[r.item_code]) : r.enviado;

export function totalCapturado(renglones: RenglonHoja[], captura: Record<string, string>): number {
  return centavos(renglones.reduce((s, r) => s + enviadoDe(r, captura) * r.precio, 0));
}

/** Lo tecleado en MERMA que difiere de lo guardado (camioneta ya liquidada, 23-sep). */
export function cambiosMerma(renglones: RenglonHoja[], captura: Record<string, string>) {
  return renglones
    .filter(r => r.item_code in captura && cantidad(captura[r.item_code]) !== r.merma)
    .map(r => ({ item_code: r.item_code, merma: cantidad(captura[r.item_code]) }));
}

export function cambiosEnviado(renglones: RenglonHoja[], captura: Record<string, string>) {
  return renglones
    .filter(r => r.item_code in captura && cantidad(captura[r.item_code]) !== r.enviado)
    .map(r => ({ item_code: r.item_code, enviado: cantidad(captura[r.item_code]) }));
}

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * La semana (lunes a domingo) que contiene `iso`, más `mover` semanas. Fechas locales:
 * `toISOString()` es UTC y en México adelanta el día después de las 18:00 (ver hoyISO).
 */
export function semanaDe(iso: string, mover = 0): { desde: string; hasta: string } {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(a, m - 1, d + 7 * mover);
  const lunes = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - ((dia.getDay() + 6) % 7));
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  return { desde: isoLocal(lunes), hasta: isoLocal(domingo) };
}
