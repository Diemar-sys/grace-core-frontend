import { coincidePan, normalizarBusqueda } from './buscarPan';

describe('buscador de pan', () => {
  it('sin acentos ni mayúsculas, por nombre o por clave', () => {
    const q = normalizarBusqueda('  Piña ');
    expect(q).toBe('pina');
    expect(coincidePan(q, 'P. PIÑA COLADA', '1010')).toBe(true);
    expect(coincidePan(normalizarBusqueda('1027'), 'DONA CHOCOLATE', '1027')).toBe(true);
    expect(coincidePan(normalizarBusqueda('dona'), 'BOLA DE BERLIN', '1028')).toBe(false);
  });

  it('búsqueda vacía enseña todo; campo vacío no truena', () => {
    expect(coincidePan('', 'CHINOS')).toBe(true);
    expect(coincidePan('chi', undefined, null, 'CHINOS')).toBe(true);
  });
});
