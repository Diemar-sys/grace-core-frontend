// Roles de la app y sus permisos
export const ROLES = {
  admin: {
    rutas: ['/panel', '/catalogo', '/inventario', '/compras', '/proveedores', '/pos', '/produccion', '/consultas/pos'],
    inicio: '/panel',
    modulosPanel: ['catalogo', 'inventario', 'compras', 'proveedores', 'pos', 'produccion'],
  },
  vendedor: {
    rutas: ['/panel', '/pos', '/catalogo', '/inventario', '/compras', '/proveedores', '/produccion', '/consultas/pos'],
    inicio: '/panel',
    modulosPanel: ['pos'],
  },
};

// Roles que elevan a admin (tienen precedencia sobre Sales User)
const FRAPPE_ROLES_ADMIN = new Set([
  'System Manager',
  'Administrator',
  'Administrador',
  'Account Manager',
  'Sales Manager',
]);

export function resolveRole(frappeRoles = []) {
  if (frappeRoles.some(r => FRAPPE_ROLES_ADMIN.has(r))) return 'admin';
  if (frappeRoles.includes('Sales User')) return 'vendedor';
  return 'admin';
}

export function getRoleConfig(role) {
  return ROLES[role] || ROLES.admin;
}
