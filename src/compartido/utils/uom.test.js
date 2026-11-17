import { describe, it, expect } from 'vitest';
import { fmtUom } from './uom';

describe('uom — fmtUom', () => {
  it('aplica alias de litros', () => {
    expect(fmtUom('L')).toBe('Lt');
    expect(fmtUom('l')).toBe('Lt');
  });
  it('devuelve la UoM original si no hay alias', () => {
    expect(fmtUom('Kg')).toBe('Kg');
    expect(fmtUom('Pza')).toBe('Pza');
  });
  it('defensivo: sin argumento devuelve cadena vacía', () => {
    expect(fmtUom()).toBe('');
  });
});
