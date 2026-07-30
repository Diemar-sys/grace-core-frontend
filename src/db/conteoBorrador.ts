// Borrador local del conteo físico.
//
// El conteo se pierde si cierras el modal: vive en el estado de React y nada
// más. Ya pasó dos veces — en junio quedaron 115 productos sin contar y hoy se
// cerró el modal por accidente a media jornada.
//
// ponytail: el borrador es de ESTE navegador (IndexedDB). Para un conteo que
// hace una persona alcanza; si algún día cuentan dos en paralelo o se cambia de
// tablet a media jornada, esto sube al servidor (doctype propio o un draft en
// el backend), no se parcha con más lógica local.
import { db as dbDefault } from './db';

export const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Un borrador por almacén y día: el conteo de mañana no pisa el de hoy. */
export const claveBorrador = (warehouse: string, fecha: string = hoyISO()) =>
  `${fecha}|${warehouse}`;

type Opts = { db?: any; fecha?: string };

/** Guarda solo lo capturado. Sin nada capturado, borra el renglón (no deja basura). */
export async function guardarBorrador(
  warehouse: string,
  valores: Record<string, string>,
  { db = dbDefault, fecha = hoyISO() }: Opts = {},
) {
  const key = claveBorrador(warehouse, fecha);
  const capturados = Object.fromEntries(
    Object.entries(valores || {}).filter(([, v]) => v !== '' && v != null),
  );
  if (!Object.keys(capturados).length) return db.conteo.delete(key);
  return db.conteo.put({
    key, warehouse,
    valores: capturados,
    actualizado: new Date().toISOString(),
  });
}

/** Devuelve lo capturado hoy en ese almacén, o null si no hay borrador. */
export async function cargarBorrador(
  warehouse: string,
  { db = dbDefault, fecha = hoyISO() }: Opts = {},
): Promise<Record<string, string> | null> {
  const row = await db.conteo.get(claveBorrador(warehouse, fecha));
  return row?.valores ?? null;
}

/** Tras aplicar el ajuste, el borrador ya cumplió. */
export const borrarBorrador = (
  warehouse: string,
  { db = dbDefault, fecha = hoyISO() }: Opts = {},
) => db.conteo.delete(claveBorrador(warehouse, fecha));
