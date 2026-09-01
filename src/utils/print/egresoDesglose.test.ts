import { describe, it, expect } from 'vitest';
import { agruparPorTasa, subtotalPartidas, importePartida, ajusteDerivado } from './egresoDesglose';

/** Las partidas tal como las guarda un egreso de Luz. */
const LUZ = [
  { concepto: 'ENERGÍA', cantidad: 1, precio: 1231.21, importe: 1231.21, impuesto: 'IVA 16%' },
  { concepto: 'DAP (ALUMBRADO PÚBLICO)', cantidad: 1, precio: 98.50, importe: 98.50, impuesto: 'Tasa 0' },
  { concepto: 'AJUSTE POR REDONDEO', cantidad: 1, precio: -0.70, importe: -0.70, impuesto: 'Tasa 0' },
];

describe('agruparPorTasa — subtotales del ticket', () => {
  it('separa la base gravable de la exenta', () => {
    // El bug que arregla: antes salia "SUBTOTAL IVA 16% 1,329.01", metiendo el
    // DAP y el ajuste al bucket del 16%. 16% de 1,329.01 son 212.64, no 196.99.
    const g = agruparPorTasa(LUZ);
    expect(g).toEqual([
      { label: 'IVA 16%', subtotal: 1231.21 },
      { label: 'Tasa 0', subtotal: 97.80 },
    ]);
  });

  it('el ajuste negativo baja su grupo, no el gravable', () => {
    const g = agruparPorTasa(LUZ);
    expect(g.find(x => x.label === 'IVA 16%')!.subtotal).toBe(1231.21);  // intacto
    expect(g.find(x => x.label === 'Tasa 0')!.subtotal).toBe(97.80);     // 98.50 - 0.70
  });

  it('el IVA declarado SI es el 16% de su propio grupo', () => {
    const gravable = agruparPorTasa(LUZ).find(x => x.label === 'IVA 16%')!.subtotal;
    expect(Math.round(gravable * 0.16 * 100) / 100).toBe(196.99);
  });

  it('la suma de los grupos es el subtotal', () => {
    const g = agruparPorTasa(LUZ);
    expect(g.reduce((a, x) => a + x.subtotal, 0)).toBeCloseTo(subtotalPartidas(LUZ), 2);
    expect(subtotalPartidas(LUZ)).toBe(1329.01);
  });

  it('conserva el orden del papel, no alfabetico', () => {
    expect(agruparPorTasa(LUZ).map(g => g.label)).toEqual(['IVA 16%', 'Tasa 0']);
  });

  it('partida sin impuesto cae en Tasa 0, no en undefined', () => {
    const g = agruparPorTasa([{ concepto: 'X', importe: 10 }]);
    expect(g).toEqual([{ label: 'Tasa 0', subtotal: 10 }]);
  });

  it('sin partidas devuelve vacio, no truena', () => {
    expect(agruparPorTasa([])).toEqual([]);
    expect(agruparPorTasa(null)).toEqual([]);
    expect(subtotalPartidas(undefined)).toBe(0);
  });

  it('deriva el importe de cantidad x precio cuando no viene', () => {
    expect(importePartida({ cantidad: 3, precio: 12.5 })).toBe(37.5);
    expect(importePartida({ cantidad: 3, precio: 12.5, importe: 99 })).toBe(99);
  });
});

describe('ajusteDerivado — que se vea la diferencia', () => {
  it('destapa el ajuste del caso real (agua, EGR-2026-0259)', () => {
    // 1,323.00 + 211.68 = 1,534.68 pero el total guardado es 1,534.00. El ticket
    // no decia nada de esos -0.68 y el total parecia salido de la nada.
    expect(ajusteDerivado(1534.00, 1323.00, 211.68)).toBe(-0.68);
  });

  it('da CERO cuando el ajuste ya es una partida (Luz)', () => {
    // En Luz el redondeo ya vive como renglon propio, asi que no debe contarse
    // dos veces: 1,329.01 + 196.99 = 1,526.00 exacto.
    expect(ajusteDerivado(1526.00, 1329.01, 196.99)).toBe(0);
  });

  it('no inventa ajuste por ruido de flotante', () => {
    // 0.1 + 0.2 = 0.30000000000000004. Sin redondear a centavos saldria una
    // linea de "AJUSTE 0.00" en tickets donde no hay nada que ajustar.
    expect(ajusteDerivado(0.3, 0.1, 0.2)).toBe(0);
  });

  it('un ajuste positivo tambien se ve', () => {
    expect(ajusteDerivado(1000.50, 1000.00, 0)).toBe(0.50);
  });

  it('vacio o basura no truena', () => {
    expect(ajusteDerivado(null, 0, undefined)).toBe(0);
    expect(ajusteDerivado('abc', 0, 'x')).toBe(0);
  });
});

describe('ajusteDerivado — cero negativo', () => {
  it('nunca devuelve -0, que se imprimiria como "-0.00"', () => {
    const r = ajusteDerivado(0.3, 0.1, 0.2);
    expect(Object.is(r, -0)).toBe(false);
    expect(r).toBe(0);
  });

  it('tampoco por el lado del subtotal', () => {
    const r = ajusteDerivado(1329.01, 1329.01, 0);
    expect(Object.is(r, -0)).toBe(false);
  });
});
