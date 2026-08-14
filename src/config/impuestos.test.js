import { describe, it, expect } from 'vitest';
import { desglosarImpuesto, grupoSubtotal, getTasa, claveImpuesto } from './impuestos';

describe('claveImpuesto — dos casillas → una clave', () => {
  it('las cuatro combinaciones', () => {
    expect(claveImpuesto(true,  true)).toBe('iva16_ieps');
    expect(claveImpuesto(true,  false)).toBe('iva16');
    expect(claveImpuesto(false, true)).toBe('ieps');
    expect(claveImpuesto(false, false)).toBe('tasa0');   // tasa 0 = ausencia, no impuesto
  });
});

// Un pan de alta densidad calórica causa IEPS 8% Y puede causar IVA. Cuando van
// los dos, el IEPS entra a la base del IVA (igual que en la gasolina): sumarlos
// planos (24%) cobra de menos.
describe('desglosarImpuesto — cascada IEPS → IVA', () => {
  it('con ambos, el IVA va sobre base + IEPS', () => {
    const { ieps, iva } = desglosarImpuesto(100, 'iva16_ieps');
    expect(ieps).toBeCloseTo(8, 6);
    expect(iva).toBeCloseTo(17.28, 6);        // (100 + 8) × 16%
    expect(iva).not.toBeCloseTo(16, 2);       // el error de sumarlos planos
    expect(100 + ieps + iva).toBeCloseTo(125.28, 6);
  });

  it('la tasa combinada es 25.28%, no 24%', () => {
    expect(getTasa('iva16_ieps')).toBeCloseTo(0.2528, 6);
    const { ieps, iva } = desglosarImpuesto(100, 'iva16_ieps');
    expect((ieps + iva) / 100).toBeCloseTo(getTasa('iva16_ieps'), 6);
  });

  it('solo IVA se comporta igual que siempre', () => {
    expect(desglosarImpuesto(100, 'iva16')).toEqual({ ieps: 0, iva: 16 });
  });

  it('solo IEPS se comporta igual que siempre', () => {
    expect(desglosarImpuesto(100, 'ieps')).toEqual({ ieps: 8, iva: 0 });
  });

  it('tasa 0 y claves desconocidas no cobran nada', () => {
    expect(desglosarImpuesto(100, 'tasa0')).toEqual({ ieps: 0, iva: 0 });
    expect(desglosarImpuesto(100, 'lo-que-sea')).toEqual({ ieps: 0, iva: 0 });
  });

  it('base vacía o basura no produce NaN', () => {
    expect(desglosarImpuesto(undefined, 'iva16_ieps')).toEqual({ ieps: 0, iva: 0 });
  });
});

// La base de una fila va a UN solo grupo: los tres subtotales se suman para
// formar el subtotal, así que contarla dos veces inflaría el total.
describe('grupoSubtotal', () => {
  it('con ambos impuestos la base cuenta una sola vez, bajo IVA', () => {
    expect(grupoSubtotal('iva16_ieps')).toBe('subtotalIva16');
  });

  it('cada clave simple a su grupo', () => {
    expect(grupoSubtotal('iva16')).toBe('subtotalIva16');
    expect(grupoSubtotal('ieps')).toBe('subtotalIeps');
    expect(grupoSubtotal('tasa0')).toBe('subtotalTasa0');
    expect(grupoSubtotal(undefined)).toBe('subtotalTasa0');
  });
});
