import { describe, it, expect } from 'vitest';
import { avanceDelDia } from './ConsultaTablero';

type Destino = Parameters<typeof avanceDelDia>[0][number];
const d = (estado: Destino['estado'], pedido: number, enviado: number): Destino =>
  ({ destino: estado, almacen: null, estado, pedido, enviado });

describe('avanceDelDia — el reparto cuenta a los clientes', () => {
  it('🔴 lo facturado a un cliente suma al avance del día', () => {
    // Sucursal completa (30/30) + DELI completo (20/20) = el día al 100%, no al 60%.
    expect(avanceDelDia([d('almacen', 30, 30), d('cliente', 20, 20)]))
      .toEqual({ pedido: 50, enviado: 50, avance: 100 });
  });
  it('un destino sin almacén ni cliente no suma: nadie lo puede surtir', () => {
    expect(avanceDelDia([d('almacen', 10, 5), d('sin_almacen', 90, 0)]))
      .toEqual({ pedido: 10, enviado: 5, avance: 50 });
  });
  it('sin pedido no divide entre cero', () => {
    expect(avanceDelDia([])).toEqual({ pedido: 0, enviado: 0, avance: 0 });
  });
});
