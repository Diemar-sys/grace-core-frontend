import { describe, it, expect, vi } from 'vitest';
import FrappePedidoService from './frappePedido';

/** Un backend sin actualizar no debe tumbar la pantalla: el borde rellena la forma. */
function servicioQueResponde(message: unknown) {
  const s = new FrappePedidoService();
  s._fetch = vi.fn().mockResolvedValue({ message });
  return s;
}

describe('frappePedido normaliza lo que devuelve el servidor', () => {
  it('rellena los campos que un backend viejo no manda', async () => {
    const s = servicioQueResponde({ hojas: [{ pestana: 'PRODUCCION' }] });
    const [h] = (await s.previsualizar('x', 'x.xlsx')).hojas;
    expect(h.duplica_a).toEqual([]);
    expect(h.destinos).toEqual([]);
    expect(h.renglones).toEqual([]);
    expect(h.total_piezas).toBe(0);
    expect(h.sugerida).toBe(true);       // sin el dato, se asume importable
  });

  it('respeta lo que sí viene', async () => {
    const s = servicioQueResponde({
      hojas: [{ pestana: 'GRAN TOTAL', es_resumen: true, sugerida: false, duplica_a: ['PRODUCCION'] }],
    });
    const [h] = (await s.previsualizar('x', 'x.xlsx')).hojas;
    expect(h.sugerida).toBe(false);
    expect(h.duplica_a).toEqual(['PRODUCCION']);
  });

  it('un resumen sin el campo sugerida no se marca solo', async () => {
    const s = servicioQueResponde({ hojas: [{ pestana: 'GRAN TOTAL', es_resumen: true }] });
    expect((await s.previsualizar('x', 'x.xlsx')).hojas[0].sugerida).toBe(false);
  });

  it('una respuesta vacía no truena', async () => {
    const s = servicioQueResponde(undefined);
    expect((await s.previsualizar('x', 'x.xlsx')).hojas).toEqual([]);
    const r = await s.importar('x', 'x.xlsx', '2026-08-20', ['PRODUCCION']);
    expect(r.pestanas).toEqual([]);
    expect(r.problemas).toEqual([]);
  });
});
