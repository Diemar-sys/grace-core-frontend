import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rateLimiter, sanitizar, sanitizarObjeto, validar } from './security';

describe('security — sanitizar (XSS)', () => {
  it('elimina etiquetas HTML/script', () => {
    expect(sanitizar('<script>alert(1)</script>hola')).toBe('alert(1)hola');
    expect(sanitizar('<img src=x onerror=hack()>')).toBe('');
  });
  it('elimina null bytes y hace trim', () => {
    expect(sanitizar('  texto\0  ')).toBe('texto');
  });
  it('no string pasa intacto', () => {
    expect(sanitizar(42)).toBe(42);
    expect(sanitizar(null)).toBe(null);
  });
  it('NO rompe inputs legítimos con apóstrofes (no filtra SQL)', () => {
    expect(sanitizar("Compra del 1' de mayo")).toBe("Compra del 1' de mayo");
  });
  it('sanitizarObjeto limpia solo strings', () => {
    const out = sanitizarObjeto({ nombre: '<b>Juan</b>', edad: 30, activo: true });
    expect(out).toEqual({ nombre: 'Juan', edad: 30, activo: true });
  });
});

describe('security — validar', () => {
  it('correo válido / inválido / muy largo', () => {
    expect(validar.correo('a@b.com')).toBe(true);
    expect(validar.correo('no-es-correo')).toBe(false);
    expect(validar.correo('a@b.' + 'x'.repeat(120))).toBe(false);
  });
  it('numero acepta positivos y 0, rechaza negativos/NaN', () => {
    expect(validar.numero('10.5')).toBe(true);
    expect(validar.numero('0')).toBe(true);
    expect(validar.numero('-1')).toBe(false);
    expect(validar.numero('abc')).toBe(false);
  });
  it('texto: no vacío y <=200', () => {
    expect(validar.texto('ok')).toBe(true);
    expect(validar.texto('   ')).toBe(false);
    expect(validar.texto('x'.repeat(201))).toBe(false);
  });
  it('telefono: 7-20 chars de dígitos/espacios/guiones', () => {
    expect(validar.telefono('442-599-1147')).toBe(true);
    expect(validar.telefono('123')).toBe(false);
  });
});

describe('security — rateLimiter (anti fuerza bruta)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    rateLimiter.reiniciarExito();
  });
  afterEach(() => vi.useRealTimers());

  it('permite al inicio', () => {
    expect(rateLimiter.verificar().permitido).toBe(true);
  });

  it('bloquea tras 5 fallos', () => {
    let res;
    for (let i = 0; i < 5; i++) res = rateLimiter.registrarFallo();
    expect(res.bloqueado).toBe(true);
    expect(rateLimiter.verificar().permitido).toBe(false);
  });

  it('cuenta intentos restantes antes del bloqueo', () => {
    expect(rateLimiter.registrarFallo().intentosRestantes).toBe(4);
    expect(rateLimiter.registrarFallo().intentosRestantes).toBe(3);
  });

  it('login exitoso reinicia el contador', () => {
    rateLimiter.registrarFallo();
    rateLimiter.registrarFallo();
    rateLimiter.reiniciarExito();
    expect(rateLimiter.verificar().intentos).toBe(0);
  });

  it('el bloqueo expira tras 5 min', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i++) rateLimiter.registrarFallo();
    expect(rateLimiter.verificar().permitido).toBe(false);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(rateLimiter.verificar().permitido).toBe(true);
  });
});
