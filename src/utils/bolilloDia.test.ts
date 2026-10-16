import { describe, it, expect } from 'vitest';
import type { BolilloDia, Tanda } from '../services/frappeHoja';
import { cambiosBolillo, claveCamioneta, claveTanda, mananaYTarde, sinDestino, totalesCamionetas, totalesDestino } from './bolilloDia';

const ITEMS: BolilloDia['items'] = [
  { item_code: '3001', unidad: 'charolas', por_charola: 16 },
  { item_code: '3002', unidad: 'charolas', por_charola: 12 },
  { item_code: '3003', unidad: 'piezas', por_charola: 1 },
  { item_code: '3004', unidad: 'piezas', por_charola: 1 },
];
const tanda = (n: number, bolillo: [number, number], mini: [number, number] = [0, 0]): Tanda => ({
  tanda: n, tipo: 'TABLA', segundo: '', horario: '07:00',
  celdas: {
    '3001': { pedido: bolillo[0], salio: bolillo[1] }, '3002': { pedido: 0, salio: 0 },
    '3003': { pedido: mini[0], salio: mini[1] }, '3004': { pedido: 0, salio: 0 },
  },
});
// P.REAL del 06-oct: pedido 4 + 24 + 14; ya se guardó que salieron 4 en la primera
const PREAL = [tanda(1, [4, 4]), tanda(2, [24, 0], [30, 0]), tanda(3, [14, 0])];
const DIA: BolilloDia = {
  items: ITEMS,
  destinos: [{ destino: 'P.REAL', cobrado: false, tandas: PREAL }, { destino: 'DEli', cobrado: true, tandas: [tanda(1, [6, 6])] }],
  camionetas: {
    tandas: [tanda(1, [2, 0]), tanda(2, [12, 0])],
    salen: [{ destino: 'ISMA', cerrada: false, cobrada: false, cantidades: { '3001': 8 } },
            { destino: 'MARTIN', cerrada: true, cobrada: false, cantidades: { '3001': 6 } }],
  },
};

describe('totalesDestino (08-oct)', () => {
  it('suma pedido y lo que salió con lo TECLEADO encima de lo guardado; piezas = charolas × 16', () => {
    const tot = totalesDestino('P.REAL', PREAL, ITEMS, { [claveTanda('P.REAL', 2, '3001')]: '20', [claveTanda('P.REAL', 3, '3001')]: '12' });
    expect(tot['3001']).toEqual({ pedido: 42, salio: 36, piezas: 576, pedidoPiezas: 672 });
    expect(tot['3003']).toEqual({ pedido: 30, salio: 0, piezas: 0, pedidoPiezas: 30 });     // mini en piezas
  });
  it('sin tecleado, lo guardado', () => {
    expect(totalesDestino('P.REAL', PREAL, ITEMS, {})['3001']).toEqual({ pedido: 42, salio: 4, piezas: 64, pedidoPiezas: 672 });
  });
});

describe('totalesCamionetas (08-oct)', () => {
  it('pedido de la bolsa contra la suma de lo que se lleva cada camioneta', () => {
    const tot = totalesCamionetas(DIA.camionetas!.tandas, DIA.camionetas!.salen, ITEMS, { [claveCamioneta('ISMA', '3001')]: '9' });
    expect(tot['3001']).toEqual({ pedido: 14, salio: 15, piezas: 240, pedidoPiezas: 224 });
  });
});

describe('cambiosBolillo (08-oct)', () => {
  it('solo lo que difiere de lo guardado; nada de destinos cobrados ni camionetas que ya salieron', () => {
    const tecleado = {
      [claveTanda('P.REAL', 1, '3001')]: '4',      // igual a lo guardado: no viaja
      [claveTanda('P.REAL', 2, '3001')]: '20',
      [claveTanda('P.REAL', 2, '3003')]: '',       // borrado = 0 (guardado ya era 0: no viaja)
      [claveTanda('DEli', 1, '3001')]: '5',        // cobrado
      [claveCamioneta('ISMA', '3001')]: '9',
      [claveCamioneta('MARTIN', '3001')]: '1',     // ya salió
    };
    expect(cambiosBolillo(DIA, tecleado)).toEqual({
      tandas: [{ destino: 'P.REAL', tanda: 2, item_code: '3001', salio: 20 }],
      camionetas: [{ destino: 'ISMA', item_code: '3001', cantidad: 9 }],
    });
  });
  it('bajar a 0 algo que ya se había guardado SÍ viaja (corregir)', () => {
    expect(cambiosBolillo(DIA, { [claveTanda('P.REAL', 1, '3001')]: '0' }).tandas)
      .toEqual([{ destino: 'P.REAL', tanda: 1, item_code: '3001', salio: 0 }]);
  });
  it('sin bolsa de camionetas no truena', () => {
    expect(cambiosBolillo({ ...DIA, camionetas: null }, {}).camionetas).toEqual([]);
  });
});

import { bolilloDe } from './bolilloDia';
describe('bolilloDe — solo el destino elegido (08-oct)', () => {
  it('sucursal o cliente: su tarjeta, sin importar mayúsculas ni espacios', () => {
    expect(bolilloDe(DIA, 'deli')).toEqual({ destino: DIA.destinos[1], camioneta: null });
  });
  it('camioneta: la bolsa y SOLO su renglón; las demás quedan para el total', () => {
    const r = bolilloDe(DIA, 'ISMA')!;
    expect(r.destino).toBeNull();
    expect(r.camioneta!.salen.map(c => c.destino)).toEqual(['ISMA']);
    expect(r.camioneta!.todas.map(c => c.destino)).toEqual(['ISMA', 'MARTIN']);
    expect(r.camioneta!.tandas).toBe(DIA.camionetas!.tandas);
  });
  it('sin bolillo por tandas (ZAKIA, un pueblo, una camioneta sin pedido): null', () => {
    expect(bolilloDe(DIA, 'ZAKIA')).toBeNull();
    expect(bolilloDe({ ...DIA, camionetas: null }, 'ISMA')).toBeNull();
  });
});

import { partesDe, teclearParte } from './bolilloDia';
describe('charolas + sueltas = piezas (14-oct)', () => {
  const k = claveTanda('P.REAL', 2, '3002');
  it('🔴 5 charolas de telera + 7 sueltas = 67 piezas, y eso es lo que se cobra', () => {
    let tec = teclearParte({}, k, 'charolas', '5', 0, 12);
    expect(tec[k]).toBe('60');
    tec = teclearParte(tec, k, 'sueltas', '7', 0, 12);
    expect(tec[k]).toBe('67');
    expect(partesDe(tec, k, 0, 12)).toEqual({ charolas: '5', sueltas: '7' });
  });
  it('🔴 lo guardado se parte para pintarlo (67 → 5 + 7) y teclear una parte conserva la otra', () => {
    expect(partesDe({}, k, 67, 12)).toEqual({ charolas: '5', sueltas: '7' });
    expect(teclearParte({}, k, 'charolas', '6', 67, 12)[k]).toBe('79');     // 6 × 12 + 7
    expect(teclearParte({}, k, 'sueltas', '', 67, 12)[k]).toBe('60');       // borrar sueltas = 0
  });
  it('sueltas de más que una charola valen igual (15 sueltas = 15 piezas)', () => {
    expect(teclearParte({}, k, 'sueltas', '15', 0, 12)[k]).toBe('15');
  });
  it('lo tecleado viaja en «Guardar» por el total; las partes no estorban', () => {
    const tec = teclearParte({}, claveTanda('P.REAL', 1, '3001'), 'charolas', '2', 4, 16);
    expect(cambiosBolillo(DIA, tec).tandas).toEqual([{ destino: 'P.REAL', tanda: 1, item_code: '3001', salio: 36 }]);   // 2 ch + las 4 guardadas
    expect(sinDestino(tec, 'P.REAL')).toEqual({});
  });
});

describe('mananaYTarde (16-oct)', () => {
  const PZ: BolilloDia['items'] = ITEMS.map(it => ({ ...it, unidad: 'piezas' }));
  const tarde = { ...tanda(3, [0, 544]), tipo: 'TARDE' };
  const ts = [tanda(1, [64, 64]), tanda(2, [672, 128], [30, 30]), tarde];
  it('🔴 la TARDE va aparte y la suma es el total que se cobra (SANTUARIO 15-oct: 192 + 544 = 736)', () => {
    const r = mananaYTarde('SANTUARIO', ts, PZ, {});
    expect(r['3001']).toEqual({ manana: 192, tarde: 544 });
    expect(r['3001'].manana + r['3001'].tarde).toBe(totalesDestino('SANTUARIO', ts, PZ, {})['3001'].piezas);
    expect(r['3003']).toEqual({ manana: 30, tarde: 0 });
  });
  it('🔴 con lo tecleado sin guardar', () => {
    const r = mananaYTarde('SANTUARIO', ts, PZ, { [claveTanda('SANTUARIO', 3, '3001')]: '100' });
    expect(r['3001']).toEqual({ manana: 192, tarde: 100 });
  });
});
