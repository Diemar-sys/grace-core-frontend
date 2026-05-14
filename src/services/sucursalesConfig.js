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

const FALLBACK = Object.freeze({
  sucursales_internas: ['PUERTA REAL'],
  sucursales_destino: [
    { label: 'PUERTA REAL', warehouse: 'TIENDA - PUERTA - PG' },
  ],
});

let _cache = null;
const _listeners = new Set();

/**
 * Suscribirse a cambios de cache. Útil para hooks React que necesitan
 * re-renderizar cuando llega la config remota.
 * @returns {() => void} unsubscribe fn
 */
export function subscribeSucursalesConfig(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _notify() {
  _listeners.forEach(fn => { try { fn(_cache); } catch (e) { console.error(e); } });
}

/**
 * Carga config desde backend; si falla, usa FALLBACK. Idempotente.
 * @returns {Promise<{sucursales_internas: string[], sucursales_destino: Array<{label, warehouse}>}>}
 */
export async function loadSucursalesConfig() {
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
    console.warn('sucursalesConfig: endpoint no disponible, usando fallback:', e?.message);
  }
  _cache = FALLBACK;
  _notify();
  return _cache;
}

/** Acceso síncrono. Devuelve cache o fallback. */
export function getSucursalesConfigSync() {
  return _cache || FALLBACK;
}

/** Limpia cache (logout, refresh manual). */
export function clearSucursalesConfigCache() {
  _cache = null;
  _notify();
}
