import { describe, it, expect } from 'vitest';
import { bloquesDeHoja, cambiosEnviado, totalCapturado } from './hojaDia';
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
});
