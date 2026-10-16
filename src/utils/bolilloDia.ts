// src/utils/bolilloDia.ts
// Bolillo por tandas (08-oct), lógica pura de la vista «Bolillo» de la Hoja del día.
// Lo tecleado sin guardar vive aparte del servidor (borrador por fecha, como la Captura):
// aquí se mezclan las dos cosas para pintar totales y para saber qué mandar.
// Spec: gestion_panaderia/docs/superpowers/specs/2026-10-08-bolillo-tandas-design.md
import type {
  BolilloDia, CamionetaBolillo, CamionetaPorGuardar, CeldaPorGuardar, ItemBolillo, Tanda,
} from '../services/frappeHoja';
import { cantidad } from './cierreRuta';

/** Lo tecleado sin guardar de UN día: clave de casilla → texto tal cual se tecleó. */
export type TecleadoBolillo = Record<string, string>;
/** El borrador completo, por fecha (como `BorradorHoja`). */
export type BorradorBolillo = Record<string, TecleadoBolillo>;

export const claveTanda = (destino: string, tanda: number, item: string) => `t|${destino}|${tanda}|${item}`;
export const claveCamioneta = (destino: string, item: string) => `c|${destino}|${item}`;

export function salioDe(tecleado: TecleadoBolillo, destino: string, t: Tanda, item: string): number {
  const k = claveTanda(destino, t.tanda, item);
  return k in tecleado ? cantidad(tecleado[k]) : (t.celdas[item]?.salio ?? 0);
}

export function llevaCamioneta(tecleado: TecleadoBolillo, c: CamionetaBolillo, item: string): number {
  const k = claveCamioneta(c.destino, item);
  return k in tecleado ? cantidad(tecleado[k]) : (c.cantidades[item] ?? 0);
}

/** pedido y salió en su unidad (charolas o piezas) y los dos en PIEZAS (09-oct: los TOTALES van en piezas). */
export interface TotalBolillo { pedido: number; salio: number; piezas: number; pedidoPiezas: number }

const piezasDe = (item: ItemBolillo, unidades: number) => unidades * (item.unidad === 'charolas' ? item.por_charola : 1);

/** Total por pan de un destino: pedido y salió (en su unidad) y salió en piezas, que es lo
 *  que se cobra. Una pasada por las tandas (× 4 panes), O(n). */
export function totalesDestino(destino: string, tandas: Tanda[], items: ItemBolillo[], tecleado: TecleadoBolillo) {
  const tot: Record<string, TotalBolillo> = {};
  for (const it of items) {
    let pedido = 0; let salio = 0;
    for (const t of tandas) {
      pedido += t.celdas[it.item_code]?.pedido ?? 0;
      salio += salioDe(tecleado, destino, t, it.item_code);
    }
    tot[it.item_code] = { pedido, salio, piezas: piezasDe(it, salio), pedidoPiezas: piezasDe(it, pedido) };
  }
  return tot;
}

/** 16-oct: la tanda que el servidor agrega al final de cada destino para lo que se manda en
 *  la tarde (los días de mucha venta). Espejo de `bolillo.TARDE` del backend. */
export const TIPO_TARDE = 'TARDE';

/** Lo que salió en la mañana (todas las tandas menos la TARDE) y en la tarde, por pan, en
 *  piezas, con lo tecleado. La suma es el total que se cobra. Una pasada, O(n). */
export function mananaYTarde(destino: string, tandas: Tanda[], items: ItemBolillo[], tecleado: TecleadoBolillo) {
  const res: Record<string, { manana: number; tarde: number }> = {};
  for (const it of items) {
    let manana = 0; let tarde = 0;
    for (const t of tandas) {
      const s = piezasDe(it, salioDe(tecleado, destino, t, it.item_code));
      if (t.tipo === TIPO_TARDE) tarde += s; else manana += s;
    }
    res[it.item_code] = { manana, tarde };
  }
  return res;
}

/** Camionetas: el pedido es el de la BOLSA (tandas del bloque CAMIONETA) y lo que salió es
 *  la suma de lo que se lleva cada camioneta (Diemar 08-oct: totales, no por tanda). */
export function totalesCamionetas(bolsa: Tanda[], salen: CamionetaBolillo[], items: ItemBolillo[], tecleado: TecleadoBolillo) {
  const tot: Record<string, TotalBolillo> = {};
  for (const it of items) {
    const pedido = bolsa.reduce((s, t) => s + (t.celdas[it.item_code]?.pedido ?? 0), 0);
    const salio = salen.reduce((s, c) => s + llevaCamioneta(tecleado, c, it.item_code), 0);
    tot[it.item_code] = { pedido, salio, piezas: piezasDe(it, salio), pedidoPiezas: piezasDe(it, pedido) };
  }
  return tot;
}

/** Solo las casillas tecleadas que difieren de lo guardado, de destinos que todavía se
 *  capturan (ni cobrados, ni camionetas que ya salieron): lo que manda «Guardar». */
export function cambiosBolillo(dia: BolilloDia, tecleado: TecleadoBolillo) {
  const tandas: CeldaPorGuardar[] = [];
  const camionetas: CamionetaPorGuardar[] = [];
  for (const d of dia.destinos) {
    if (d.cobrado) continue;
    for (const t of d.tandas) {
      for (const it of dia.items) {
        const k = claveTanda(d.destino, t.tanda, it.item_code);
        if (!(k in tecleado)) continue;
        const salio = cantidad(tecleado[k]);
        if (salio !== (t.celdas[it.item_code]?.salio ?? 0)) {
          tandas.push({ destino: d.destino, tanda: t.tanda, item_code: it.item_code, salio });
        }
      }
    }
  }
  for (const c of dia.camionetas?.salen ?? []) {
    if (c.cerrada || c.cobrada) continue;
    for (const it of dia.items) {
      const k = claveCamioneta(c.destino, it.item_code);
      if (!(k in tecleado)) continue;
      const lleva = cantidad(tecleado[k]);
      if (lleva !== (c.cantidades[it.item_code] ?? 0)) camionetas.push({ destino: c.destino, item_code: it.item_code, cantidad: lleva });
    }
  }
  return { tandas, camionetas };
}

const llave = (d: string) => d.replace(/\s+/g, '').toUpperCase();

/** Solo el bolillo del destino elegido en el selector (Diemar 08-oct). Una sucursal o
 *  cliente: su tarjeta. Una camioneta: la bolsa y SOLO su renglón (`todas` se queda con
 *  las demás para el total contra la bolsa). Sin bolillo por tandas: null. */
export function bolilloDe(dia: BolilloDia, destino: string) {
  const d = dia.destinos.find(x => llave(x.destino) === llave(destino));
  if (d) return { destino: d, camioneta: null };
  const c = dia.camionetas?.salen.find(x => llave(x.destino) === llave(destino));
  if (c && dia.camionetas) return { destino: null, camioneta: { tandas: dia.camionetas.tandas, salen: [c], todas: dia.camionetas.salen } };
  return null;
}

/** Lo tecleado SIN las casillas de un destino: al guardar uno, lo de los demás se queda. */
export function sinDestino(tecleado: TecleadoBolillo, destino: string): TecleadoBolillo {
  return Object.fromEntries(Object.entries(tecleado).filter(([k]) => k.split('|')[1] !== destino));
}

/** 14-oct (Diemar): bolillo y telera se teclean en DOS casillas, CHAROLAS y SUELTAS, y el
 *  sistema saca el total en piezas (lo que se cobra). Nadie suma y cada casilla tiene UNA
 *  unidad. El borrador guarda el TOTAL en la clave de siempre (`k`, lo que leen totales y
 *  «Guardar») y lo tecleado de cada parte en `k|ch` / `k|pz` para pintarlo tal cual. */
export interface Partes { charolas: string; sueltas: string }

/** Lo que se ve en las dos casillas: lo tecleado, o el total partido (67 telera = 5 ch + 7). */
export function partesDe(tecleado: TecleadoBolillo, k: string, guardado: number, porCharola: number): Partes {
  if (`${k}|ch` in tecleado || `${k}|pz` in tecleado) {
    return { charolas: tecleado[`${k}|ch`] ?? '', sueltas: tecleado[`${k}|pz`] ?? '' };
  }
  const total = k in tecleado ? cantidad(tecleado[k]) : guardado;
  const charolas = Math.floor(total / porCharola);
  return { charolas: String(charolas), sueltas: String(total - charolas * porCharola) };
}

/** Teclear UNA parte: guarda lo tecleado de las dos y el total = charolas × charola + sueltas. */
export function teclearParte(
  tecleado: TecleadoBolillo, k: string, parte: keyof Partes, valor: string, guardado: number, porCharola: number,
): TecleadoBolillo {
  const p = { ...partesDe(tecleado, k, guardado, porCharola), [parte]: valor };
  const total = cantidad(p.charolas) * porCharola + cantidad(p.sueltas);
  return { ...tecleado, [k]: String(total), [`${k}|ch`]: p.charolas, [`${k}|pz`]: p.sueltas };
}
