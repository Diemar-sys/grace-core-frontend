// Cableado de la 2a Entrada de Pan del día: la pantalla le pregunta al servidor
// qué ya entró y precarga solo lo que falta. Y si no puede saberlo, NO precarga:
// precargar el pedido completo es justo lo que duplicaba la hornada.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ModalEntradaPan from './ModalEntradaPan';
import { produccionService } from '../../services/frappeProduccion';

vi.mock('../../services/frappeAuth', () => ({ auth: { getUser: () => ({ email: 'op@grace.local', role: 'Operaciones' }) } }));
vi.mock('../../services/frappeProduccion', () => ({
  produccionService: {
    buscarProductosTerminados: vi.fn().mockResolvedValue([
      { item_code: '1047', item_name: 'CONCHAS', custom_costo_estimado: 4.9 },
    ]),
    costoRecetaHoy: vi.fn(),
    registrarEntradaPan: vi.fn(),
    entradoHoy: vi.fn(),
  },
}));
vi.mock('../../services/frappePedido', () => ({
  pedidoService: { consultar: vi.fn().mockResolvedValue({ renglones: [{ clave: '1047', total: 250 }] }) },
}));

const entradoHoy = vi.mocked(produccionService.entradoHoy);
const cantidades = () => screen.queryAllByRole('spinbutton').filter(i => i.getAttribute('placeholder') !== 'Del catálogo');

describe('ModalEntradaPan — la 2a entrada del día no duplica', () => {
  beforeEach(() => entradoHoy.mockReset());

  it('🔴 ya entraron 250 de 250 conchas: no precarga nada y lo dice', async () => {
    entradoHoy.mockResolvedValue({ '1047': 250 });
    render(<ModalEntradaPan onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText(/Ya entró todo lo pedido hoy/);
    expect(cantidades().every(i => (i as HTMLInputElement).value === '')).toBe(true);
  });

  it('ya entraron 200: precarga las 50 que faltan', async () => {
    entradoHoy.mockResolvedValue({ '1047': 200 });
    render(<ModalEntradaPan onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(cantidades().map(i => (i as HTMLInputElement).value)).toContain('50'));
    expect(screen.getByText(/ya entró 200/)).toBeInTheDocument();
  });

  it('si no sabe qué ya entró, NO precarga el pedido completo', async () => {
    entradoHoy.mockRejectedValueOnce(new Error('502'));
    render(<ModalEntradaPan onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText(/No se pudo leer el pedido de hoy o lo que ya entró/);
    expect(cantidades().map(i => (i as HTMLInputElement).value)).not.toContain('250');
  });
});
