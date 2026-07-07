/**
 * AppConfig — config global ERPNext (cuentas COA, Item Tax Templates, etc.)
 *
 * Estrategia: pedir al backend custom endpoint `get_app_config`. Si falla
 * (404/500/no instalado), usa FALLBACK hardcoded. Cache module-level por sesión.
 *
 * Backend pendiente (ver project_venta_b2b.md):
 * @frappe.whitelist()
 * def get_app_config():
 *     return { 'cuentas': {...}, 'item_tax_templates': {...}, ... }
 */

export interface AppConfig {
  cuentas: Record<string, string | null>;
  item_tax_templates: Record<string, string | null>;
}

// Fallback alineado con backend `gestion_panaderia.api.config.get_app_config`.
// Si endpoint falla, estos valores corresponden a COA real (verificado 2026-05-12).
const FALLBACK: AppConfig = Object.freeze({
  cuentas: {
    receivable:       'OTRAS CUENTAS POR COBRAR - PG',
    caja:             'CAJA PRINCIPAL - PG',
    iva_trasladado:   'IVA POR TRASLADAR O COBRADO - PG',
    iva_acreditable:  'IVA ACREDITABLE O PAGADO A PROVEEDORES - PG',
    ieps:             'IEPS - PG - PG',
    ajuste:           'AJUSTE POR REDONDEO - PG',
  },
  item_tax_templates: {
    iva16: 'Mexico Tax - PG',
    ieps:  'IEPS 8% - PG',
    tasa0: null,
  },
});

let _cache: AppConfig | null = null;

/**
 * Carga config desde backend; si falla, usa FALLBACK. Idempotente (cache).
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (_cache) return _cache;
  try {
    const res = await fetch(
      '/api/method/gestion_panaderia.api.config.get_app_config',
      { credentials: 'include' }
    );
    if (res.ok) {
      const data = await res.json();
      const remote = data?.message;
      if (remote && typeof remote === 'object') {
        _cache = {
          cuentas:             { ...FALLBACK.cuentas, ...(remote.cuentas || {}) },
          item_tax_templates:  { ...FALLBACK.item_tax_templates, ...(remote.item_tax_templates || {}) },
        };
        return _cache;
      }
    }
  } catch (e) {
    console.warn('AppConfig: endpoint no disponible, usando fallback:', (e as Error)?.message);
  }
  _cache = FALLBACK;
  return _cache;
}

/**
 * Acceso síncrono. Devuelve cache o fallback. Llamar `loadAppConfig()` antes
 * para garantizar valores actualizados.
 */
export function getAppConfigSync(): AppConfig {
  return _cache || FALLBACK;
}

/** Limpia cache (logout, refresh manual). */
export function clearAppConfigCache() {
  _cache = null;
}
