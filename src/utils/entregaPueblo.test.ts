import { describe, expect, it } from 'vitest';
import { resumenEntrega, type TecleoEntrega } from './entregaPueblo';

const t = (entrego: string, montos: TecleoEntrega['montos'] = {}, nota = ''): TecleoEntrega => ({ entrego, montos, nota });

describe('resumenEntrega — lo que se enseña antes de guardar la entrega de un pueblo', () => {
  it('el caso de Diemar: mandado 1,500, entregó 1,000, 500 de agua → sin justificar 0', () => {
    const r = resumenEntrega(1500, t('1000', { AGUA: '500' }));
    expect(r).toMatchObject({ efectivo: 1000, gastosTotal: 500, sinJustificar: 0, error: '' });
    expect(r.gastos).toEqual([{ concepto: 'AGUA', monto: 500 }]);
  });

  it('lo que no se justifica se queda como diferencia de ese día', () => {
    const r = resumenEntrega(2015, t('1600', { LUZ: '200', 'PÉRDIDA': '100' }));
    expect(r.sinJustificar).toBe(115);
    expect(r.gastos.map(g => g.concepto)).toEqual(['LUZ', 'PÉRDIDA']);
    expect(r.error).toBe('');
  });

  it('🔴 centavos: 0.10 + 0.20 contra 0.30 da exactamente 0, no polvo', () => {
    const r = resumenEntrega(0.3, t('0.10', { AGUA: '0.20' }));
    expect(r.sinJustificar).toBe(0);
    expect(r.error).toBe('');
  });

  it('🔴 entregó de más (la foto de MILAGRO: 1,610 sobre 1,555): el día queda en 0 y sobran 55 para otro día', () => {
    expect(resumenEntrega(1555, t('1610'))).toMatchObject({ sinJustificar: 0, sobrante: 55, error: '' });
    expect(resumenEntrega(1500, t('1400', { LUZ: '200' }))).toMatchObject({ sinJustificar: 0, sobrante: 100, error: '' });
    expect(resumenEntrega(1500, t('1500'))).toMatchObject({ sinJustificar: 0, sobrante: 0, error: '' });
    expect(resumenEntrega(1500, t('1000'))).toMatchObject({ sinJustificar: 500, sobrante: 0 });
  });

  it('🔴 los gastos no pasan de lo que debe el día, ni por un centavo', () => {
    expect(resumenEntrega(1500, t('', { AGUA: '1500.01' })).error).toMatch(/Los gastos \(\$1,500\.01\) pasan.*\$1,500\.00/);
    expect(resumenEntrega(1500, t('900', { AGUA: '1500' })).error).toBe('');
  });

  it('nada tecleado, negativos, letras y OTRO sin nota', () => {
    expect(resumenEntrega(1500, t('')).error).toMatch(/Escribe lo que entregó/);
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
