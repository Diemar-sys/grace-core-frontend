import { describe, it, expect } from 'vitest';
import { filtrarPanes, categoriasDePanes, calcularMargen } from './Catalogo.jsx';

const PANES = [
  { item_code: '1001', item_name: 'MANTECADA GDE', item_group: 'PAN MANTECA' },
  { item_code: '1005', item_name: 'OJOS', item_group: 'PAN MANTECA' },
  { item_code: '20021', item_name: 'PASTEL GRANDE OREO', item_group: 'PASTELES' },
  { item_code: '102311', item_name: 'CH. C/CHISPAS', item_group: 'GALLETAS' },
];

describe('filtrarPanes', () => {
  it('sin filtros devuelve todo', () => {
    expect(filtrarPanes(PANES, '', '')).toHaveLength(4);
  });

  it('filtra por categoría exacta', () => {
    const r = filtrarPanes(PANES, 'PAN MANTECA', '');
    expect(r.map(p => p.item_code)).toEqual(['1001', '1005']);
  });

  it('busca por nombre sin importar mayúsculas', () => {
    expect(filtrarPanes(PANES, '', 'oreo').map(p => p.item_code)).toEqual(['20021']);
  });

  it('busca por clave, que es lo que teclea el mostrador', () => {
    expect(filtrarPanes(PANES, '', '102311').map(p => p.item_name)).toEqual(['CH. C/CHISPAS']);
  });

  it('categoría y búsqueda se combinan con AND, no con OR', () => {
    // Con OR esto devolvería los 2 de PAN MANTECA más el pastel.
    expect(filtrarPanes(PANES, 'PAN MANTECA', 'oreo')).toHaveLength(0);
  });

  it('espacios sueltos no vacían la lista', () => {
    expect(filtrarPanes(PANES, '', '   ')).toHaveLength(4);
  });

  it('aguanta lista vacía o sin cargar', () => {
    expect(filtrarPanes([], '', '')).toEqual([]);
    expect(filtrarPanes(undefined, 'PASTELES', 'x')).toEqual([]);
  });
});

describe('categoriasDePanes', () => {
  it('cuenta por categoría y ordena alfabéticamente', () => {
    expect(categoriasDePanes(PANES)).toEqual([
      ['GALLETAS', 1], ['PAN MANTECA', 2], ['PASTELES', 1],
    ]);
  });

  it('ignora panes sin categoría en vez de inventar una vacía', () => {
    expect(categoriasDePanes([...PANES, { item_code: 'X', item_name: 'X' }]))
      .toHaveLength(3);
  });
});

describe('calcularMargen', () => {
  it('deja lo que sobra del precio de venta', () => {
    const m = calcularMargen(10, 4);
    expect(m.pesos).toBe(6);
    expect(m.pct).toBe(60);
    expect(m.bajoCosto).toBe(false);
  });

  it('marca bajoCosto cuando cuesta más de lo que se vende', () => {
    const m = calcularMargen(4, 6);
    expect(m.pesos).toBe(-2);
    expect(m.bajoCosto).toBe(true);
  });

  it('sin costo devuelve null, no 100% de margen', () => {
    expect(calcularMargen(10, 0)).toBeNull();
    expect(calcularMargen(10, null)).toBeNull();
    expect(calcularMargen(10, undefined)).toBeNull();
  });

  it('sin precio de venta devuelve null', () => {
    expect(calcularMargen(0, 4)).toBeNull();
    expect(calcularMargen(null, 4)).toBeNull();
  });

  it('vender exactamente al costo NO es bajo costo, pero deja 0', () => {
    const m = calcularMargen(5, 5);
    expect(m.pesos).toBe(0);
    expect(m.bajoCosto).toBe(false);
  });
});
