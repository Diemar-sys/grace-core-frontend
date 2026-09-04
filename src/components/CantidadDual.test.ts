import { describe, it, expect } from 'vitest';
import { convertir, redondear, factorSeguro } from './CantidadDual';

/**
 * Cada caso reproduce una forma conocida de que la conversión MIENTA sin fallar.
 * No se prueba que 2×25 sea 50; se prueba lo que ya costó dinero.
 */
describe('convertir', () => {
  it('el caso que costó $8,846.23: 2 en presentación son 50 Kg, no 2', () => {
    // Teclear 2 pensando bultos y que salgan 2 Kg es la fuga de julio entrando
    // por la captura. La conversión tiene que multiplicar, no pasar el número.
    expect(convertir('2', 25, 'base')).toBe('50');
  });

  it('el renglón de la pantalla: 122 Kg = 4.88 BULTO, y regresa a 122 exacto', () => {
    const pres = convertir('122', 25, 'pres');
    expect(pres).toBe('4.88');
    expect(convertir(pres, 25, 'base')).toBe('122');
  });

  it('🔴 el bulto partido NO deja cola binaria en pantalla', () => {
    // Medidos con el factor 25 real de la BOLSA NEGRA: en crudo, JS imprime
    //   2.3 * 25 = 57.49999999999999
    //   2.2 * 25 = 55.00000000000001
    //   1.1 * 25 = 27.500000000000004
    // Un input con "57.49999999999999" se lee como sistema descompuesto y quien
    // surte lo corrige a mano — que es justo la tecleada que se quiere evitar.
    expect(convertir('2.3', 25, 'base')).toBe('57.5');
    expect(convertir('2.2', 25, 'base')).toBe('55');
    expect(convertir('1.1', 25, 'base')).toBe('27.5');
  });

  it('🔴 y tampoco al dividir, que es el lado que ve el que teclea Kg', () => {
    // 0.9 / 25 = 0.036000000000000004 en crudo.
    expect(convertir('0.9', 25, 'pres')).toBe('0.036');
    expect(convertir('1.4', 25, 'pres')).toBe('0.056');
  });

  it('un factor decimal aguanta la ida y vuelta', () => {
    // CAJA de 0.86 Kg: 3 / 0.86 = 3.488372093023256, periódico de verdad.
    const pres = convertir('3', 0.86, 'pres');
    expect(convertir(pres, 0.86, 'base')).toBe('3');
  });

  it('el campo vacío se queda vacío, no se vuelve cero', () => {
    // Si borrar la cantidad devolviera '0', el renglón capturaría un cero y el
    // Stock Entry saldría con qty 0 en vez de no salir. El cero de valuación ya
    // costó $16,553 por sembrarse solo.
    expect(convertir('', 25, 'base')).toBe('');
    expect(convertir('   ', 25, 'pres')).toBe('');
    expect(convertir('abc', 25, 'base')).toBe('');
  });

  it('factor cero o basura NO divide entre cero', () => {
    // 🔴 Un item sin `custom_cantidad_por_presentación` mandaría base/0 = Infinity
    // y el input pintaría "Infinity". Con factor 1 el número pasa intacto.
    expect(convertir('5', 0, 'pres')).toBe('5');
    expect(convertir('5', null, 'pres')).toBe('5');
    expect(convertir('5', '', 'base')).toBe('5');
    expect(convertir('5', -25, 'pres')).toBe('5');
    expect(Number.isFinite(parseFloat(convertir('5', 0, 'pres')))).toBe(true);
  });

  it('el punto decimal a medio teclear no rompe la conversión', () => {
    // "1." es lo que existe entre teclear el 1 y el 5 de "1.5". parseFloat lo lee
    // como 1: la conversión da un número válido y el borrador conserva el punto.
    expect(convertir('1.', 25, 'base')).toBe('25');
  });
});

describe('factorSeguro', () => {
  it('solo un factor positivo real se respeta', () => {
    expect(factorSeguro(25)).toBe(25);
    expect(factorSeguro('0.86')).toBe(0.86);
    expect(factorSeguro(0)).toBe(1);
    expect(factorSeguro(undefined)).toBe(1);
    expect(factorSeguro(NaN)).toBe(1);
  });
});

describe('redondear', () => {
  it('corta el ruido sin tocar los decimales que sí importan', () => {
    expect(redondear(57.49999999999999)).toBe(57.5);
    expect(redondear(55.00000000000001)).toBe(55);
    expect(redondear(4.88)).toBe(4.88);
    // 6 decimales es el tope: un factor de catálogo puede traerlos.
    expect(redondear(0.0000015)).toBe(0.000002);
  });
});
