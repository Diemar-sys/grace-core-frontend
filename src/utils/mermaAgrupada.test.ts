import { describe, expect, it } from 'vitest';
import { agruparRenglones, mermaPorGrupo, repartirMerma } from './mermaAgrupada';

const r = (item_code: string, producto: string, categoria: string, precio: number, enviado: number, extra = {}) =>
  ({ item_code, producto, departamento: 'PAN DULCE', categoria, impuesto: 'tasa0', pedido: 0, enviado, merma: 0,
    precio, importe: 0, ...extra }) as any;

const hoja = [
  r('1003', 'CHINOS', 'PAN MANTECA', 12, 20),
  r('1005', 'OJOS', 'PAN MANTECA', 12, 6),                      // misma categoría y precio, pero NO se agrupa
  r('1016', 'POLVORON NARJ', 'PAN POLVORON', 12, 2),
  r('1017', 'POLVORON CHOCO', 'PAN POLVORON', 12, 5),
  r('4003', 'MUERTO NORMAL', 'PAN TEMPORADA MUERTO', 25, 4),
  r('40031', 'MUERTO AJONJOLI', 'PAN TEMPORADA MUERTO', 25, 3),
  r('4001', 'PAN MUERTO MINI', 'PAN TEMPORADA MUERTO', 20, 8),  // otro precio: otro grupo
  r('4008', 'M. N.CHOCOLATE', 'PAN TEMPORADA MUERTO', 25, 1, { impuesto: 'ieps' }), // otro impuesto: otro grupo
];

describe('agruparRenglones (12-oct)', () => {
  it('🔴 junta solo polvorón y muerto del mismo precio e impuesto, en el orden de la hoja', () => {
    const g = agruparRenglones(hoja);
    expect(g.map(x => x.items.map(i => i.item_code))).toEqual([
      ['1003'], ['1005'], ['1016', '1017'], ['4003', '40031'], ['4001'], ['4008']]);
    const polvo = g[2];
    expect(polvo.nombre).toBe('POLVORON');
    expect(polvo.detalle).toBe('POLVORON NARJ · POLVORON CHOCO');
    expect(polvo.enviado).toBe(7);
    expect(g[0].nombre).toBe('CHINOS');
    expect(g[0].detalle).toBe('1003');
  });
});

describe('repartirMerma', () => {
  const g = agruparRenglones(hoja);
  const clave = g[2].clave;
  it('🔴 llena el primer sabor hasta lo enviado y sigue con el siguiente', () => {
    const c = repartirMerma(g, { [clave]: '4' });
    expect(c['1016'].tiro).toBe('2');
    expect(c['1017'].tiro).toBe('2');
  });
  it('🔴 lo que pasa de lo enviado se queda en el último (para que truene, no se pierda)', () => {
    const c = repartirMerma(g, { [clave]: '9' });
    expect([c['1016'].tiro, c['1017'].tiro]).toEqual(['2', '7']);
  });
  it('vacío no es cero tecleado; un pan suelto pasa su texto tal cual', () => {
    const c = repartirMerma(g, { [g[0].clave]: '1.' });
    expect(c['1016'].tiro).toBe('');
    expect(c['1003'].tiro).toBe('1.');
  });
  it('🔴 la merma guardada se suma por grupo al cargar', () => {
    const conMerma = hoja.map(x => (x.item_code === '1016' ? { ...x, merma: 1 } : x.item_code === '1017' ? { ...x, merma: 3 } : x));
    const m = mermaPorGrupo(agruparRenglones(conMerma), conMerma);
    expect(m[clave]).toBe('4');
    expect(m['1003']).toBe('');
  });
});
