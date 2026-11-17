// La sesión de Frappe es UNA cookie (`sid`) para todas las pestañas del sitio:
// cerrar sesión en una la cierra en todas (como GitHub o Gmail). Lo que faltaba
// (23-sep) es que las DEMÁS pestañas se enteren: sin esto seguían enseñando al
// usuario viejo mientras el servidor ya atendía al nuevo, y lo capturado quedaba
// a nombre de otro. El aviso es el evento `storage` nativo: llega a las otras
// pestañas cuando `frappeAuth` escribe o borra `frappe_user`.
// Estándar de la industria: no se recarga sola (la persona ve qué pasó); se
// bloquea la pantalla con un aviso hasta que recargue (<AvisoSesion>).
import { useEffect, useState } from 'react';

export const CLAVE_USUARIO = 'frappe_user';

export type CambioSesion = { tipo: 'salio' } | { tipo: 'otro'; correo: string };

const correoDe = (raw: string | null): string | null => {
  try { return raw ? JSON.parse(raw)?.email ?? null : null; } catch { return null; }
};

/**
 * Qué pasó en otra pestaña. `null` = nada que avisar: otra clave, o el MISMO
 * usuario entrando otra vez (bloquearle la pantalla no tendría sentido).
 * `key` null = `localStorage.clear()`: se trata como salida.
 */
export function queCambio(key: string | null, antes: string | null, despues: string | null): CambioSesion | null {
  if (key === null) return { tipo: 'salio' };
  if (key !== CLAVE_USUARIO) return null;
  const nuevo = correoDe(despues);
  if (nuevo === correoDe(antes)) return null;
  return nuevo ? { tipo: 'otro', correo: nuevo } : { tipo: 'salio' };
}

export function useSesionCompartida(): CambioSesion | null {
  const [cambio, setCambio] = useState<CambioSesion | null>(null);
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      const c = queCambio(e.key, e.oldValue, e.newValue);
      if (c) setCambio(c);
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);
  return cambio;
}
