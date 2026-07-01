import { describe, it, expect } from 'vitest';
import { presFactor, presUnit } from './ConteoFisico';

// El bug del Bin: a Stock Reconciliation siempre se le manda BASE. presFactor=1 solo
// cuando el item ya está en base (sin presentación o factor inválido) → no multiplicar de más.
describe('presFactor / presUnit — conversión presentación→base', () => {
  it('item con presentación (Bulto 25kg) → factor 25, unidad Bulto', () => {
    const it = { custom_cantidad_por_presentación: 25, custom_presentación: 'Bulto', stock_uom: 'Kg' };
    expect(presFactor(it)).toBe(25);
    expect(presUnit(it)).toBe('Bulto');
    // 25 bultos capturados → 625 kg base
    expect(25 * presFactor(it)).toBe(625);
  });
  it('presentación con factor <1 (Caja 0.86kg) → factor 0.86, unidad Caja', () => {
    const it = { custom_cantidad_por_presentación: 0.86, custom_presentación: 'Caja', stock_uom: 'Kg' };
    expect(presFactor(it)).toBe(0.86);
    expect(presUnit(it)).toBe('Caja');
    // 5 cajas capturadas → 4.3 kg base
    expect(5 * presFactor(it)).toBeCloseTo(4.3);
  });
  it('item sin presentación → factor 1, unidad = stock_uom (no multiplica)', () => {
    const it = { stock_uom: 'Pza' };
    expect(presFactor(it)).toBe(1);
    expect(presUnit(it)).toBe('Pza');
  });
  it('factor 1, 0 o basura → 1 (evita romper items en base)', () => {
    expect(presFactor({ custom_cantidad_por_presentación: 1, custom_presentación: 'Pza' })).toBe(1);
    expect(presFactor({ custom_cantidad_por_presentación: 0 })).toBe(1);
    expect(presFactor({})).toBe(1);
    expect(presFactor(null)).toBe(1);
  });
});
