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
 * El mismo pan vale distinto según a dónde va: sucursal (urbano, el más alto),
 * pueblos (puntos fijos) y camioneta (rutas a ranchos). El precio se CONGELA en
 * el traspaso, así que equivocarlo aquí desalinea la liquidación de la ruta
 * entera: se cobraría al precio de mostrador pan que se vendió más barato.
 */
describe('crearTransferenciaSucursal — precio según el destino', () => {
  const CATALOGO = {
    MP_BOLILLO: {
      item_code: 'MP_BOLILLO',
      custom_cantidad_por_presentación: 1,
      custom_precio_de_venta: 4,
      custom_precio_de_venta_pueblos: 3.5,
      custom_precio_de_venta_camioneta: 3,
    },
    // Sin precio propio capturado: tiene que caer al normal, no a 0.
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
      { name: 'CAMIONETA - ISMA - PG',      warehouse_type: 'CAMIONETA' },
      { name: 'PUNTO VENTA - MILAGRO - PG', warehouse_type: 'PUNTO DE VENTA' },
      { name: 'TIENDA - PUERTA - PG',       warehouse_type: 'SUCURSAL' },
      // Un almacén sin tipo: cae a precio normal. Es la trampa a vigilar.
      { name: 'TIENDA - PANQUELERIA - PG',  warehouse_type: null },
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

  it('a camioneta congela SU precio, no el de pueblos', async () => {
    // Antes las camionetas usaban el precio de pueblos porque era el único campo
    // que existía. Son canales distintos: la ruta cobra más barato que el punto fijo.
    await enviarA('CAMIONETA - ISMA - PG');
    expect(payloads[0].items[0].custom_precio_venta).toBe(3);
  });

  it('a punto de venta de pueblo congela el precio de pueblos', async () => {
    await enviarA('PUNTO VENTA - MILAGRO - PG');
    expect(payloads[0].items[0].custom_precio_venta).toBe(3.5);
  });

  it('a sucursal congela el precio normal, el más alto', async () => {
    await enviarA('TIENDA - PUERTA - PG');
    expect(payloads[0].items[0].custom_precio_venta).toBe(4);
  });

  it('sin precio propio capturado cae al normal, nunca a 0', async () => {
    await enviarA('CAMIONETA - ISMA - PG', 'MP_CONCHA');
    expect(payloads[0].items[0].custom_precio_venta).toBe(18);
  });

  it('un almacén SIN tipo cobra precio normal', async () => {
    // No es lo deseable, pero es lo que pasa: por eso los almacenes nuevos hay
    // que tiparlos o cobran de más sin que nadie lo note.
    await enviarA('TIENDA - PANQUELERIA - PG');
    expect(payloads[0].items[0].custom_precio_venta).toBe(4);
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

/**
 * Un envío a sucursal es un TRASPASO: se valúa al COSTO al que ERPNext lo sacó
 * de la bodega, no al precio de venta congelado.
 *
 * El bug real (2026-09-02, envío MAT-STE-2026-00072 a PIRÁMIDES): la pantalla
 * decía $624.79 cuando habían salido $3,546.34 de Bodega Central. Los insumos
 * sin precio de venta —2,000 bolsas de papel, 5 L de brillo— salían en $0.00 y
 * ni siquiera entraban al total. Y los que SÍ tenían precio mentían en los dos
 * sentidos: la leche a $35 cuando costó $330.42 (el precio se dividía entre
 * cant_pres), y PUERTA acumulaba $11,677 de "precio" contra $8,193 de costo.
 *
 * Casos = las tres formas conocidas de que esta valuación mienta sin fallar.
 */
describe('getTransferenciasSucursal — valúa al costo, no al precio de venta', () => {
  let svc;

  const montarDoc = (items) => {
    svc = new FrappeStockService();
    svc._fetch = vi.fn(async (path) => {
      if (path.includes('/api/resource/Stock Entry?')) {
        return { data: [{ name: 'MAT-STE-1', posting_date: '2026-09-02', docstatus: 1 }] };
      }
      return { data: { items } };
    });
    return svc.getTransferenciasSucursal({ warehouseDestino: 'TIENDA - PIRAMIDES - PG' });
  };

  it('un insumo SIN precio de venta ya no vale cero: vale lo que costó', async () => {
    // 2,000 bolsas de papel a $0.4384. Antes: $0.00 y fuera del total.
    const [envio] = await montarDoc([
      { item_code: 'BOLSA12', item_name: 'BOLSA PAPEL FABOLSA NO.12', qty: 2000,
        stock_uom: 'PZA', basic_rate: 0.4384, amount: 876.72, custom_precio_venta: 0 },
    ]);
    expect(envio.items[0].costoUnit).toBe(0.4384);
    expect(envio.items[0].monto).toBe(876.72);
    expect(envio.totalMonto).toBe(876.72);
  });

  it('ignora el precio de venta congelado aunque venga cargado', async () => {
    // La leche: precio congelado 2.92 (35 ÷ 12) contra un costo real de 27.535.
    const [envio] = await montarDoc([
      { item_code: 'LECHE', item_name: 'LECHE LALA LIGHT 1LT (12 PZS)', qty: 12,
        stock_uom: 'PZA', basic_rate: 27.535, amount: 330.42, custom_precio_venta: 2.9166 },
    ]);
    expect(envio.items[0].costoUnit).toBe(27.535);
    expect(envio.items[0].monto).toBe(330.42);
    expect(envio.items[0].monto).not.toBeCloseTo(35, 2);   // lo que se pintaba antes
  });

  it('el total suma TODOS los renglones, tengan o no precio de venta', async () => {
    const [envio] = await montarDoc([
      { item_code: 'BOLSA12', qty: 2000, basic_rate: 0.4384, amount: 876.72, custom_precio_venta: 0 },
      { item_code: 'LECHE',   qty: 12,   basic_rate: 27.535, amount: 330.42, custom_precio_venta: 2.9166 },
      { item_code: 'RON',     qty: 1,    basic_rate: 190,    amount: 190,    custom_precio_venta: 0 },
    ]);
    expect(envio.items).toHaveLength(3);
    expect(envio.totalMonto).toBeCloseTo(1397.14, 2);
  });

  it('sin `amount` cae al producto qty × costo, no a cero', async () => {
    const [envio] = await montarDoc([
      { item_code: 'X', qty: 4, basic_rate: 2.5, custom_precio_venta: 99 },
    ]);
    expect(envio.items[0].monto).toBe(10);
  });
});
