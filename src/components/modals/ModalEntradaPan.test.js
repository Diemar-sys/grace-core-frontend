import { describe, it, expect } from 'vitest';
import { itemsPayload, calcularValor, resolverItemCode, filasDesdePedido, hoyISO, costoTexto, costoEditable } from './ModalEntradaPan';

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

const PRODUCTOS = Object.entries(CATALOGO).map(([item_code, p]) => ({ item_code, ...p }));

describe('resolverItemCode — el usuario teclea nombre, el backend recibe código', () => {
  it('resuelve por nombre, sin importar mayúsculas', () => {
    expect(resolverItemCode('BOLILLO', PRODUCTOS)).toBe('MP_BOLILLO');
    expect(resolverItemCode(' bolillo ', PRODUCTOS)).toBe('MP_BOLILLO');
  });

  it('sigue aceptando el item_code pegado', () => {
    expect(resolverItemCode('MP_MANTECADA_GDE', PRODUCTOS)).toBe('MP_MANTECADA_GDE');
  });

  it('texto a medias o vacío no resuelve nada', () => {
    expect(resolverItemCode('BOLI', PRODUCTOS)).toBe('');
    expect(resolverItemCode('', PRODUCTOS)).toBe('');
  });
});

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

/**
 * Precarga desde el pedido del día (09-sep-2026).
 *
 * Lo que protege, y por qué cada caso puede tronar de verdad:
 *  5. Un pan del pedido que ya no está en el catálogo (deshabilitado) NO puede
 *     colarse: el backend lo rechazaría y la pantalla ya no diría cuál.
 *  6. La cantidad precargada es la PEDIDA, y se guarda aparte en `pedido` para
 *     que la pantalla enseñe las dos y un número corregido se vea distinto.
 *  7. El costo sale del catálogo; sin costo se deja vacío, nunca 0 (rate 0 hunde
 *     el moving average y el backend lo rechaza).
 *  8. Sin pedido cargado no truena: devuelve lista vacía y la pantalla sigue a mano.
 */
describe('filasDesdePedido — la hoja precarga, no decide', () => {
  const RENGLONES = [
    { clave: 'MP_BOLILLO', producto: 'BOLILLO', total: 120 },
    { clave: 'MP_MANTECADA_GDE', producto: 'MANTECADA', total: 40 },
    { clave: 'MP_SIN_COSTO', producto: 'GALLETA', total: 12 },
    { clave: 'MP_BORRADO', producto: 'PAN QUE YA NO EXISTE', total: 99 },
  ];

  it('deja fuera el pan que ya no está en el catálogo', () => {
    const filas = filasDesdePedido(RENGLONES, CATALOGO);
    expect(filas.map(f => f.item_code)).not.toContain('MP_BORRADO');
    expect(filas).toHaveLength(3);
  });

  it('precarga la cantidad pedida y la conserva aparte para poder compararla', () => {
    const [bolillo] = filasDesdePedido(RENGLONES, CATALOGO);
    expect(bolillo.qty).toBe('120');
    expect(bolillo.pedido).toBe(120);
  });

  it('jala el costo del catálogo, y lo deja vacío si no hay — nunca 0', () => {
    const filas = filasDesdePedido(RENGLONES, CATALOGO);
    expect(filas.find(f => f.item_code === 'MP_BOLILLO').costo).toBe('1.8');
    expect(filas.find(f => f.item_code === 'MP_SIN_COSTO').costo).toBe('');
  });

  it('sin pedido no truena: lista vacía y la pantalla sigue sirviendo a mano', () => {
    expect(filasDesdePedido(undefined, CATALOGO)).toEqual([]);
    expect(filasDesdePedido([], CATALOGO)).toEqual([]);
  });

  it('🔴 la 2a entrada del día precarga solo lo que FALTA, no el pedido otra vez', () => {
    // Ya entraron 100 bolillos de 120 y toda la mantecada: quedan 20 bolillos y la galleta.
    const filas = filasDesdePedido(RENGLONES, CATALOGO, { MP_BOLILLO: 100, MP_MANTECADA_GDE: 40 });
    expect(filas.map(f => [f.item_code, f.qty])).toEqual([['MP_BOLILLO', '20'], ['MP_SIN_COSTO', '12']]);
    const [bolillo] = filas;
    expect(bolillo.pedido).toBe(120);
    expect(bolillo.yaEntro).toBe(100);
  });

  it('si entró MÁS de lo pedido no precarga negativos', () => {
    const filas = filasDesdePedido(RENGLONES, CATALOGO, { MP_BOLILLO: 150 });
    expect(filas.map(f => f.item_code)).not.toContain('MP_BOLILLO');
  });

  it('lo precargado pasa el filtro de itemsPayload', () => {
    const filas = filasDesdePedido(RENGLONES, CATALOGO);
    expect(itemsPayload(filas).map(i => i.item_code))
      .toEqual(['MP_BOLILLO', 'MP_MANTECADA_GDE', 'MP_SIN_COSTO']);
  });
});

describe('hoyISO — la fecha del pedido va en hora LOCAL', () => {
  it('no usa toISOString: en México eso adelanta el día después de las 18:00', () => {
    // 09-sep-2026 19:30 local. `toISOString()` diría 2026-09-10 y pediría el
    // pedido de mañana, que no existe.
    expect(hoyISO(new Date(2026, 8, 9, 19, 30))).toBe('2026-09-09');
  });
  it('rellena con cero el mes y el día', () => {
    expect(hoyISO(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});

/**
 *  9. El costo provisional es `precio × 0.35` y trae ruido de coma flotante.
 *     Sin cortarlo, el campo de dinero enseña 16 decimales.
 * 10. Un costo que no existe se queda VACÍO, nunca en '0': rate 0 mete pan
 *     gratis al inventario y el backend lo rechaza.
 */
describe('costoTexto — dinero sin ruido de coma flotante', () => {
  it('corta el ruido de precio × 0.35', () => {
    expect(costoTexto(8.7 * 0.35)).toBe('3.045');   // crudo: 3.0449999999999995
    expect(costoTexto(14 * 0.35)).toBe('4.9');
    expect(costoTexto(3.04302031)).toBe('3.043');
  });
  it('sin costo devuelve vacío, nunca cero', () => {
    expect(costoTexto(null)).toBe('');
    expect(costoTexto(0)).toBe('');
    expect(costoTexto(undefined)).toBe('');
    expect(costoTexto('')).toBe('');
  });
});

describe('costoEditable — candado del costo (10-sep): solo el Gerente teclea', () => {
  it('🔴 quien no es Gerente NO puede teclear, aunque el pan no tenga receta', () => {
    expect(costoEditable({ conReceta: false }, false)).toBe(false);
    expect(costoEditable({}, false)).toBe(false);
  });
  it('el Gerente sí, si el pan no tiene receta', () => {
    expect(costoEditable({ conReceta: false }, true)).toBe(true);
    expect(costoEditable({}, true)).toBe(true);
  });
  it('con receta nadie teclea: el costo sale de los ingredientes', () => {
    expect(costoEditable({ conReceta: true }, true)).toBe(false);
  });
});
