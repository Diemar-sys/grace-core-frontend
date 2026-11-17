import { useState, useEffect, useCallback, useRef } from 'react';
import { bundleDeHtml, bundleCargado, hayVersionNueva } from '../utils/version';

/**
 * Avisa cuando hay un deploy nuevo y esta pestaña sigue con el código viejo.
 *
 * Cuándo pregunta, y por qué así:
 *   - Al volver a la pestaña (`visibilitychange`). Éste es el momento que
 *     importa: el sistema se queda abierto todo el día y el problema aparece
 *     justo cuando alguien regresa a él. Mientras está en segundo plano no
 *     pregunta nada.
 *   - Cada 15 min, para la pestaña que se queda visible en la caja sin que nadie
 *     la cambie.
 *
 * No recarga sola A PROPÓSITO. Recargar en medio de una venta se lleva el
 * carrito; el aviso lo acepta quien está usando la pantalla, cuando puede.
 */

const CADA = 15 * 60 * 1000;   // ronda de fondo
const MINIMO = 60 * 1000;      // no repreguntar más seguido que esto

export function useVersionNueva(): boolean {
  const [hayNueva, setHayNueva] = useState(false);
  // El bundle propio se lee UNA vez: es el de esta pestaña y no cambia sin recarga.
  const cargado = useRef<string | null>(null);
  const ultima = useRef(0);

  if (cargado.current === null) cargado.current = bundleCargado(document);

  const revisar = useCallback(async () => {
    // En desarrollo no hay bundle con hash: no hay nada contra qué comparar.
    if (!cargado.current) return;
    const ahora = Date.now();
    if (ahora - ultima.current < MINIMO) return;
    ultima.current = ahora;

    try {
      // `cache: no-store` además de la cabecera del servidor: si la cabecera se
      // pierde en un cambio de nginx/Caddy, esto sigue trayendo el html real.
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) return;
      const enServidor = bundleDeHtml(await res.text());
      if (hayVersionNueva(cargado.current, enServidor)) setHayNueva(true);
    } catch {
      // Sin red no se sabe nada, y no saber no es motivo para molestar.
    }
  }, []);

  useEffect(() => {
    if (hayNueva) return;   // ya avisó; dejar de preguntar
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', alVolver);
    const id = setInterval(revisar, CADA);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      clearInterval(id);
    };
  }, [revisar, hayNueva]);

  return hayNueva;
}
