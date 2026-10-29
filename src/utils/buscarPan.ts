// 29-oct: buscador de pan (Hoja del día, Liquidación, Mi cuenta). Solo filtra lo que se
// PINTA: guardar/cobrar/enviar siguen con todos los renglones.

/** minúsculas y sin acentos: «piña» encuentra «PIÑA» y «pina» también */
export const normalizarBusqueda = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** ¿Algún campo (nombre, clave) trae lo buscado? `busqueda` ya normalizada; vacía = todo. */
export function coincidePan(busqueda: string, ...campos: (string | number | null | undefined)[]): boolean {
  if (!busqueda) return true;
  return campos.some(c => c != null && normalizarBusqueda(String(c)).includes(busqueda));
}
