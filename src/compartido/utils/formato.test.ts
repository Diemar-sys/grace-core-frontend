import { describe, it, expect } from 'vitest';
import { numero, pesos, cantidad } from './formato';

describe('formato — miles con coma', () => {
  it('separa miles y millones', () => {
    expect(numero(1234.5)).toBe('1,234.50');
    expect(numero(1234567.891)).toBe('1,234,567.89');
    expect(pesos(1234567.891)).toBe('$1,234,567.89');
  });

  it('no separa lo que no llega a mil', () => {
    expect(numero(999.9)).toBe('999.90');
    expect(pesos(0)).toBe('$0.00');
  });

  // 🔴 El bug del 01-sep: -0.004 redondea a "-0.00" y en pantalla parece que
  // se debe dinero. El cero no tiene signo.
  it('no imprime cero negativo', () => {
    expect(numero(-0)).toBe('0.00');
    expect(numero(-0.004)).toBe('0.00');
    expect(pesos(-0.001)).toBe('$0.00');
    expect(numero(-0.004)).not.toBe('-0.00');
  });

  it('conserva el signo de un negativo de verdad', () => {
    expect(numero(-1234.5)).toBe('-1,234.50');
    expect(pesos(-5181.1)).toBe('-$5,181.10');
  });

  // Los datos llegan de Frappe y a veces vienen null o cadena.
  it('defensivo: null, undefined y basura no truenan', () => {
    expect(numero(null)).toBe('0.00');
    expect(numero(undefined)).toBe('0.00');
    expect(numero('no soy número')).toBe('0.00');
    expect(numero('1234.5')).toBe('1,234.50');
    expect(cantidad(null)).toBe('0');
  });

  it('decimales configurables: piezas van sin centavos', () => {
    expect(numero(16500, 0)).toBe('16,500');
    expect(numero(0.162588, 4)).toBe('0.1626');
  });

  // 🔴 `cantidad` no rellena con ceros: 140 kg se lee "140", no "140.000".
  it('cantidad recorta los ceros de relleno pero conserva miles', () => {
    expect(cantidad(140)).toBe('140');
    expect(cantidad(3600)).toBe('3,600');
    expect(cantidad(28.8)).toBe('28.8');
    expect(cantidad(16500)).toBe('16,500');
  });
});
