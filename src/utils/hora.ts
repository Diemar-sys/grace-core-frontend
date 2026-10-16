/**
 * Frappe serializa los campos TIME como `str(timedelta)`, o sea `"4:05:00"`:
 * la hora va sin cero a la izquierda. `new Date('1970-01-01T4:05:00')` es
 * Invalid Date, y `"4:05:00".slice(0, 5)` deja `"4:05:"` con dos puntos colgando.
 */

/**
 * Fecha LOCAL `YYYY-MM-DD`, la que espera el backend. Única fuente de «hoy» en el front.
 * NUNCA `toISOString()`: es UTC y en México (UTC-6) después de las 18:00 da el día de
 * MAÑANA — así se proponía el pedido de mañana y se fechaban ventas/envíos/egresos al
 * día siguiente (07-oct). Recibe cualquier Date armada en hora local (lunes, día 1…).
 * Ojo: `new Date('2026-10-07')` es medianoche UTC; esa NO se pasa por aquí.
 */
export function hoyISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// 16-oct: fechas bonitas para «Mi cuenta». Se parte el texto 'AAAA-MM-DD' (sin `new Date(iso)`,
// que lo lee en UTC y en México da el día anterior).
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const partes = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number];

/** '2026-10-02' → 'vie 2 oct'. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = partes(iso);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${d} ${MESES[m - 1]}`;
}

/** '2026-10-02' → 'vie 2 oct 2026'. */
export const fechaLarga = (iso: string) => `${fechaCorta(iso)} ${iso.slice(0, 4)}`;

/** '2026-10-01','2026-10-16' → '1 – 16 oct 2026'; otro mes u otro año se escribe completo. */
export function rangoFechas(desde: string, hasta: string): string {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  if (a1 !== a2) return `${d1} ${MESES[m1 - 1]} ${a1} – ${d2} ${MESES[m2 - 1]} ${a2}`;
  if (m1 !== m2) return `${d1} ${MESES[m1 - 1]} – ${d2} ${MESES[m2 - 1]} ${a2}`;
  return d1 === d2 ? `${d1} ${MESES[m1 - 1]} ${a1}` : `${d1} – ${d2} ${MESES[m1 - 1]} ${a1}`;
}
