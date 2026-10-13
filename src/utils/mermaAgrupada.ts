// src/utils/mermaAgrupada.ts
// Liquidación del repartidor (12-oct, Diemar): los sabores que cuestan igual se capturan
// como UN renglón — «3 POLVORONES», no 3 de naranja y 0 de chocolate. Solo importa el total.
//
// El servidor guarda la merma por pan (`guardar_regreso`), así que el total del grupo se
// REPARTE aquí: llena el primer sabor hasta lo que se llevó y sigue con el siguiente. El
// reparto no mueve dinero porque el grupo exige misma categoría, mismo precio y mismo
// impuesto. Héctor sigue viendo cada sabor en la Hoja (decisión de Diemar).
import type { RenglonHoja } from '../services/frappeHoja';
import { cantidad, type Captura } from './cierreRuta';

// ponytail: lista fija; otra categoría se agrega aquí (Diemar: solo polvorón y muerto)
export const CATEGORIAS_AGRUPADAS = new Set(['PAN POLVORON', 'PAN TEMPORADA MUERTO']);

export interface GrupoMerma {
  clave: string;
  nombre: string;
  detalle: string;
  items: { item_code: string; enviado: number }[];
  enviado: number;
}

const claveDe = (r: RenglonHoja) =>
  CATEGORIAS_AGRUPADAS.has(r.categoria) ? `${r.categoria}|${r.precio}|${r.impuesto}` : r.item_code;

/** Renglones → grupos, en el orden de la hoja. O(n) con un Map. */
export function agruparRenglones(renglones: RenglonHoja[]): GrupoMerma[] {
  const grupos = new Map<string, GrupoMerma & { productos: string[] }>();
  for (const r of renglones) {
    const clave = claveDe(r);
    const g = grupos.get(clave) ?? { clave, nombre: '', detalle: '', items: [], enviado: 0, productos: [] };
    g.items.push({ item_code: r.item_code, enviado: r.enviado });
    g.productos.push(r.producto);
    g.enviado += r.enviado;
    grupos.set(clave, g);
  }
  return [...grupos.values()].map(({ productos, ...g }) => {
    const solo = g.items.length === 1;
    const categoria = g.clave.split('|')[0].replace(/^PAN /, '');
    return { ...g, nombre: solo ? productos[0] : categoria, detalle: solo ? g.items[0].item_code : productos.join(' · ') };
  });
}

/** La merma ya guardada, sumada por grupo (texto; vacío si es 0). */
export function mermaPorGrupo(grupos: GrupoMerma[], renglones: RenglonHoja[]): Record<string, string> {
  const merma = new Map(renglones.map(r => [r.item_code, r.merma || 0]));
  return Object.fromEntries(grupos.map(g => {
    const total = g.items.reduce((s, i) => s + (merma.get(i.item_code) ?? 0), 0);
    return [g.clave, total ? String(total) : ''];
  }));
}

/**
 * Lo tecleado por grupo → la captura por pan que entienden `previsualizar` y el servidor.
 * Lo que pase de lo enviado se queda en el último sabor: así `excesos` lo marca y el
 * servidor lo rechaza, en vez de perderse en silencio.
 */
export function repartirMerma(grupos: GrupoMerma[], porGrupo: Record<string, string>): Captura {
  const captura: Captura = {};
  for (const g of grupos) {
    const texto = porGrupo[g.clave] ?? '';
    if (g.items.length === 1) { captura[g.items[0].item_code] = { regresa: '', tiro: texto }; continue; }
    let resta = cantidad(texto);
    g.items.forEach((it, i) => {
      const ultimo = i === g.items.length - 1;
      const q = ultimo ? resta : Math.min(resta, it.enviado);
      resta -= q;
      captura[it.item_code] = { regresa: '', tiro: q ? String(q) : '' };
    });
  }
  return captura;
}
