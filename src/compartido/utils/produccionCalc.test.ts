import { describe, it, expect } from 'vitest';
import { factorProduccion, escalarIngrediente, costearLineas } from './produccionCalc';

describe('produccionCalc — factorProduccion (donde vivió el −$1M)', () => {
  it('produce el doble del BOM → factor 2', () => {
    expect(factorProduccion(20, 10)).toBe(2);
  });
  it('produce la mitad → factor 0.5', () => {
    expect(factorProduccion(5, 10)).toBe(0.5);
  });
  it('BOM base = misma cantidad → factor 1', () => {
    expect(factorProduccion(10, 10)).toBe(1);
  });
  it('bomQuantity 0 o inválida → base 1 (el BOM produce una tanda), no división por cero', () => {
    expect(factorProduccion(7, 0)).toBe(7);
    expect(factorProduccion(7, 'x' as unknown as number)).toBe(7);
  });
  it('cantidad producida inválida → factor 0 (aguas abajo qtyNum truena, no mueve basura)', () => {
    expect(factorProduccion('' as unknown as number, 10)).toBe(0);
    expect(factorProduccion(NaN, 10)).toBe(0);
  });
  it('acepta strings (vienen del form)', () => {
    expect(factorProduccion('30', '10')).toBe(3);
  });
});

describe('produccionCalc — escalarIngrediente', () => {
  it('escala la cantidad base por el factor', () => {
    expect(escalarIngrediente(2.5, 4)).toBe(10);
  });
  it('factor 0 → consumo 0 (producción inválida no consume insumo)', () => {
    expect(escalarIngrediente(2.5, 0)).toBe(0);
  });
  it('qty base inválida → 0', () => {
    expect(escalarIngrediente('' as unknown as number, 3)).toBe(0);
  });
});

describe('produccionCalc — costearLineas (antes duplicado en 2 métodos)', () => {
  it('suma costo por línea y calcula unitario', () => {
    // 3kg × $10 + 0.5kg × $40 = 30 + 20 = 50; entre 10 unidades = 5/u
    const r = costearLineas(
      [{ qty: 3, precio_final: 10 }, { qty: 0.5, precio_final: 40 }],
      10,
    );
    expect(r.costoTotal).toBe(50);
    expect(r.costoPorUnidad).toBe(5);
    expect(r.detalle).toEqual([
      { qty: 3, precio_final: 10, costo: 30 },
      { qty: 0.5, precio_final: 40, costo: 20 },
    ]);
  });
  it('cantidadProducida 0 o inválida → cae a 1, no divide por cero', () => {
    const r = costearLineas([{ qty: 2, precio_final: 7 }], 0);
    expect(r.costoTotal).toBe(14);
    expect(r.costoPorUnidad).toBe(14); // /1, no Infinity
  });
  it('precio o qty faltante → esa línea cuesta 0, no NaN que contamine el total', () => {
    const r = costearLineas(
      [{ qty: 2, precio_final: undefined as unknown as number }, { qty: 3, precio_final: 5 }],
      1,
    );
    expect(r.costoTotal).toBe(15);
    expect(Number.isNaN(r.costoTotal)).toBe(false);
  });
  it('lista vacía → todo 0', () => {
    const r = costearLineas([], 5);
    expect(r).toEqual({ costoTotal: 0, costoPorUnidad: 0, detalle: [] });
  });
  it('acepta strings del form', () => {
    const r = costearLineas([{ qty: '4', precio_final: '2.5' }], '2');
    expect(r.costoTotal).toBe(10);
    expect(r.costoPorUnidad).toBe(5);
  });
});
