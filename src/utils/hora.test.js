import { describe, it, expect, vi, afterEach } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { horaFrappe, horaLocal, haceCuanto, nombreCorto, hoyISO } from './hora';

// 07-oct: «hoy» salía de `toISOString()` (UTC). En México, después de las 18:00 ya es mañana en UTC:
// el pedido proponía el día siguiente y ventas/envíos/egresos se fechaban al día siguiente.
describe('hoyISO', () => {
  afterEach(() => vi.useRealTimers());
  it('🔴 a las 19:30 de México sigue siendo hoy (en UTC ya es mañana)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T01:30:00Z')); // 07-oct 19:30 en México
    expect(hoyISO()).toBe('2026-10-07');
  });
  it('una fecha armada en hora local se queda en su día (el día 1 del mes, un lunes)', () => {
    expect(hoyISO(new Date(2026, 9, 1))).toBe('2026-10-01');
    expect(hoyISO(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
  it('🔴 nadie vuelve a sacar la fecha de toISOString() (solo comprasPrint: parte de medianoche UTC)', () => {
    const malos = globSync('src/**/*.{js,jsx,ts,tsx}')
      .filter((f) => !/\.test\./.test(f) && !f.endsWith('comprasPrint.ts'))
      .filter((f) => readFileSync(f, 'utf8').split('\n')
        .some((l) => !/^\s*(\*|\/\/)/.test(l) && /toISOString\(\)\s*\.\s*(split|slice)/.test(l)));
    expect(malos).toEqual([]);
  });
});

describe('horaFrappe', () => {
  it('rellena la hora sin cero a la izquierda que manda Frappe', () => {
    expect(horaFrappe('4:05:00')).toBe('04:05 a.m.');
  });

  it('respeta la hora ya bien formada', () => {
    expect(horaFrappe('14:30:22')).toBe('02:30 p.m.');
  });

  it('tolera los microsegundos de str(timedelta)', () => {
    expect(horaFrappe('4:05:00.123456')).toBe('04:05 a.m.');
  });

  it('devuelve cadena vacia si no hay hora o no parsea', () => {
    expect(horaFrappe('')).toBe('');
    expect(horaFrappe(undefined)).toBe('');
    expect(horaFrappe(null)).toBe('');
    expect(horaFrappe('basura')).toBe('');
  });
});

describe('horaLocal', () => {
  it('formatea una fecha dada', () => {
    expect(horaLocal(new Date('1970-01-01T14:30:00'))).toBe('02:30 p.m.');
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-08-05T12:00:00');

  it('parsea el DATETIME de Frappe (espacio, no T)', () => {
    expect(haceCuanto('2026-08-05 11:30:00', ahora)).toBe('hace 30 minutos');
  });

  it('recien guardado dice "hace un momento", no "este minuto"', () => {
    expect(haceCuanto('2026-08-05 11:59:45', ahora)).toBe('hace un momento');
  });

  it('escala a horas y a días', () => {
    expect(haceCuanto('2026-08-05 09:00:00', ahora)).toBe('hace 3 horas');
    expect(haceCuanto('2026-08-02 12:00:00', ahora)).toBe('hace 3 días');
  });

  it('tolera los microsegundos que manda Frappe', () => {
    expect(haceCuanto('2026-08-05 11:00:00.123456', ahora)).toBe('hace 1 hora');
  });

  it('devuelve cadena vacia si no hay fecha o no parsea', () => {
    expect(haceCuanto('')).toBe('');
    expect(haceCuanto(null)).toBe('');
    expect(haceCuanto('basura')).toBe('');
  });
});

describe('nombreCorto', () => {
  it('se queda con lo de antes del arroba', () => {
    expect(nombreCorto('alma@panaderiasgrace.com')).toBe('alma');
  });

  it('tolera vacio', () => {
    expect(nombreCorto('')).toBe('');
    expect(nombreCorto(undefined)).toBe('');
  });
});
