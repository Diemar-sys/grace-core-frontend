import { describe, it, expect, beforeEach, vi } from 'vitest';
import FrappePurchaseService from './frappePurchase';

/**
 * Regla: cada palabra del buscador es un LIKE separado (AND). Buscar "velas 8"
 * debe encontrar "VELAS ALEGRIA CONFETTY No. 8" aunque el texto no sea contiguo.
 * Antes un solo LIKE "%velas 8%" no matcheaba nada, y "%velas%" traía las 22
 * velas y el límite dejaba fuera algunas (la No. 8 no salía).
 */
describe('buscarItems — búsqueda por varias palabras', () => {
  let svc;
  let urls;

  beforeEach(() => {
    svc = new FrappePurchaseService();
    urls = [];
    svc._fetch = vi.fn(async (url) => { urls.push(url); return { data: [] }; });
  });

  const filtrosDe = (url) => {
    const qs = new URLSearchParams(url.split('?')[1]);
    return JSON.parse(qs.get('filters'));
  };

  it('parte la búsqueda en un LIKE por palabra', async () => {
    await svc.buscarItems('velas 8');
    const f = filtrosDe(urls[0]);
    expect(f).toContainEqual(['item_name', 'like', '%velas%']);
    expect(f).toContainEqual(['item_name', 'like', '%8%']);
    // + el filtro base disabled=0
    expect(f).toContainEqual(['disabled', '=', 0]);
  });

  // El 17-ago se compraron 3 PZA de la PIZZA "ARRACHERA" en vez de kilos de la
  // carne "ARRACHERA MARINADA A GRANEL". El pan y las pizzas se producen, no se
  // compran: el buscador de compras no debe ofrecerlos nunca.
  it('nunca ofrece productos terminados (pan y pizzas)', async () => {
    await svc.buscarItems('arrachera');
    expect(filtrosDe(urls[0])).toContainEqual(['custom_tipo_item', '!=', 'PRODUCTO TERMINADO']);
  });

  it('excluye productos terminados aunque no haya término de búsqueda', async () => {
    await svc.buscarItems('');
    expect(filtrosDe(urls[0])).toContainEqual(['custom_tipo_item', '!=', 'PRODUCTO TERMINADO']);
  });

  it('ignora espacios de más', async () => {
    await svc.buscarItems('  velas   8 azul ');
    const likes = filtrosDe(urls[0]).filter(x => x[0] === 'item_name');
    expect(likes.map(x => x[2])).toEqual(['%velas%', '%8%', '%azul%']);
  });

  it('ordena por nombre para que el resultado sea estable', async () => {
    await svc.buscarItems('velas');
    const qs = new URLSearchParams(urls[0].split('?')[1]);
    expect(qs.get('order_by')).toBe('item_name asc');
  });

  it('menos de 3 caracteres no consulta', async () => {
    const r = await svc.buscarItems('ve');
    expect(r).toEqual([]);
    expect(urls).toHaveLength(0);
  });
});

// Escáner de código de barras (04-nov): el código va EXACTO al servidor (clave
// o código ligado), nunca como LIKE del nombre, y nunca se cancela entre escaneos.
describe('buscarItems — código escaneado', () => {
  let svc;
  let llamadas;
  beforeEach(() => {
    svc = new FrappePurchaseService();
    llamadas = [];
    svc._fetch = vi.fn(async (url, opts) => { llamadas.push({ url, signal: opts?.signal }); return { message: [], data: [] }; });
  });

  it('EAN-13 va a buscar_por_codigo, no al LIKE del nombre', async () => {
    await svc.buscarItems('7501553905567');
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('/api/method/gestion_panaderia.api.compras_api.buscar_por_codigo?codigo=7501553905567');
  });

  it('números cortos (pan, "500") siguen siendo búsqueda por nombre', async () => {
    await svc.buscarItems('500');
    const qs = new URLSearchParams(llamadas[0].url.split('?')[1]);
    expect(JSON.parse(qs.get('filters'))).toContainEqual(['item_name', 'like', '%500%']);
  });

  it('un código escaneado no cancela al anterior (ni se deja cancelar)', async () => {
    await Promise.all([svc.buscarItems('7501553905567'), svc.buscarItems('7501000000001')]);
    expect(llamadas.map(l => l.signal)).toEqual([undefined, undefined]);
  });

  it('la búsqueda por nombre sí cancela la anterior', async () => {
    await svc.buscarItems('azucar');
    await svc.buscarItems('azucar morena');
    expect(llamadas[0].signal.aborted).toBe(true);
  });

  it('ligar manda la clave del insumo y el código, nada más', async () => {
    await svc.ligarCodigo('7500000000002', '7501553905567');
    expect(llamadas[0].url).toBe('/api/method/gestion_panaderia.api.compras_api.ligar_codigo_barras');
    expect(JSON.parse(svc._fetch.mock.calls[0][1].body)).toEqual({ item_code: '7500000000002', codigo: '7501553905567' });
  });
});
