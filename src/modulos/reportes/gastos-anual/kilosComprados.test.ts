import { describe, it, expect } from 'vitest';
import { armarKilos, csvKilos, type FilaKilos } from './kilosComprados';

// Lo que puede mentir: sumar Kg con L, mezclar cuentas al filtrar, poner el
// mes en la columna equivocada, partir un insumo en dos renglones, o un CSV
// que Excel abre con acentos rotos o columnas corridas por una coma.
const f = (mes: string, cuenta: FilaKilos['cuenta'], item_code: string, uom: string, cantidad: number,
  item_group = 'HARINA', item_name = item_code): FilaKilos => ({ mes, cuenta, item_code, item_name, item_group, uom, cantidad });

const FILAS = [
  f('2026-10', 'luis', 'H1', 'Kg', 100, 'HARINA', 'HARINA TRIGO'),
  f('2026-10', 'sinFactura', 'H1', 'Kg', 20, 'HARINA', 'HARINA TRIGO'),
  f('2026-11', 'luis', 'H1', 'Kg', 30, 'HARINA', 'HARINA TRIGO'),
  f('2026-01', 'alma', 'H2', 'Kg', 5, 'HARINA', 'HARINA INTEGRAL'),
  f('2026-10', 'luis', 'LECHE', 'L', 40, 'LACTEOS', 'LECHE'),
  f('2026-10', 'luis', 'CREMA', 'Kg', 3, 'LACTEOS', 'CREMA, ÁCIDA "LALA"'),
];

describe('armarKilos', () => {
  it('todas: suma cuentas por insumo y mes, un renglón por insumo', () => {
    const [harina] = armarKilos(FILAS, 'todas');
    expect(harina.categoria).toBe('HARINA');
    const trigo = harina.items.find(i => i.item_code === 'H1')!;
    expect(trigo.meses[9]).toBe(120);
    expect(trigo.meses[10]).toBe(30);
    expect(trigo.total).toBe(150);
    expect(harina.items).toHaveLength(2);
    expect(harina.totales.Kg[9]).toBe(120);
    expect(harina.totales.Kg[0]).toBe(5);
  });

  it('filtra por cuenta sin colar las otras', () => {
    const [harina] = armarKilos(FILAS, 'luis');
    expect(harina.items.map(i => i.item_code)).toEqual(['H1']);
    expect(harina.items[0].meses[9]).toBe(100);
    expect(armarKilos(FILAS, 'alma').map(c => c.categoria)).toEqual(['HARINA']);
  });

  it('Kg y L no se suman: la categoría lleva un total por unidad', () => {
    const lacteos = armarKilos(FILAS, 'todas').find(c => c.categoria === 'LACTEOS')!;
    expect(lacteos.totales.Kg[9]).toBe(3);
    expect(lacteos.totales.L[9]).toBe(40);
  });

  it('orden: categorías e insumos alfabéticos', () => {
    const cats = armarKilos(FILAS, 'todas');
    expect(cats.map(c => c.categoria)).toEqual(['HARINA', 'LACTEOS']);
    expect(cats[0].items.map(i => i.item_name)).toEqual(['HARINA INTEGRAL', 'HARINA TRIGO']);
  });

  it('mes basura no truena ni se cuela', () => {
    expect(armarKilos([f('2026-13', 'luis', 'X', 'Kg', 9), f('', 'luis', 'X', 'Kg', 9)], 'todas')
      .flatMap(c => c.items)).toEqual([]);
  });
});

describe('csvKilos', () => {
  const csv = csvKilos(armarKilos(FILAS, 'todas'));
  const lineas = csv.replace('﻿', '').split('\r\n');
  it('BOM para Excel y encabezado con los 12 meses', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lineas[0]).toBe('Categoría,Insumo,Clave,Unidad,Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct,Nov,Dic,Total');
  });
  it('un renglón por insumo con sus números en el mes correcto', () => {
    expect(lineas).toHaveLength(5);
    expect(lineas).toContain('HARINA,HARINA TRIGO,H1,Kg,0,0,0,0,0,0,0,0,0,120,30,0,150');
  });
  it('comas y comillas en el nombre no corren las columnas', () => {
    expect(lineas).toContain('LACTEOS,"CREMA, ÁCIDA ""LALA""",CREMA,Kg,0,0,0,0,0,0,0,0,0,3,0,0,3');
  });
});
