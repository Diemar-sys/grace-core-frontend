import { describe, it, expect } from 'vitest';
import { charolas } from './charolas';

// Mismos casos que test_pedido_import.py: si una implementación cambia sin la
// otra, la pantalla y el PDF empiezan a decir cosas distintas del mismo pedido.
describe('charolas (espejo de _charolas en pedido_api.py)', () => {
  it('parte el total en charolas y piezas sueltas', () => {
    expect(charolas(84, 24)).toBe('3 char + 12 pz');   // MANTECADA GDE por pestaña
    expect(charolas(144, 24)).toBe('6 char');          // MANTECADA GDE, día completo
    expect(charolas(75, 15)).toBe('5 char');           // CHINOS
    expect(charolas(119, 15)).toBe('7 char + 14 pz');  // CHINOS, día completo
    expect(charolas(19, 15)).toBe('1 char + 4 pz');    // BISQUET
    expect(charolas(12, 24)).toBe('12 pz');            // media charola
  });

  it('no reparte lo que no va en charola', () => {
    expect(charolas(5, 1)).toBe('');                   // pasteles
    expect(charolas(5, 0)).toBe('');                   // sin dato
    expect(charolas(0, 24)).toBe('');
  });
});
