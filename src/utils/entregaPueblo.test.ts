import { describe, expect, it } from 'vitest';
import { claseDiferencia, conSigno, razonesGasto, resumenEntrega, type TecleoEntrega } from './entregaPueblo';

const t = (efectivo: string, montos: TecleoEntrega['montos'] = {}, nota = ''): TecleoEntrega => ({ efectivo, montos, nota });

describe('resumenEntrega — lo que se enseña antes de guardar la entrega de un pueblo', () => {
  it('🔴 la tabla de Diemar (13-nov): PAN, EFECTIVO, gasto → DIFERENCIA y ENTREGADO', () => {
    const r1 = resumenEntrega(1000, t('1200', { SUELDO: '300' }));
    expect(r1).toMatchObject({ efectivo: 1200, gastosTotal: 300, diferencia: 200, entregado: 900, error: '' });
    expect(r1.gastos).toEqual([{ concepto: 'SUELDO', monto: 300 }]);
    expect(resumenEntrega(2000, t('600'))).toMatchObject({ diferencia: -1400, entregado: 600, error: '' });
    expect(resumenEntrega(5000, t('5000', { AGUA: '300' }))).toMatchObject({ diferencia: 0, entregado: 4700, error: '' });
  });

  it('🔴 los gastos NO mueven la diferencia: solo bajan lo entregado', () => {
    const sin = resumenEntrega(1000, t('1200'));
    const con = resumenEntrega(1000, t('1200', { LUZ: '500', AGUA: '700' }));
    expect(con.diferencia).toBe(sin.diferencia);
    expect([sin.entregado, con.entregado]).toEqual([1200, 0]);
  });

  it('🔴 centavos: 0.10 + 0.20 de gastos sobre 0.30 da exactamente 0, no polvo', () => {
    expect(resumenEntrega(0.3, t('0.30', { AGUA: '0.10', LUZ: '0.20' }))).toMatchObject({ diferencia: 0, entregado: 0, error: '' });
  });

  it('🔴 17-nov: los gastos son informe: PUEDEN pasar del efectivo (08-nov MILA: $550, sueldo $2,400)', () => {
    expect(resumenEntrega(550, t('550', { SUELDO: '2400' }))).toMatchObject({ diferencia: 0, entregado: -1850, error: '' });
    expect(resumenEntrega(1500, t('1000', { AGUA: '1000.01' }))).toMatchObject({ entregado: -0.01, error: '' });
    expect(resumenEntrega(300, t('1000', { AGUA: '900' }))).toMatchObject({ entregado: 100, diferencia: 700, error: '' });
  });

  it('🔴 gastos sin efectivo sí; sin efectivo NI gastos, no; negativos, letras y OTRO sin nota', () => {
    expect(resumenEntrega(1500, t('', { AGUA: '500' }))).toMatchObject({ efectivo: 0, diferencia: -1500, entregado: -500, error: '' });
    expect(resumenEntrega(1500, t('')).error).toMatch(/Escribe el efectivo que regresó o un gasto/);
    expect(resumenEntrega(1500, t('0', { AGUA: '0' })).error).toMatch(/o un gasto/);
    expect(resumenEntrega(1500, t('-5')).error).toMatch(/positivo/);
    expect(resumenEntrega(1500, t('100', { LUZ: 'abc' })).error).toMatch(/positivo/);
    expect(resumenEntrega(1500, t('100', { OTRO: '50' }, '  ')).error).toMatch(/OTRO/);
    const r = resumenEntrega(1500, t('100', { OTRO: '50' }, ' garrafones '));
    expect(r.error).toBe('');
    expect(r.gastos).toEqual([{ concepto: 'OTRO', monto: 50, nota: 'garrafones' }]);
  });

  it('un concepto en 0 o vacío no viaja al servidor', () => {
    expect(resumenEntrega(1500, t('100', { AGUA: '0', LUZ: '' })).gastos).toEqual([]);
  });
});

describe('conSigno / claseDiferencia — la diferencia se lee sin adivinar', () => {
  it('de más, de menos y en cero', () => {
    expect([conSigno(200), conSigno(-1400), conSigno(0), conSigno(-0.004)]).toEqual(['+$200.00', '−$1,400.00', '$0.00', '$0.00']);
    expect([claseDiferencia(200), claseDiferencia(-1400), claseDiferencia(0)]).toEqual(['dif dif--mas', 'dif dif--menos', 'dif dif--cero']);
  });
});

describe('razonesGasto — el Estado de cuenta del pueblo enseña la razón, no el monto', () => {
  it('🔴 concepto de la entrega, nota de OTRO, egreso a mano, sin repetir', () => {
    expect(razonesGasto([
      { concepto: 'SUELDO · MILA', subcategoria: 'OTROS GASTOS' },
      { concepto: 'OTRO · MILA · garrafones', subcategoria: 'OTROS GASTOS' },
      { concepto: 'SUELDO · MILA · semana', subcategoria: 'OTROS GASTOS' },
      { concepto: 'pipa del 3', subcategoria: 'AGUA' },
      { concepto: 'tornillos', subcategoria: 'OTROS GASTOS' },
    ])).toEqual(['SUELDO', 'garrafones', 'AGUA', 'tornillos']);
    expect(razonesGasto()).toEqual([]);
    // 17-nov: PÉRDIDA se llama MERMA; un gasto guardado antes sale como MERMA (y no se repite)
    expect(razonesGasto([{ concepto: 'PÉRDIDA · MILA' }, { concepto: 'MERMA · MILA · duro' }])).toEqual(['MERMA']);
  });
});
