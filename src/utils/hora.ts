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
