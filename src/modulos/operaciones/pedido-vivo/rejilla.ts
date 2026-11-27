// PURO: arma las secciones de la rejilla (como los bloques de la pestaña PRODUCCIÓN) en una pasada O(n).
import type { PanPedido } from './frappePedidoVivo';

export interface Seccion { nombre: string; panes: PanPedido[] }

/** Agrupa por sección respetando el orden en que llegan (el `orden` del Excel ya viene del servidor). */
export function agruparPorSeccion(panes: PanPedido[]): Seccion[] {
  const porNombre = new Map<string, Seccion>();
  for (const p of panes) {
    const nombre = p.seccion || 'OTROS';
    let s = porNombre.get(nombre);
    if (!s) { s = { nombre, panes: [] }; porNombre.set(nombre, s); }
    s.panes.push(p);
  }
  return [...porNombre.values()];
}

/** Lo tecleado → piezas válidas (enteras 0–9999) o null si no se debe mandar. */
export function piezasDeTexto(texto: string): number | null {
  const t = texto.trim();
  if (t === '') return 0;
  if (!/^\d{1,4}$/.test(t)) return null;
  return Number(t);
}
