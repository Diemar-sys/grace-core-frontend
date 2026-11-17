import { describe, it, expect } from 'vitest';
import { partirImpuesto } from './compraUtils';

describe('partirImpuesto', () => {
  it('separa el nombre del porcentaje', () => {
    expect(partirImpuesto('IVA 16%')).toEqual(['IVA', '16%']);
    expect(partirImpuesto('IEPS 8%')).toEqual(['IEPS', '8%']);
  });

  it('🔴 "Tasa 0" NO se parte: el 0 es la mitad que importa', () => {
    // Partir por espacios dejaría el nombre en "Tasa" y mandaría el "0" al
    // detalle chiquito. "Tasa" a solas no dice que la compra va exenta.
    expect(partirImpuesto('Tasa 0')).toEqual(['Tasa 0', '']);
  });

  it('una tasa con decimales sigue siendo detalle', () => {
    expect(partirImpuesto('IEPS 26.5%')).toEqual(['IEPS', '26.5%']);
  });

  it('sin etiqueta cae en Tasa 0, no en vacío', () => {
    // Un badge sin texto se lee como "esta compra no tiene impuesto definido"
    // cuando en realidad el default del sistema es exento.
    expect(partirImpuesto('')).toEqual(['Tasa 0', '']);
    expect(partirImpuesto(undefined as any)).toEqual(['Tasa 0', '']);
  });

  it('un porcentaje sin nombre se queda entero', () => {
    // "16%" solo: si el nombre saliera vacío el badge quedaría mudo.
    expect(partirImpuesto('16%')).toEqual(['16%', '']);
  });
});
