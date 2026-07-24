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
