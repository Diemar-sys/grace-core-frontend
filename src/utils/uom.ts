// src/utils/uom.ts
// Aliases de visualización para Unidades de Medida que vienen de ERPNext.
// NO modifica los valores enviados a la API — solo para display.

const UOM_ALIAS: Record<string, string> = {
  'L': 'Lt',
  'l': 'Lt',
};

/**
 * Devuelve el alias de display para una UoM.
 * Si no hay alias, devuelve la UoM original.
 */
export function fmtUom(uom = ''): string {
  return UOM_ALIAS[uom] ?? uom;
}
