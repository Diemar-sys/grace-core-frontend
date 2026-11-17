import { createContext, useEffect, useState } from 'react';
import { leerAviso } from '../utils/mantenimiento';

/**
 * Pregunta a la torre si viene (o ya hay) mantenimiento. Cada 30 s y al volver a
 * la pestaña: con un aviso de 5 min, nadie se entera tarde de más de medio minuto.
 * Es un archivo estático de unos bytes; 20 tablets × 2/min no pesan.
 *
 * `hasta` = hora LOCAL en que arranca, ya corregida con el reloj de la torre
 * (ver `leerAviso`): la cuenta regresiva corre contra `Date.now()` sin desfase.
 */
export type EstadoMantenimiento =
  | { tipo: 'nada' }
  | { tipo: 'aviso'; inicio: number; hasta: number }
  | { tipo: 'activo' };

const CADA = 30 * 1000;

/** Una sola consulta para toda la app (App.jsx la provee): el modal y la píldora del reloj la leen. */
export const MantenimientoContext = createContext<EstadoMantenimiento>({ tipo: 'nada' });

/** `Date.now()` que se refresca cada segundo mientras `activo`; para la cuenta regresiva. */
export function useAhoraCadaSegundo(activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);
  return ahora;
}

export function useAvisoMantenimiento(): EstadoMantenimiento {
  const [estado, setEstado] = useState<EstadoMantenimiento>({ tipo: 'nada' });

  useEffect(() => {
    let vivo = true;
    const revisar = async () => {
      try {
        const res = await fetch('/mantenimiento/aviso', { cache: 'no-store' });
        const a = leerAviso(res.status, res.status === 200 ? await res.text() : null, res.headers.get('Date'));
        if (!vivo) return;
        setEstado(a.tipo === 'aviso' ? { tipo: 'aviso', inicio: a.inicio, hasta: Date.now() + a.faltaMs } : a);
      } catch {
        // Sin red no se sabe nada; BannerConexion ya lo dice.
      }
    };
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    revisar();
    const id = setInterval(revisar, CADA);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return estado;
}
