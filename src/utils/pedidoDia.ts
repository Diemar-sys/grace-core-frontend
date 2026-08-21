/**
 * Junta las pestañas marcadas en una sola vista: el pedido del día completo.
 *
 * Cada pestaña trae una parte del día (PRODUCCION las sucursales, CAMIONETAS los
 * repartidores...). Para saber cuántas charolas de CHINOS se hornean hay que ver
 * el total, no una pestaña a la vez.
 */
import type { HojaPedido } from '../services/frappePedido';
import { charolas } from './charolas';

export function hojaDelDia(todas: HojaPedido[], marcadas: string[]): HojaPedido {
  const activas = todas.filter((h) => marcadas.includes(h.pestana));
  const porClave = new Map<string, HojaPedido['renglones'][number]>();

  for (const h of activas) {
    for (const r of h.renglones) {
      const previo = porClave.get(r.clave);
      if (!previo) {
        porClave.set(r.clave, { ...r, piezas: { ...r.piezas } });
        continue;
      }
      // se suma, no se pisa: si dos pestañas mandan al mismo destino el importador
      // lo rechaza, pero la vista no debe esconder que están las dos
      for (const [destino, piezas] of Object.entries(r.piezas)) {
        previo.piezas[destino] = (previo.piezas[destino] ?? 0) + piezas;
      }
    }
  }

  // el texto vino calculado por pestaña; aquí las piezas ya son de varias, así
  // que hay que rehacerlo o el día completo mostraría las charolas de una sola
  const renglones = [...porClave.values()].map((r) => ({
    ...r,
    charolas_texto: charolas(
      Object.values(r.piezas).reduce((a, b) => a + b, 0), r.piezas_por_charola),
  }));
  return {
    pestana: 'todo el día',
    renglones,
    problemas: activas.flatMap((h) => h.problemas),
    destinos: [...new Set(activas.flatMap((h) => h.destinos))].sort(),
    total_piezas: renglones.reduce(
      (a, r) => a + Object.values(r.piezas).reduce((x, y) => x + y, 0), 0),
    es_resumen: false,
    duplica_a: [],
    sugerida: false,
  };
}
