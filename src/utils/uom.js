// src/utils/uom.js
// Aliases de visualización para Unidades de Medida que vienen de ERPNext.
// NO modifica los valores enviados a la API — solo para display.

const UOM_ALIAS = {
  'L':  'Lt',
  'l':  'Lt',
};

/**
 * Devuelve el alias de display para una UoM.
 * Si no hay alias, devuelve la UoM original.
 * @param {string} uom
 * @returns {string}
 */
export function fmtUom(uom = '') {
  return UOM_ALIAS[uom] ?? uom;
}
