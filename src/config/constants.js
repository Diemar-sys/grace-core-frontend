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
