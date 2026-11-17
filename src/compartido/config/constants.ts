// Empresa y almacenes — leer de tenant.js para soporte multi-cliente.
// No hardcodear nombres aquí; usar las variables de entorno en .env.
import { TENANT } from './tenant';

export const COMPANY          = TENANT.erpCompany;
export const BODEGA_CENTRAL   = TENANT.bodegaCentral;
export const DEFAULT_CUSTOMER = TENANT.defaultCustomer;

// Sucursales del sistema
export const SUCURSALES = TENANT.sucursales;

// Paginación
export const PAGE_SIZE = 20;

/**
 * Opciones del filtro por tipo de item (`custom_tipo_item`).
 *
 * "Todos" es el default a propósito: además de materia prima y pan existe
 * INSUMO GENERAL (bolsas, papel, limpieza), que no cae en ninguna de las dos y
 * se movería a ciegas si el filtro arrancara en MP.
 *
 * Vive aquí y no dentro de una pantalla porque lo usan seis: envío a sucursal,
 * conteo físico, y los registros de entrada, salida, merma y regalo. Dos listas
 * separadas terminan discrepando.
 */
export const TIPOS_ITEM = [
  { value: '', label: 'Todos' },
  { value: 'MATERIA PRIMA', label: 'Materia Prima' },
  { value: 'PRODUCTO TERMINADO', label: 'Pan' },
] as const;
