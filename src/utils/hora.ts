/**
 * Frappe serializa los campos TIME como `str(timedelta)`, o sea `"4:05:00"`:
 * la hora va sin cero a la izquierda. `new Date('1970-01-01T4:05:00')` es
 * Invalid Date, y `"4:05:00".slice(0, 5)` deja `"4:05:"` con dos puntos colgando.
 */

/** Hora en el formato de los tickets: `"04:05 a.m."`. */
export function horaLocal(d: Date = new Date()): string {
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formatea un `posting_time` de Frappe. Devuelve `''` si viene vacío o no parsea,
 * para que quien llame decida el fallback (`horaFrappe(x) || horaLocal()`).
 */
export function horaFrappe(postingTime?: string | null): string {
  if (!postingTime) return '';
  const d = new Date('1970-01-01T' + postingTime.replace(/^(\d):/, '0$1:'));
  return isNaN(d.getTime()) ? '' : horaLocal(d);
}

/**
 * `"hace 2 horas"` a partir de un DATETIME de Frappe (`"2026-08-05 10:23:45"`).
 * El espacio se cambia por `T` para que no dependa del navegador, y sin zona
 * horaria queda en hora local — que es la del servidor (ambos en México).
 *
 * ponytail: `Intl.RelativeTimeFormat` es nativo; nada de date-fns para esto.
 */
const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

export function haceCuanto(datetime?: string | null, ahora: Date = new Date()): string {
  if (!datetime) return '';
  const d = new Date(String(datetime).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const min = Math.round((d.getTime() - ahora.getTime()) / 60000);
  // Menos de un minuto: `rtf` diría "este minuto", que se lee raro.
  if (min === 0) return 'hace un momento';
  if (Math.abs(min) < 60) return rtf.format(min, 'minute');
  const hrs = Math.round(min / 60);
  if (Math.abs(hrs) < 24) return rtf.format(hrs, 'hour');
  return rtf.format(Math.round(hrs / 24), 'day');
}

/** `"alma@panaderiasgrace.com"` → `"alma"`. Para etiquetar de quién es algo. */
export const nombreCorto = (email?: string | null): string =>
  (email || '').split('@')[0] || '';
