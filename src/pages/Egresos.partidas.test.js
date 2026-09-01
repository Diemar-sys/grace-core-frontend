import { describe, it, expect } from 'vitest';
import { calcTotalesPartidas, autoAgua } from './Egresos';

describe('autoAgua — proveedor autocompleta Agua', () => {
  it('Bonafont → consumo humano', () => {
    expect(autoAgua('Bonafont')).toEqual({ subcategoria: 'Agua', concepto: 'Agua para consumo humano' });
  });
  it('Pipa (cualquier caso/sufijo) → Pipa de agua', () => {
    expect(autoAgua('Pipa de agua - Abraham Martinez')).toEqual({ subcategoria: 'Agua', concepto: 'Pipa de agua' });
  });
  it('proveedor desconocido → null', () => {
    expect(autoAgua('Telmex')).toBeNull();
    expect(autoAgua('')).toBeNull();
  });
});

// Único check del agrupamiento por tasa (la suma/ajuste vive en calcularTotalesEfectivos, ya testeado).
describe('calcTotalesPartidas — agrupa bases por tasa', () => {
  it('mete cada partida en su bucket y calcula IVA/IEPS por tasa', () => {
    const { calc } = calcTotalesPartidas([
      { cantidad: 1, precio: 100, impuesto_key: 'iva16' }, // base 100, IVA 16
      { cantidad: 2, precio: 50,  impuesto_key: 'ieps'  }, // base 100, IEPS 8
      { cantidad: 1, precio: 200, impuesto_key: 'tasa0' }, // base 200, sin imp
    ]);
    expect(calc.subtotalIva16).toBe(100);
    expect(calc.subtotalIeps).toBe(100);
    expect(calc.subtotalTasa0).toBe(200);
    expect(calc.iva).toBeCloseTo(16, 6);
    expect(calc.ieps).toBeCloseTo(8, 6);
    expect(calc.subtotal).toBe(400);
  });

  it('total = subtotal + impuestos, cuadrado a 2 decimales (ajuste SAT auto)', () => {
    const { ef } = calcTotalesPartidas([{ cantidad: 1, precio: 100, impuesto_key: 'iva16' }]);
    expect(ef.total).toBeCloseTo(116, 2);
  });

  it('partida sin impuesto_key cae a tasa0', () => {
    const { calc } = calcTotalesPartidas([{ cantidad: 1, precio: 99 }]);
    expect(calc.subtotalTasa0).toBe(99);
    expect(calc.iva).toBe(0);
  });
});

/*
 * Overrides por campo (igualar Egresos a Compras). Las formas conocidas de que
 * esto mienta sin fallar: tratar un '0' tecleado como "vacio" y volver al auto;
 * ignorar el override y guardar el calculado; o que pisar un subtotal arrastre
 * el impuesto, que es justo lo que los campos separados deben evitar.
 */
describe('calcTotalesPartidas — ajuste manual por campo', () => {
  const UNA = [{ cantidad: 1, precio: 1000, impuesto_key: 'iva16' }];

  it('sin overrides todo sale del calculo', () => {
    const { ef } = calcTotalesPartidas(UNA, 0, false, {});
    expect(ef.subtotalIva16).toBe(1000);
    expect(ef.iva).toBe(160);
    expect(ef.total).toBe(1160);
  });

  it('pisar el subtotal cambia el total', () => {
    const { ef } = calcTotalesPartidas(UNA, 0, false, { subtotalIva16: '900' });
    expect(ef.subtotalIva16).toBe(900);
    expect(ef.total).toBe(1060);   // 900 + 160 de IVA
  });

  it('pisar el subtotal NO toca el impuesto', () => {
    // Son campos independientes a proposito: el CFDI puede traer una base
    // distinta con el mismo IVA. Si uno arrastrara al otro, cuadrar seria imposible.
    const { ef } = calcTotalesPartidas(UNA, 0, false, { subtotalIva16: '900' });
    expect(ef.iva).toBe(160);
  });

  it('pisar el IVA cambia el total y deja la base', () => {
    const { ef } = calcTotalesPartidas(UNA, 0, false, { iva: '155.50' });
    expect(ef.iva).toBe(155.50);
    expect(ef.subtotalIva16).toBe(1000);
    expect(ef.total).toBe(1155.50);
  });

  it("un '0' tecleado es CERO, no vacio", () => {
    // Si se tratara como vacio, poner el IVA en cero seria imposible: volveria
    // solo a 160 y quien captura no entenderia por que no le hace caso.
    const { ef } = calcTotalesPartidas(UNA, 0, false, { iva: '0' });
    expect(ef.iva).toBe(0);
    expect(ef.total).toBe(1000);
  });

  it('cadena vacia es AUTO, no cero', () => {
    const { ef } = calcTotalesPartidas(UNA, 0, false, { iva: '', subtotalIva16: '' });
    expect(ef.iva).toBe(160);
    expect(ef.subtotalIva16).toBe(1000);
  });

  it('los overrides conviven con el ajuste de cuadre', () => {
    const { ef } = calcTotalesPartidas(UNA, '0.05', true, { iva: '160' });
    expect(ef.ajusteEfectivo).toBe(0.05);
    expect(ef.total).toBeCloseTo(1160.05, 2);
  });
});
