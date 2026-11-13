import { describe, expect, it } from 'vitest';
import { claseDiferencia, conSigno, resumenEntrega, type TecleoEntrega } from './entregaPueblo';

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

  it('🔴 los gastos salen del efectivo: no pasan de él ni por un centavo; del pan sí pueden pasar', () => {
    expect(resumenEntrega(1500, t('1000', { AGUA: '1000.01' })).error).toMatch(/Los gastos \(\$1,000\.01\) pasan del efectivo.*\$1,000\.00/);
    expect(resumenEntrega(1500, t('1000', { AGUA: '1000' })).error).toBe('');
    expect(resumenEntrega(300, t('1000', { AGUA: '900' }))).toMatchObject({ entregado: 100, diferencia: 700, error: '' });
  });

  it('sin efectivo no hay entrega; negativos, letras y OTRO sin nota', () => {
    expect(resumenEntrega(1500, t('')).error).toMatch(/Escribe el efectivo/);
    expect(resumenEntrega(1500, t('', { AGUA: '500' })).error).toMatch(/Escribe el efectivo/);
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
