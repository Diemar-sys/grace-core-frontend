// src/utils/mantenimiento.ts
// Qué dice /mantenimiento/aviso (22-oct). Lo sirve el nginx del SPA desde la
// carpeta del interruptor (~/erp-grace-infra/mantenimiento en la torre):
//   200 {"inicio": <epoch s>} → aviso previo: a esa hora se apaga
//   503                       → ya está en mantenimiento (el candado ON)
//   cualquier otra cosa       → nada (404 sin aviso; en dev Vite contesta su index.html)

export type Aviso =
  | { tipo: 'nada' }
  | { tipo: 'aviso'; inicio: number; faltaMs: number }
  | { tipo: 'activo' };

const NADA: Aviso = { tipo: 'nada' };

/**
 * `fechaServidor` = cabecera `Date` de la misma respuesta. La cuenta regresiva
 * sale de la hora de la TORRE, no de la del navegador: las tablets traen el
 * reloj corrido y con eso el aviso diría «en 9 min» cuando faltan 5.
 */
export function leerAviso(status: number, cuerpo: string | null, fechaServidor: string | null): Aviso {
  if (status === 503) return { tipo: 'activo' };
  if (status !== 200 || !cuerpo) return NADA;
  let inicio: unknown;
  try { inicio = (JSON.parse(cuerpo) as { inicio?: unknown })?.inicio; } catch { return NADA; }
  if (typeof inicio !== 'number' || !Number.isFinite(inicio)) return NADA;
  const ahoraServidor = fechaServidor ? Date.parse(fechaServidor) : NaN;
  const base = Number.isFinite(ahoraServidor) ? ahoraServidor : Date.now();
  return { tipo: 'aviso', inicio, faltaMs: inicio * 1000 - base };
}

/** `4:05` · `0:09` · `0:00` (nunca negativo). */
export function cuentaRegresiva(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
