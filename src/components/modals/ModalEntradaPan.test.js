import { describe, it, expect } from 'vitest';
import { itemsPayload, calcularValor } from './ModalEntradaPan';

/**
 * Reglas que se están probando, en español:
 *  1. Solo se mandan renglones con producto Y cantidad > 0 (los vacíos se ignoran).
 *  2. Si el usuario teclea un costo, ese manda sobre el del catálogo.
 *  3. Si no teclea costo, se usa el del catálogo.
 *  4. Si no hay costo en ningún lado, el renglón vale 0 y NO se manda costo
 *     inventado: el backend lo rechaza (rate 0 hunde el moving average).
 */
const CATALOGO = {
  MP_BOLILLO:       { item_name: 'BOLILLO',   custom_costo_estimado: 1.8 },
  MP_MANTECADA_GDE: { item_name: 'MANTECADA', custom_costo_estimado: 6.5 },
  MP_SIN_COSTO:     { item_name: 'GALLETA',   custom_costo_estimado: null },
};

describe('itemsPayload — qué renglones llegan al backend', () => {
  it('descarta renglones sin producto o sin cantidad', () => {
    const filas = [
      { _id: 1, item_code: 'MP_BOLILLO', qty: '10', costo: '' },
      { _id: 2, item_code: '', qty: '5', costo: '' },
      { _id: 3, item_code: 'MP_MANTECADA_GDE', qty: '', costo: '' },
      { _id: 4, item_code: 'MP_BOLILLO', qty: '0', costo: '' },
    ];
    expect(itemsPayload(filas)).toEqual([{ item_code: 'MP_BOLILLO', qty: 10 }]);
  });

  it('manda el costo solo cuando el usuario lo tecleó', () => {
    const filas = [
      { _id: 1, item_code: 'MP_BOLILLO', qty: '10', costo: '2.5' },
      { _id: 2, item_code: 'MP_MANTECADA_GDE', qty: '3', costo: '' },
    ];
    expect(itemsPayload(filas)).toEqual([
      { item_code: 'MP_BOLILLO', qty: 10, costo: 2.5 },
      { item_code: 'MP_MANTECADA_GDE', qty: 3 },
    ]);
  });
});

describe('calcularValor — el costo tecleado manda sobre el catálogo', () => {
  it('sin costo tecleado usa el del catálogo', () => {
    expect(calcularValor([{ item_code: 'MP_BOLILLO', qty: '100', costo: '' }], CATALOGO))
      .toBe(180);
  });

  it('con costo tecleado ignora el del catálogo', () => {
    expect(calcularValor([{ item_code: 'MP_BOLILLO', qty: '100', costo: '2' }], CATALOGO))
      .toBe(200);
  });

  it('suma renglones mezclando ambas fuentes', () => {
    const filas = [
      { item_code: 'MP_BOLILLO', qty: '100', costo: '' },      // 100 × 1.8 catálogo
      { item_code: 'MP_MANTECADA_GDE', qty: '20', costo: '6.5' }, // 20 × 6.5 tecleado
    ];
    expect(calcularValor(filas, CATALOGO)).toBe(310);
  });

  it('producto sin costo en ningún lado aporta 0, no un costo inventado', () => {
    expect(calcularValor([{ item_code: 'MP_SIN_COSTO', qty: '5', costo: '' }], CATALOGO))
      .toBe(0);
  });

  it('renglones vacíos no aportan', () => {
    expect(calcularValor([{ item_code: '', qty: '10', costo: '5' }], CATALOGO)).toBe(0);
    expect(calcularValor([{ item_code: 'MP_BOLILLO', qty: '', costo: '5' }], CATALOGO)).toBe(0);
  });
});
