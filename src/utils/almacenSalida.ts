// src/utils/almacenSalida.ts
/**
 * De qué almacén sale un renglón de Venta B2B. Espejo de
 * `sales_invoice.almacen_de_salida` + `constants.almacen_produccion_de` del
 * backend: dos lenguajes, dos copias, dos tests (como `charolas.ts`).
 *
 * El pan NO vive en Bodega Central. `registrar_entrada_pan` lo mete al almacén de
 * su departamento («todo se hornea en matriz y sale de cada departamento»,
 * Diemar 21-sep), así que se vende desde ahí. La excepción por item
 * (`custom_almacen_produccion`) gana, igual que en la entrada. Lo demás
 * (abarrote, materia prima) sale de Bodega Central.
 *
 * El servidor fija el almacén de todos modos; aquí solo sirve para consultar el
 * stock correcto y no decirle «no hay» a un pan que sí hay.
 */
import { BODEGA_CENTRAL } from '../config/constants';

export interface ItemAlmacen {
  custom_tipo_item?: string | null;
  custom_departamento?: string | null;
  custom_almacen_produccion?: string | null;
}

export const esPan = (item?: ItemAlmacen | null) =>
  (item?.custom_tipo_item || '').trim().toUpperCase() === 'PRODUCTO TERMINADO';

export function almacenProduccionDe(departamento?: string | null): string | null {
  const dep = (departamento || '').trim().toUpperCase();
  return dep ? `ALMACEN - ${dep} - PG` : null;
}

/** `null` = pan sin departamento: no se sabe de dónde sale (el servidor lo rechaza). */
export function almacenDeSalida(item?: ItemAlmacen | null, bodega: string = BODEGA_CENTRAL): string | null {
  if (!esPan(item)) return bodega;
  return item?.custom_almacen_produccion || almacenProduccionDe(item?.custom_departamento);
}
