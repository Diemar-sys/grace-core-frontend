import { describe, it, expect } from 'vitest';
import { horaFrappe, horaLocal } from './hora';

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
