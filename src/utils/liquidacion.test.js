import { describe, it, expect } from 'vitest';
import { calcularLiquidacion, vendidoSinPrecio, COMISION_PCT, COMISION_FIJA } from './liquidacion';

/**
 * La venta de ruta no se captura: se deduce del inventario. Si esta aritmética
 * falla, se le cobra de más o de menos al repartidor y nadie tiene con qué
 * discutirlo. Es la razón por la que existen estos tests.
 */
const salida = (item_code, qty, precio, extra = {}) => ({ item_code, qty, precio, ...extra });

describe('calcularLiquidacion', () => {
  it('vendido = salió − regresó − mermado', () => {
    const liq = calcularLiquidacion(
      [salida('BOLILLO', 500, 3), salida('CONCHA', 200, 15)],
      [{ item_code: 'CONCHA', qty: 40 }],     // el dulce vive un día más
      [{ item_code: 'BOLILLO', qty: 60 }],    // el bolillo no se revende
    );
    const bolillo = liq.renglones.find(r => r.item_code === 'BOLILLO');
    const concha  = liq.renglones.find(r => r.item_code === 'CONCHA');
    expect(bolillo.vendido).toBe(440);
    expect(concha.vendido).toBe(160);
    expect(bolillo.importe).toBe(1320);   // 440 × 3
    expect(concha.importe).toBe(2400);    // 160 × 15
  });

  it('la comisión es 10% de la venta más la cuota fija', () => {
    const liq = calcularLiquidacion([salida('BOLILLO', 1000, 3)]);
    expect(liq.totalVenta).toBe(3000);
    expect(liq.comision).toBe(3000 * COMISION_PCT + COMISION_FIJA);  // 500
    expect(liq.neto).toBe(2500);
  });

  it('sin venta no hay cuota fija que cobrar', () => {
    // Salió todo y regresó todo: no vendió nada, no debe quedar debiendo $200.
    const liq = calcularLiquidacion(
      [salida('CONCHA', 100, 15)],
      [{ item_code: 'CONCHA', qty: 100 }],
    );
    expect(liq.totalVenta).toBe(0);
    expect(liq.comision).toBe(0);
    expect(liq.neto).toBe(0);
  });

  it('suma varias salidas del mismo producto en un solo renglón', () => {
    const liq = calcularLiquidacion([salida('BOLILLO', 300, 3), salida('BOLILLO', 200, 3)]);
    expect(liq.renglones).toHaveLength(1);
    expect(liq.renglones[0].salio).toBe(500);
    expect(liq.totalVenta).toBe(1500);
  });

  it('un vendido negativo se marca y NO baja el total', () => {
    // Regresó más de lo que salió: captura equivocada. Si se restara, se
    // escondería dentro del importe de otro producto.
    const liq = calcularLiquidacion(
      [salida('BOLILLO', 100, 3), salida('CONCHA', 100, 15)],
      [{ item_code: 'BOLILLO', qty: 130 }],
    );
    expect(liq.inconsistentes.map(r => r.item_code)).toEqual(['BOLILLO']);
    expect(liq.totalVenta).toBe(1500);   // solo la concha, el negativo no resta
  });

  it('lo que nunca salió no puede haberse vendido', () => {
    // Un regreso de un producto que no salió hoy no inventa renglón.
    const liq = calcularLiquidacion(
      [salida('BOLILLO', 100, 3)],
      [{ item_code: 'PAN_DE_MUERTO', qty: 5 }],
    );
    expect(liq.renglones.map(r => r.item_code)).toEqual(['BOLILLO']);
  });

  it('redondea el importe a centavos', () => {
    const liq = calcularLiquidacion([salida('BOLILLO', 3, 3.335)]);
    expect(liq.totalVenta).toBe(10.01);
  });
});

describe('vendidoSinPrecio', () => {
  it('delata lo que se vendió sin precio congelado', () => {
    const liq = calcularLiquidacion([salida('BOLILLO', 100, 3), salida('MISTERIO', 50, 0)]);
    expect(vendidoSinPrecio(liq).map(r => r.item_code)).toEqual(['MISTERIO']);
  });

  it('no se queja de lo que regresó completo', () => {
    const liq = calcularLiquidacion(
      [salida('MISTERIO', 50, 0)],
      [{ item_code: 'MISTERIO', qty: 50 }],
    );
    expect(vendidoSinPrecio(liq)).toEqual([]);
  });
});
