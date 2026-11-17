import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ventasService } from './frappeSales';

// 04-nov: con el escáner, el código se busca EXACTO por clave o código ligado
// (no por nombre) y no se aborta: la siguiente bolsa cancelaría esta.
describe('ventasService.buscarItems — código de barras', () => {
  let fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
    fetch = vi.spyOn(ventasService, '_fetch').mockResolvedValue({ data: [] });
  });
  const params = (i = 0) => new URL('http://x' + fetch.mock.calls[i][0]).searchParams;

  it('código: or_filters por item_code y custom_codigo_barras, sin LIKE de nombre', async () => {
    await ventasService.buscarItems('7501553905567');
    expect(JSON.parse(params().get('or_filters'))).toEqual([
      ['item_code', '=', '7501553905567'], ['custom_codigo_barras', '=', '7501553905567']]);
    expect(params().get('filters')).not.toContain('like');
    expect(params().get('filters')).toContain('is_sales_item');
  });

  it('código: no aborta ni lo abortan', async () => {
    await ventasService.buscarItems('azucar');
    const señalNombre = fetch.mock.calls[0][1].signal;
    await ventasService.buscarItems('7501553905567');
    expect(fetch.mock.calls[1][1]).toBeUndefined();
    expect(señalNombre.aborted).toBe(false);
  });

  it('nombre: LIKE y sin or_filters; la búsqueda nueva aborta la vieja', async () => {
    await ventasService.buscarItems('azucar');
    const vieja = fetch.mock.calls[0][1].signal;
    await ventasService.buscarItems('azucar mor');
    expect(params(1).get('filters')).toContain('%azucar mor%');
    expect(params(1).get('or_filters')).toBeNull();
    expect(vieja.aborted).toBe(true);
  });
});
