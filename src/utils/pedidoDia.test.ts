import { describe, it, expect } from 'vitest';
import { hojaDelDia } from './pedidoDia';

const renglon = (clave: string, piezas: Record<string, number>, ppc = 15) => ({
  categoria: '', clave, producto: clave, item_name: clave, precio: 12,
  piezas_por_charola: ppc, piezas, aviso: '',
  // el backend lo calcula por pestaña; juntar el día tiene que rehacerlo
  charolas_texto: '1 char',
});
const hoja = (pestana: string, renglones: any[], destinos: string[]) => ({
  pestana, renglones, problemas: [], destinos, es_resumen: false,
  total_piezas: renglones.reduce((a, r) => a + Object.values<number>(r.piezas).reduce((x, y) => x + y, 0), 0),
  duplica_a: [], sugerida: true,
});

describe('hojaDelDia', () => {
  // el caso real: CHINOS reparte 119 piezas entre cuatro pestañas = 7.93 charolas
  const hojas = [
    hoja('PRODUCCION', [renglon('1003', { 'P.BOSQUE': 15, 'SANTUARIO': 15, PIRAMIDES: 15, 'P.REAL': 30 })], ['P.BOSQUE', 'SANTUARIO', 'PIRAMIDES', 'P.REAL']),
    hoja('DEli', [renglon('1003', { DEli: 15 })], ['DEli']),
    hoja('CAMIONETAS', [renglon('1003', { ISMA: 12, MARTIN: 10 })], ['ISMA', 'MARTIN']),
    hoja('PUNTOS DE V', [renglon('1003', { MILA: 3, LAGUNI: 2, VEGIL: 2 })], ['MILA', 'LAGUNI', 'VEGIL']),
    hoja('GRAN TOTAL', [renglon('1003', { PANA: 8 })], ['PANA']),
  ];
  const marcadas = ['PRODUCCION', 'DEli', 'CAMIONETAS', 'PUNTOS DE V'];

  it('suma todas las pestañas marcadas en un solo renglón', () => {
    const dia = hojaDelDia(hojas, marcadas);
    expect(dia.renglones).toHaveLength(1);
    expect(dia.total_piezas).toBe(119);
  });

  it('rehace las charolas sobre el total del día, no las de una pestaña', () => {
    const dia = hojaDelDia(hojas, marcadas);
    // 119 piezas de a 15: si se quedara con el texto de una pestaña diría "1 char"
    expect(dia.renglones[0].charolas_texto).toBe('7 char + 14 pz');
  });

  it('deja fuera lo que no está marcado', () => {
    const dia = hojaDelDia(hojas, marcadas);
    expect(dia.destinos).not.toContain('PANA');
    expect(Object.keys(dia.renglones[0].piezas)).toHaveLength(10);
  });

  it('no pierde el renglón de una pestaña que no lo comparte', () => {
    const otras = [...hojas, hoja('EXTRA', [renglon('9999', { ZAKIA: 5 })], ['ZAKIA'])];
    const dia = hojaDelDia(otras, [...marcadas, 'EXTRA']);
    expect(dia.renglones.map((r) => r.clave).sort()).toEqual(['1003', '9999']);
  });

  it('suma en vez de pisar si dos pestañas mandan al mismo destino', () => {
    const dobles = [hoja('A', [renglon('1', { ISMA: 10 })], ['ISMA']),
                    hoja('B', [renglon('1', { ISMA: 4 })], ['ISMA'])];
    expect(hojaDelDia(dobles, ['A', 'B']).renglones[0].piezas.ISMA).toBe(14);
  });

  it('sin nada marcado no truena', () => {
    expect(hojaDelDia(hojas, []).renglones).toEqual([]);
    expect(hojaDelDia(hojas, []).total_piezas).toBe(0);
  });
});
