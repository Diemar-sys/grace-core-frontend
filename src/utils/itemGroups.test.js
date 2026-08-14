import { describe, it, expect } from 'vitest';
import { hojasDe, bucketsCategorias } from './itemGroups';

/**
 * El árbol de abajo copia la forma real de prod: PT con departamentos que a su
 * vez tienen categorías, y hojas que cuelgan directo del departamento raíz.
 * Los lft/rgt están numerados como los numera ERPNext (recorrido en preorden).
 */
const g = (name, parent, is_group, lft, rgt) => ({ name, parent_item_group: parent, is_group, lft, rgt });

const ARBOL = [
  g('All Item Groups', '', 1, 1, 30),
  g('HARINA', 'All Item Groups', 0, 2, 3),
  g('AZUCAR', 'All Item Groups', 0, 4, 5),
  g('PRODUCTOS TERMINADOS', 'All Item Groups', 1, 6, 21),
  g('PAN BLANCO', 'PRODUCTOS TERMINADOS', 0, 7, 8),      // hoja directa
  g('PIZZERIA', 'PRODUCTOS TERMINADOS', 0, 9, 10),       // hoja directa
  g('PANQUELERIA', 'PRODUCTOS TERMINADOS', 1, 11, 14),   // departamento
  g('PAN MANTECA', 'PANQUELERIA', 0, 12, 13),            // categoría a 2 niveles
  g('REPOSTERIA', 'PRODUCTOS TERMINADOS', 1, 15, 20),
  g('GALLETAS', 'REPOSTERIA', 0, 16, 17),
  g('PAN POSTRE', 'REPOSTERIA', 0, 18, 19),
  g('INSUMOS GENERALES', 'All Item Groups', 1, 22, 27),
  g('LIMPIEZA', 'INSUMOS GENERALES', 0, 23, 24),
  g('PAPELERIA', 'INSUMOS GENERALES', 0, 25, 26),
  g('CARNES', 'All Item Groups', 0, 28, 29),
];

describe('hojasDe', () => {
  it('agarra las categorías a cualquier profundidad, no solo las hijas directas', () => {
    const nombres = hojasDe(ARBOL, 'PRODUCTOS TERMINADOS').map(x => x.name).sort();
    expect(nombres).toEqual(['GALLETAS', 'PAN BLANCO', 'PAN MANTECA', 'PAN POSTRE', 'PIZZERIA']);
  });

  it('deja fuera los departamentos: no se le cuelga un pan a una carpeta', () => {
    const nombres = hojasDe(ARBOL, 'PRODUCTOS TERMINADOS').map(x => x.name);
    expect(nombres).not.toContain('PANQUELERIA');
    expect(nombres).not.toContain('REPOSTERIA');
  });

  it('un departamento como raíz devuelve solo lo suyo', () => {
    expect(hojasDe(ARBOL, 'REPOSTERIA').map(x => x.name).sort())
      .toEqual(['GALLETAS', 'PAN POSTRE']);
  });

  it('raíz inexistente o sin nested set: lista vacía, no la del vecino', () => {
    expect(hojasDe(ARBOL, 'NO EXISTE')).toEqual([]);
    expect(hojasDe([{ name: 'X', is_group: 1 }], 'X')).toEqual([]);
    expect(hojasDe(undefined, 'PRODUCTOS TERMINADOS')).toEqual([]);
  });
});

describe('bucketsCategorias', () => {
  const { pt, ig, resto } = bucketsCategorias(ARBOL, 'PRODUCTOS TERMINADOS', 'INSUMOS GENERALES');

  it('separa las tres familias sin traslapes', () => {
    expect(pt.map(x => x.name).sort())
      .toEqual(['GALLETAS', 'PAN BLANCO', 'PAN MANTECA', 'PAN POSTRE', 'PIZZERIA']);
    expect(ig.map(x => x.name).sort()).toEqual(['LIMPIEZA', 'PAPELERIA']);
    expect(resto.map(x => x.name).sort()).toEqual(['AZUCAR', 'CARNES', 'HARINA']);
  });

  it('el bucket de materia prima NO se traga las categorías de pan', () => {
    // Éste es el bug que se arregló: con el filtro por padre directo, PAN MANTECA
    // caía aquí porque su padre no era PRODUCTOS TERMINADOS.
    expect(resto.map(x => x.name)).not.toContain('PAN MANTECA');
    expect(resto.map(x => x.name)).not.toContain('GALLETAS');
  });

  it('cada hoja cae en exactamente un bucket', () => {
    const total = pt.length + ig.length + resto.length;
    expect(total).toBe(ARBOL.filter(x => !x.is_group).length);
  });
});
