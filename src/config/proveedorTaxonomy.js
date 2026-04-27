/**
 * Taxonomía de proveedores — espeja la jerarquía de Supplier Groups en ERPNext.
 * Los nombres deben coincidir EXACTO con los creados en ERPNext.
 *
 * All Supplier Groups
 * ├── Costo
 * │   ├── Materia Prima
 * │   ├── Empaques y Desechables
 * │   └── Producto Compra-Venta
 * └── Gasto
 *     ├── Servicios de Producción
 *     ├── Servicios Administrativos
 *     ├── Mantenimiento
 *     └── Empleados
 */

export const TAXONOMY = {
  COSTO: [
    'MATERIA PRIMA',
    'EMPAQUES Y DESECHABLES',
    'PRODUCTO COMPRA-VENTA (ABARROTES)',
  ],
  GASTO: [
    'SERVICIOS DE PRODUCCION',
    'SERVICIOS ADMINISTRATIVOS',
    'MANTENIMIENTO',
    'EMPLEADOS',
  ],
};

/** Derivar tipo (COSTO/GASTO) a partir del supplier_group almacenado */
export function getTipoDeGrupo(grupo) {
  if (!grupo) return '';
  for (const [tipo, subtipos] of Object.entries(TAXONOMY)) {
    if (subtipos.includes(grupo)) return tipo;
  }
  return '';
}

export const GRUPOS_RAIZ = ['All Supplier Groups', 'COSTO', 'GASTO'];
