// Borrador local de un formulario largo (envío, compra, venta B2B).
//
// Mismo principio que el conteo físico: el estado de React es volátil y cerrar
// el modal por accidente tira media captura. Aquí el formulario se serializa a
// IndexedDB mientras se teclea, y se descarta en cuanto el documento existe en
// ERPNext (a partir de ahí el borrador de verdad es el del servidor).
//
// ponytail: un renglón por formulario, sin clave por día ni por usuario. El
// borrador es de ESTE navegador. Si algún día se captura un envío en la tablet
// y se termina en la PC, esto sube al servidor, no se parcha con más lógica
// local.
import { db as dbDefault } from './db';

type Opts = { db?: any };

/**
 * Guarda el estado del formulario. `datos = null` significa "ya no hay nada
 * capturado": borra el renglón en vez de dejar un borrador vacío que luego
 * aparece como restauración fantasma.
 */
export async function guardarBorradorForm(key: string, datos: unknown, { db = dbDefault }: Opts = {}) {
  if (datos == null) return db.borradores.delete(key);
  return db.borradores.put({ key, datos, actualizado: new Date().toISOString() });
}

/** Devuelve `{ datos, actualizado }` o null si no había borrador. */
export async function cargarBorradorForm(key: string, { db = dbDefault }: Opts = {}) {
  const row = await db.borradores.get(key);
  return row?.datos == null ? null : { datos: row.datos, actualizado: row.actualizado };
}

/** Tras confirmar (o al descartar a mano), el borrador ya cumplió. */
export const borrarBorradorForm = (key: string, { db = dbDefault }: Opts = {}) =>
  db.borradores.delete(key);
