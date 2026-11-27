import { describe, it, expect } from 'vitest';
import { agruparPorSeccion, piezasDeTexto } from './rejilla';

const pan = (item_code: string, seccion: string | null) => ({ item_code, producto: item_code, seccion, orden: null });

describe('agruparPorSeccion', () => {
  it('respeta el orden de llegada de secciones y panes', () => {
    const s = agruparPorSeccion([pan('1', 'MANTECA'), pan('2', 'FEITE'), pan('3', 'MANTECA')]);
    expect(s.map(x => x.nombre)).toEqual(['MANTECA', 'FEITE']);
    expect(s[0].panes.map(p => p.item_code)).toEqual(['1', '3']);
  });
  it('sin sección no se pierde: va a OTROS', () => {
    expect(agruparPorSeccion([pan('9', null)])[0].nombre).toBe('OTROS');
  });
});

describe('piezasDeTexto', () => {
  it('vacío es 0 (borrar la celda)', () => expect(piezasDeTexto('  ')).toBe(0));
  it('enteros 0–9999', () => { expect(piezasDeTexto('12')).toBe(12); expect(piezasDeTexto('9999')).toBe(9999); });
  it('rechaza lo que el servidor también rechaza', () => {
    for (const malo of ['-1', '1.5', 'abc', '10000', '1e3']) expect(piezasDeTexto(malo)).toBeNull();
  });
});
