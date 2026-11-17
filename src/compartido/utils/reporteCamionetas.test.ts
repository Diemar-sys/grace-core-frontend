import { describe, expect, it } from 'vitest';
import {
  claveMerma, conMerma, csvCamionetas, fechaConDia, leerMerma, mermasPorGuardar, totales, totalesCategoria,
  type DiaCamioneta,
} from './reporteCamionetas';

// MARTIN 09-nov: vendió $5,062 de $6,936. Sin merma guardada: gastos $3,484.10.
const martin: DiaCamioneta = {
  fecha: '2026-11-09', enviado: 6936, venta: 5062, merma: 1874, materia: 1771.7, merma_mano: null,
  merma_cerrada: false, panadero: 506.2, camioneta: 500, chofer: 506.2, ayudante: 200, gastos: 3484.1,
  diferencia: 1577.9, liquidado: true, categorias: { 'PAN BLANCO': 1000, 'PAN DULCE': 4062 },
};
// el servidor ya trae la guardada sumada a gastos
const guardada: DiaCamioneta = { ...martin, merma_mano: 655.9, gastos: 4140, diferencia: 922 };
const sinLiquidar: DiaCamioneta = {
  ...martin, fecha: '2026-11-10', venta: 0.1, merma: null, materia: 0.2,
  gastos: 0.1, diferencia: 0.2, liquidado: false, categorias: { 'PAN DULCE': 0.1 },
};
const k = (fecha = martin.fecha, destino = 'MARTIN') => claveMerma(destino, fecha);
const nadie = (dias: DiaCamioneta[]) => conMerma('MARTIN', dias, {});

describe('reporte de camionetas', () => {
  it('suma por columna al centavo, sin ruido de float; merma sin guardar cuenta 0', () => {
    const t = totales(nadie([martin, sinLiquidar]));
    expect(t.venta).toBe(5062.1);
    expect(t.materia).toBe(1771.9);          // 1771.7 + 0.2 en float da 1771.9000000000001
    expect(t.merma_mano).toBe(0);
    expect(t.diferencia).toBe(1578.1);
    // 0.07 × 100 = 7.000000000000001: sin redondear a centavos, tres días dan 0.21000000000000002
    expect(totales(nadie([0.07, 0.07, 0.07].map((g) => ({ ...martin, gastos: g })))).gastos).toBe(0.21);
  });

  it('lo tecleado se sobrepone SOLO en su camioneta y día, ajustando por la diferencia', () => {
    const escritas = { [k()]: '655.90', [k('2026-11-10', 'OTRA')]: '999' };
    const [uno, dos] = conMerma('MARTIN', [martin, sinLiquidar], escritas);
    expect([uno.merma_mano, uno.gastos, uno.diferencia, uno.pendiente]).toEqual([655.9, 4140, 922, true]);
    expect([dos.merma_mano, dos.gastos, dos.pendiente]).toEqual([null, 0.1, false]);
    // sobre una ya guardada, cambiar 655.90 → 700 sube gastos solo 44.10 (no la suma dos veces)
    const [c] = conMerma('MARTIN', [guardada], { [k()]: '700' });
    expect([c.gastos, c.diferencia]).toEqual([4184.1, 877.9]);
    // centavos: 0.1 + 0.2 en float es 0.30000000000000004
    expect(conMerma('MARTIN', [{ ...martin, gastos: 0.1 }], { [k()]: '0.2' })[0].gastos).toBe(0.3);
  });

  it('igual a lo guardado no es pendiente; vacío borra; cerrada e inválida no se tocan', () => {
    expect(conMerma('MARTIN', [guardada], { [k()]: '655.9' })[0].pendiente).toBe(false);
    const [b] = conMerma('MARTIN', [guardada], { [k()]: '' });
    expect([b.merma_mano, b.gastos, b.pendiente]).toEqual([null, 3484.1, true]);
    const [c] = conMerma('MARTIN', [{ ...guardada, merma_cerrada: true }], { [k()]: '1' });
    expect([c.merma_mano, c.pendiente]).toEqual([655.9, false]);
    const [i] = conMerma('MARTIN', [guardada], { [k()]: 'abc' });
    expect([i.merma_mano, i.gastos, i.pendiente, i.invalida]).toEqual([655.9, 4140, false, true]);
  });

  it('Guardar manda solo lo pendiente, con null para borrar', () => {
    const filas = [{ destino: 'MARTIN', dias: conMerma('MARTIN', [guardada, sinLiquidar], { [k()]: '', [k('2026-11-10')]: '12' }) },
      { destino: 'ISMA', dias: conMerma('ISMA', [martin], {}) }];
    expect(mermasPorGuardar(filas)).toEqual([
      { fecha: '2026-11-09', destino: 'MARTIN', monto: null },
      { fecha: '2026-11-10', destino: 'MARTIN', monto: 12 },
    ]);
  });

  it('merma: vacío = null; negativo o basura = inválida; acepta «$1,200.50»', () => {
    expect([leerMerma(''), leerMerma('  '), leerMerma(undefined)]).toEqual([null, null, null]);
    expect([leerMerma('-5'), leerMerma('abc')]).toEqual([undefined, undefined]);
    expect(leerMerma('$1,200.50')).toBe(1200.5);
    expect(leerMerma('0')).toBe(0);
  });

  it('categorías: Σ por columna al centavo, la que falta en un día cuenta 0', () => {
    const t = totalesCategoria([martin, sinLiquidar, { ...martin, categorias: { 'PAN DULCE': 0.2 } }],
      ['PAN BLANCO', 'PAN DULCE']);
    expect(t).toEqual({ 'PAN BLANCO': 1000, 'PAN DULCE': 4062.3 });
  });

  it('fecha como el Excel, en hora local (el 01-sep de 2026 es martes)', () => {
    expect(fechaConDia('2026-09-01')).toBe('01-SEP MARTES');
    expect(fechaConDia('2026-11-08')).toBe('08-NOV DOMINGO');
  });

  it('CSV: BOM, merma en blanco si nadie la guardó, categorías al final', () => {
    const filas = conMerma('FER/ROSY', [martin, sinLiquidar], { [k(martin.fecha, 'FER/ROSY')]: '655.9' });
    const csv = csvCamionetas([{ destino: 'FER/ROSY', dias: filas }], ['PAN BLANCO', 'PAN DULCE']);
    const [cab, uno, dos] = csv.slice(1).split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(cab.split(',').slice(2, 5)).toEqual(['Monto', '35%', 'Merma']);
    expect(uno).toBe('FER/ROSY,2026-11-09,5062,1771.7,655.9,506.2,500,506.2,200,4140,922,SI,1000,4062');
    expect(dos.split(',')[4]).toBe('');
    expect(dos.split(',').slice(-2)).toEqual(['0', '0.1']);
  });
});
