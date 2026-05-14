import { useEffect, useState } from 'react';
import {
  loadSucursalesConfig,
  getSucursalesConfigSync,
  subscribeSucursalesConfig,
} from '../services/sucursalesConfig';

/**
 * Hook React que reacciona a cambios del cache de sucursales config.
 * Útil cuando el componente se monta antes que termine la carga async
 * (refresh página sin pasar por login).
 *
 * @returns {{ sucursales_internas: string[], sucursales_destino: Array<{label, warehouse}> }}
 */
export default function useSucursales() {
  const [cfg, setCfg] = useState(getSucursalesConfigSync());

  useEffect(() => {
    let cancel = false;
    const unsub = subscribeSucursalesConfig((next) => {
      if (!cancel) setCfg(next || getSucursalesConfigSync());
    });
    // Disparar carga + sync state con resultado (cubre caso donde cache ya
    // fue poblada antes que el hook se suscribiera).
    loadSucursalesConfig()
      .then((fresh) => { if (!cancel) setCfg(fresh || getSucursalesConfigSync()); })
      .catch(() => {});
    return () => { cancel = true; unsub(); };
  }, []);

  return cfg;
}
