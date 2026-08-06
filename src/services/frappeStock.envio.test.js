import { describe, it, expect, beforeEach, vi } from 'vitest';
import FrappeStockService from './frappeStock';
import { BODEGA_CENTRAL } from '../config/constants';

// Un almacén de producción real (el pan sale de aquí, no de Bodega Central).
const ALMACEN_PAN = 'ALMACEN - PAN BLANCO - PG';

/**
 * El origen del traspaso es un camino de stock: mandar el envío desde el almacén
 * equivocado descuadra dos inventarios a la vez. Antes salía siempre de Bodega
 * Central (hardcodeado); ahora lo elige quien envía y el pan sale de su propio
 * almacén. Este es el único check que falla si eso se rompe.
 */
describe('crearTransferenciaSucursal — almacén de origen', () => {
  let svc;
  let payloads;

  beforeEach(() => {
    svc = new FrappeStockService();
    payloads = [];
    // _fetch captura el POST; devuelve el doc que espera el llamador.
    svc._fetch = vi.fn(async (path, options) => {
      if (options?.body) payloads.push(JSON.parse(options.body));
      return { data: { name: 'MAT-STE-TEST-0001' } };
    });
  });

  const enviar = (extra) => svc.crearTransferenciaSucursal({
    warehouseDestino: 'CAMIONETA - ISMA - PG',
    items: [{ item_code: 'MP_BOLILLO', qty: 30, uom: 'PZA', precio_venta_congelado: 4 }],
    asBorrador: true,
    ...extra,
  });

  it('sin origen explícito sale de Bodega Central (comportamiento de siempre)', async () => {
    await enviar({});
    const p = payloads[0];
    expect(p.from_warehouse).toBe(BODEGA_CENTRAL);
    expect(p.items[0].s_warehouse).toBe(BODEGA_CENTRAL);
  });

  it('con origen explícito el pan sale de su almacén, no de Bodega Central', async () => {
    await enviar({ warehouseOrigen: ALMACEN_PAN });
    const p = payloads[0];
    expect(p.from_warehouse).toBe(ALMACEN_PAN);
    expect(p.items[0].s_warehouse).toBe(ALMACEN_PAN);
    expect(p.to_warehouse).toBe('CAMIONETA - ISMA - PG');
  });

  it('el origen se aplica a TODOS los renglones, no solo al primero', async () => {
    await svc.crearTransferenciaSucursal({
      warehouseDestino: 'TIENDA - PUERTA - PG',
      warehouseOrigen: ALMACEN_PAN,
      items: [
        { item_code: 'MP_BOLILLO', qty: 10, uom: 'PZA', precio_venta_congelado: 4 },
        { item_code: 'MP_MANTECADA_GDE', qty: 5, uom: 'PZA', precio_venta_congelado: 14 },
      ],
      asBorrador: true,
    });
    const p = payloads[0];
    expect(p.items.map(i => i.s_warehouse)).toEqual([ALMACEN_PAN, ALMACEN_PAN]);
  });

  it('origen vacío se rechaza en vez de caer a un almacén silencioso', async () => {
    await expect(enviar({ warehouseOrigen: '' })).rejects.toThrow(/origen/i);
  });
});

/**
 * El pan que reparte la camioneta se vende en los pueblos a otro precio. El
 * precio se CONGELA en el traspaso, así que equivocarlo aquí desalinea la
 * liquidación de la ruta entera: se cobraría al precio de mostrador pan que se
 * vendió más barato.
 */
describe('crearTransferenciaSucursal — precio según el destino', () => {
  const CATALOGO = {
    MP_BOLILLO: {
      item_code: 'MP_BOLILLO',
      custom_cantidad_por_presentación: 1,
      custom_precio_de_venta: 4,
      custom_precio_de_venta_pueblos: 3.5,
    },
    // Sin precio de pueblos capturado: tiene que caer al normal, no a 0.
    MP_CONCHA: {
      item_code: 'MP_CONCHA',
      custom_cantidad_por_presentación: 1,
      custom_precio_de_venta: 18,
    },
  };

  let svc;
  let payloads;

  beforeEach(() => {
    svc = new FrappeStockService();
    payloads = [];
    svc.fetchAlmacenes = vi.fn(async () => [
      { name: 'CAMIONETA - ISMA - PG', warehouse_type: 'CAMIONETA' },
      { name: 'TIENDA - PUERTA - PG',  warehouse_type: 'SUCURSAL' },
    ]);
    svc._fetch = vi.fn(async (path, options) => {
      if (options?.body) { payloads.push(JSON.parse(options.body)); return { data: { name: 'MAT-STE-TEST-0001' } }; }
      // GET del catálogo: devuelve los items pedidos.
      return { data: Object.values(CATALOGO) };
    });
  });

  // Sin `precio_venta_congelado` el servicio resuelve el precio él solo.
  const enviarA = (warehouseDestino, item_code = 'MP_BOLILLO') =>
    svc.crearTransferenciaSucursal({
      warehouseDestino,
      warehouseOrigen: ALMACEN_PAN,
      items: [{ item_code, qty: 100, uom: 'PZA' }],
      asBorrador: true,
    });

  it('a camioneta congela el precio de pueblos', async () => {
    await enviarA('CAMIONETA - ISMA - PG');
    expect(payloads[0].items[0].custom_precio_venta).toBe(3.5);
  });

  it('a sucursal congela el precio normal, no el de pueblos', async () => {
    await enviarA('TIENDA - PUERTA - PG');
    expect(payloads[0].items[0].custom_precio_venta).toBe(4);
  });

  it('sin precio de pueblos capturado cae al normal, nunca a 0', async () => {
    await enviarA('CAMIONETA - ISMA - PG', 'MP_CONCHA');
    expect(payloads[0].items[0].custom_precio_venta).toBe(18);
  });

  it('el precio que ya viene congelado manda sobre la regla del destino', async () => {
    await svc.crearTransferenciaSucursal({
      warehouseDestino: 'CAMIONETA - ISMA - PG',
      warehouseOrigen: ALMACEN_PAN,
      items: [{ item_code: 'MP_BOLILLO', qty: 100, uom: 'PZA', precio_venta_congelado: 9 }],
      asBorrador: true,
    });
    expect(payloads[0].items[0].custom_precio_venta).toBe(9);
    expect(svc.fetchAlmacenes).not.toHaveBeenCalled();  // ni se molesta en preguntar
  });
});
