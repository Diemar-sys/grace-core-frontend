/**
 * sucursalesConfig — config dinámica de sucursales internas/extendidas.
 *
 * Reemplaza la lista hardcoded en clientesB2B.js. Backend canónico
 * vía custom fields Warehouse.custom_es_sucursal_extendida +
 * Customer.custom_es_sucursal_interna.
 *
 * Patrón espejo `appConfig.js`: pre-carga al login, cache module-level,
 * getters sync para consumidores no-async (config files, helpers).
 */

// Modelo 2026-05-18: PUERTA REAL es Customer B2B normal (se le vende
// pan + abarrotes vía Sales Invoice). Solo materia prima va por
// transferencia. Por eso ya NO es sucursal interna.
export interface SucursalDestino { label: string; warehouse: string; }
export interface SucursalesConfig {
  sucursales_internas: string[];
  sucursales_destino: SucursalDestino[];
}

// ponytail: fallback vacío a propósito. Un destino hardcodeado se pudre al
// primer rename de almacén (pasó con 'MP PUERTA - PG' → 'TIENDA - PANQUELERIA - PG')
// y manda stock al almacén equivocado en silencio. Sin endpoint, mejor que el
// select salga vacío y truene visible.
const FALLBACK: SucursalesConfig = Object.freeze({
  sucursales_internas: [] as string[],
  sucursales_destino: [] as SucursalDestino[],
});

let _cache: SucursalesConfig | null = null;
const _listeners = new Set<(c: SucursalesConfig | null) => void>();

/**
 * Suscribirse a cambios de cache. Útil para hooks React que necesitan
 * re-renderizar cuando llega la config remota.
 * @returns {() => void} unsubscribe fn
 */
export function subscribeSucursalesConfig(fn: (c: SucursalesConfig | null) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

function _notify() {
  _listeners.forEach(fn => { try { fn(_cache); } catch (e) { console.error(e); } });
}

/**
 * Carga config desde backend; si falla, usa FALLBACK. Idempotente.
 */
export async function loadSucursalesConfig(): Promise<SucursalesConfig> {
  if (_cache) return _cache;
  try {
    const res = await fetch(
      '/api/method/gestion_panaderia.api.config.get_sucursales_config',
      { credentials: 'include' }
    );
    if (res.ok) {
      const data = await res.json();
      const remote = data?.message;
      if (remote && typeof remote === 'object') {
        _cache = {
          sucursales_internas: Array.isArray(remote.sucursales_internas)
            ? remote.sucursales_internas
            : FALLBACK.sucursales_internas,
          sucursales_destino: Array.isArray(remote.sucursales_destino)
            ? remote.sucursales_destino
            : FALLBACK.sucursales_destino,
        };
        _notify();
        return _cache;
      }
    }
  } catch (e) {
    console.warn('sucursalesConfig: endpoint no disponible, usando fallback:', (e as Error)?.message);
  }
  _cache = FALLBACK;
  _notify();
  return _cache;
}

/** Acceso síncrono. Devuelve cache o fallback. */
export function getSucursalesConfigSync(): SucursalesConfig {
  return _cache || FALLBACK;
}

/** Limpia cache (logout, refresh manual). */
export function clearSucursalesConfigCache() {
  _cache = null;
  _notify();
}
