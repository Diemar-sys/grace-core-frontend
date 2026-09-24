import { describe, it, expect } from 'vitest';
import { bloquesDeHoja, cambiosEnviado, columnasDeHoja, totalCapturado } from './hojaDia';
import type { RenglonHoja } from '../services/frappeHoja';

const r = (item_code: string, categoria: string, enviado: number, precio: number): RenglonHoja => ({
  item_code, producto: item_code, departamento: 'PAN DULCE', categoria, impuesto: 'ieps',
  pedido: enviado, enviado, regreso: 0, merma: 0, precio, importe: enviado * precio,
});

describe('hojaDia — la hoja con el acomodo del Excel', () => {
  it('agrupa por categoría en el orden del servidor, con subtotal', () => {
    const b = bloquesDeHoja([r('A', 'PAN MANTECA', 2, 10), r('B', 'PAN MANTECA', 1, 5), r('C', 'GALLETA', 3, 1)]);
    expect(b.map(x => [x.categoria, x.renglones.length, x.subtotal])).toEqual([['PAN MANTECA', 2, 25], ['GALLETA', 1, 3]]);
  });
  it('🔴 el total usa lo tecleado, no lo guardado', () => {
    expect(totalCapturado([r('A', 'X', 2, 14)], { A: '30' })).toBe(420);
  });
  it('lo vacío o basura cuenta 0, no NaN', () => {
    expect(totalCapturado([r('A', 'X', 2, 14)], { A: 'abc' })).toBe(0);
  });
  it('🔴 solo manda lo que cambió y nunca un precio', () => {
    const c = cambiosEnviado([r('A', 'X', 2, 14), r('B', 'X', 5, 3)], { A: '2', B: '7' });
    expect(c).toEqual([{ item_code: 'B', enviado: 7 }]);
    expect(Object.keys(c[0])).not.toContain('precio');
  });
  it('centavos half-up', () => {
    expect(totalCapturado([r('A', 'X', 0, 3.335)], { A: '3' })).toBe(10.01);
  });
  // 23-sep: el acomodo del dibujo de Diemar, no el orden en que llegan
  it('🔴 reparte en las 4 columnas del Excel, sin importar el orden de llegada', () => {
    const b = ['PAN CONCHA', 'PASTELES', 'PIZZERIA', 'PAN MANTECA', 'PAN RELLENO', 'GALLETAS', 'PAN BLANCO']
      .map(categoria => ({ categoria, renglones: [] }));
    expect(columnasDeHoja(b).map(col => col.map(x => x.categoria))).toEqual([
      ['PAN MANTECA', 'PAN CONCHA'],
      ['PIZZERIA', 'PAN RELLENO'],
      ['GALLETAS'],
      ['PASTELES', 'PAN BLANCO'],
    ]);
  });
  it('🔴 una categoría fuera del acomodo no se esconde: va al final de la última columna', () => {
    const cols = columnasDeHoja([{ categoria: 'PAN NUEVO', renglones: [] }, { categoria: 'PASTELES', renglones: [] }]);
    expect(cols[3].map(x => x.categoria)).toEqual(['PASTELES', 'PAN NUEVO']);
  });
  // 23-sep: la camioneta casi nunca lleva pizza — fuera, salvo que ese día sí lleve
  it('🔴 camioneta sin pizza; con pizza pedida o enviada, sí sale', () => {
    const b = (categoria: string, ...rs: RenglonHoja[]) => ({ categoria, renglones: rs });
    const cats = (cols: { categoria: string }[][]) => cols.flat().map(x => x.categoria);
    const sinPizza = [b('PAN FEITE', r('A', 'PAN FEITE', 1, 1)), b('PIZZERIA', r('P', 'PIZZERIA', 0, 90))];
    expect(cats(columnasDeHoja(sinPizza, true))).toEqual(['PAN FEITE']);
    expect(cats(columnasDeHoja(sinPizza))).toEqual(['PAN FEITE', 'PIZZERIA']);   // destino normal: sí
    const enviada = [b('PIZZERIA', r('P', 'PIZZERIA', 2, 90))];
    expect(cats(columnasDeHoja(enviada, true))).toEqual(['PIZZERIA']);
    const pedida = [b('PIZZERIA', { ...r('P', 'PIZZERIA', 0, 90), pedido: 1 })];
    expect(cats(columnasDeHoja(pedida, true))).toEqual(['PIZZERIA']);
  });
});

// 23-sep: semana del estado de cuenta, lunes a domingo, en fecha LOCAL
import { semanaDe } from './hojaDia';
describe('semanaDe', () => {
  it('🔴 miércoles, domingo y lunes caen en la misma semana (lunes a domingo)', () => {
    expect(semanaDe('2026-09-23')).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' });
    expect(semanaDe('2026-09-27')).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' });
    expect(semanaDe('2026-09-21')).toEqual({ desde: '2026-09-21', hasta: '2026-09-27' });
  });
  it('🔴 moverse una semana atrás y adelante, cruzando mes y año', () => {
    expect(semanaDe('2026-09-21', -1)).toEqual({ desde: '2026-09-14', hasta: '2026-09-20' });
    expect(semanaDe('2026-09-28', 1)).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' });
    expect(semanaDe('2026-12-30')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' });
  });
});
