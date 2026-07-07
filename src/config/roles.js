// Niveles de la app (deben coincidir con permisos.NIVELES del backend).
// Cada nivel define qué MÓDULOS ve (tiles/rutas) y si ve Reportes.
// El gating de módulos es frontend; los roles Frappe dan acceso API grueso.

const ROUTE = {
  catalogo: '/catalogo', inventario: '/inventario', compras: '/compras',
  venta_b2b: '/venta-b2b', envio_sucursal: '/envio-sucursal', proveedores: '/proveedores',
  pos: '/pos', produccion: '/produccion', egresos: '/egresos', nomina: '/nomina',
};

const RUTAS_REPORTES = ['/reportes/ventas-categoria', '/reportes/compras', '/reportes/gastos', '/reportes/cuentas-por-pagar'];

// Construye la lista de rutas permitidas a partir de los módulos del nivel.
function rutasDe(modulos, { reportes = false, cuentas = false } = {}) {
  return [
    '/panel',
    ...modulos.map(k => ROUTE[k]),
    ...(modulos.includes('pos') ? ['/consultas/pos'] : []),
    ...(modulos.includes('inventario') ? ['/consultas/kardex'] : []),
    ...(reportes ? RUTAS_REPORTES : []),
    ...(cuentas ? ['/cuentas'] : []),
  ];
}

const MOD_ALMACEN     = ['catalogo', 'inventario', 'compras', 'proveedores', 'egresos'];
const MOD_OPERACIONES = ['catalogo', 'inventario', 'compras', 'venta_b2b', 'envio_sucursal', 'proveedores', 'egresos'];
const MOD_GERENTE     = ['catalogo', 'inventario', 'compras', 'venta_b2b', 'envio_sucursal', 'proveedores', 'pos', 'produccion', 'egresos', 'nomina'];

export const ROLES = {
  Vendedor: {
    modulosPanel: ['pos'],
    reportes: false,
    rutas: rutasDe(['pos']),
    inicio: '/panel',
  },
  'Almacén': {
    modulosPanel: MOD_ALMACEN,
    reportes: false,
    rutas: rutasDe(MOD_ALMACEN),
    inicio: '/panel',
  },
  Operaciones: {
    modulosPanel: MOD_OPERACIONES,
    reportes: false,
    rutas: rutasDe(MOD_OPERACIONES),
    inicio: '/panel',
  },
  Gerente: {
    modulosPanel: MOD_GERENTE,
    reportes: true,
    // /cuentas en rutas para que el dueño (Gerente + System Manager) navegue ahí;
    // el resto de Gerentes verá AccesoRestringido (lo corta el backend).
    rutas: rutasDe(MOD_GERENTE, { reportes: true, cuentas: true }),
    inicio: '/panel',
  },
};

export const NIVELES_VALIDOS = Object.keys(ROLES);

// Fail-closed: nivel desconocido → Vendedor (mínimo privilegio).
export function getRoleConfig(role) {
  return ROLES[role] || ROLES.Vendedor;
}
