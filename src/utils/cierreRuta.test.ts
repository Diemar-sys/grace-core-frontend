import { describe, it, expect } from 'vitest';
import {
  cantidad, renglonesCaptura, excesos, previsualizar, yaTuvoCierre,
  type Captura, type ResumenRuta,
} from './cierreRuta';

/**
 * Aquí se decide cuánto se le cobra al repartidor. Cada caso reproduce una forma
 * conocida de que este cierre mienta sin fallar:
 *
 *   1. Lo tecleado se convierte a número demasiado pronto y "1." o "" se vuelven
 *      cantidades (el bug del campo dual, 04-sep).
 *   2. Se manda al servidor lo que está en cero.
 *   3. Se captura más de lo que salió y el aviso llega hasta el error del server.
 *   4. Un segundo cierre ignora el primero y le cobra dos veces el mismo pan.
 */

const resumen = (extra: Partial<ResumenRuta> = {}): ResumenRuta => ({
  salidas: [
    { item_code: 'BOLILLO', item_name: 'BOLILLO', uom: 'PZA', qty: 100, precio: 4 },
    { item_code: 'CONCHA', item_name: 'CHORREADA', uom: 'PZA', qty: 40, precio: 12 },
  ],
  regresos: [],
  mermas: [],
  ...extra,
});

describe('cantidad', () => {
  it('lo que no es una cantidad vale 0', () => {
    expect(cantidad('')).toBe(0);
    expect(cantidad(undefined)).toBe(0);
    expect(cantidad('.')).toBe(0);
    expect(cantidad('abc')).toBe(0);
    expect(cantidad('-5')).toBe(0);   // negativo no es "devolver al revés"
    expect(cantidad('0')).toBe(0);
  });

  it('acepta decimales a medio teclear sin romperse', () => {
    expect(cantidad('1.')).toBe(1);
    expect(cantidad('0.5')).toBe(0.5);
    expect(cantidad('12.75')).toBe(12.75);
  });
});

describe('renglonesCaptura', () => {
  it('solo manda lo que tiene cantidad', () => {
    const captura: Captura = {
      BOLILLO: { regresa: '', tiro: '30' },
      CONCHA: { regresa: '12', tiro: '' },
      OTRO: { regresa: '', tiro: '' },
      TAMBIEN: { regresa: '0', tiro: '0' },
    };
    expect(renglonesCaptura(captura)).toEqual([
      { item_code: 'BOLILLO', regresa: 0, tiro: 30 },
      { item_code: 'CONCHA', regresa: 12, tiro: 0 },
    ]);
  });
});

describe('excesos', () => {
  it('avisa cuando regresa + tiró pasan lo que salió', () => {
    expect(excesos(resumen().salidas, { BOLILLO: { regresa: '60', tiro: '41' } })).toEqual(['BOLILLO']);
  });

  it('el límite exacto no es un exceso', () => {
    expect(excesos(resumen().salidas, { BOLILLO: { regresa: '60', tiro: '40' } })).toEqual([]);
  });

  it('no confunde el polvo binario con un exceso', () => {
    // 0.1 + 0.2 = 0.30000000000000004 en binario. Sin margen, esto "excedía" 0.3.
    const salidas = [{ item_code: 'PAN', qty: 0.3, precio: 1 }];
    expect(excesos(salidas, { PAN: { regresa: '0.1', tiro: '0.2' } })).toEqual([]);
  });

  it('marca un producto que no salió hoy', () => {
    expect(excesos(resumen().salidas, { PIZZA: { regresa: '1', tiro: '' } })).toEqual(['PIZZA']);
  });

  it('los ceros no disparan aviso aunque el producto no exista', () => {
    expect(excesos(resumen().salidas, { PIZZA: { regresa: '0', tiro: '' } })).toEqual([]);
  });
});

describe('previsualizar', () => {
  it('descuenta lo tecleado de lo que salió', () => {
    const liq = previsualizar(resumen(), {
      BOLILLO: { regresa: '', tiro: '30' },
      CONCHA: { regresa: '12', tiro: '' },
    });
    const bolillo = liq.renglones.find(r => r.item_code === 'BOLILLO')!;
    const concha = liq.renglones.find(r => r.item_code === 'CONCHA')!;
    expect(bolillo.vendido).toBe(70);          // 100 − 0 − 30
    expect(concha.vendido).toBe(28);           // 40 − 12 − 0
    expect(liq.totalVenta).toBe(616);          // 70×4 + 28×12
  });

  it('un segundo cierre NO ignora el primero', () => {
    // Ya se habían registrado 20 de regreso: si se ignoran, le cobras esos 20.
    const conCierrePrevio = resumen({ regresos: [{ item_code: 'BOLILLO', qty: 20 }] });
    const liq = previsualizar(conCierrePrevio, { BOLILLO: { regresa: '30', tiro: '' } });
    const bolillo = liq.renglones.find(r => r.item_code === 'BOLILLO')!;
    expect(bolillo.regreso).toBe(50);
    expect(bolillo.vendido).toBe(50);
  });

  it('sin capturar nada, vendido = todo lo que salió', () => {
    const liq = previsualizar(resumen(), {});
    expect(liq.totalVenta).toBe(880);          // 100×4 + 40×12
  });
});

describe('yaTuvoCierre', () => {
  it('distingue un día virgen de uno ya cerrado', () => {
    expect(yaTuvoCierre(resumen())).toBe(false);
    expect(yaTuvoCierre(resumen({ mermas: [{ item_code: 'BOLILLO', qty: 1 }] }))).toBe(true);
    expect(yaTuvoCierre(resumen({ regresos: [{ item_code: 'BOLILLO', qty: 1 }] }))).toBe(true);
  });
});
