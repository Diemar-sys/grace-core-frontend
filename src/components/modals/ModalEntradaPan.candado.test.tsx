// Cableado del candado del costo en la Entrada de Pan: el nivel del usuario
// llega hasta el input. Operaciones ve el costo del catálogo pero no lo teclea;
// el Gerente sí. Los renglones salen del pedido del día, como en la vida real.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ModalEntradaPan from './ModalEntradaPan';
import { auth } from '../../services/frappeAuth';

vi.mock('../../services/frappeAuth', () => ({ auth: { getUser: vi.fn() } }));
vi.mock('../../services/frappeProduccion', () => ({
  produccionService: {
    buscarProductosTerminados: vi.fn().mockResolvedValue([
      { item_code: '1050', item_name: 'CHORREADA', custom_costo_estimado: 3.0449999999999995 },
    ]),
    costoRecetaHoy: vi.fn(),
    registrarEntradaPan: vi.fn(),
  },
}));
vi.mock('../../services/frappePedido', () => ({
  pedidoService: { consultar: vi.fn().mockResolvedValue({ renglones: [{ clave: '1050', total: 40 }] }) },
}));

const getUser = vi.mocked(auth.getUser);
const inputCosto = () => screen.getByPlaceholderText('Del catálogo');

describe('ModalEntradaPan — candado del costo', () => {
  beforeEach(() => getUser.mockReset());

  it('🔴 Operaciones ve el costo del catálogo pero NO puede teclearlo', async () => {
    getUser.mockReturnValue({ email: 'op@grace.local', role: 'Operaciones' });
    render(<ModalEntradaPan onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(inputCosto()).toHaveValue(3.045));
    expect(inputCosto()).toHaveAttribute('readonly');
  });

  it('el Gerente sí puede teclearlo', async () => {
    getUser.mockReturnValue({ email: 'ger@grace.local', role: 'Gerente' });
    render(<ModalEntradaPan onSuccess={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(inputCosto()).toHaveValue(3.045));
    expect(inputCosto()).not.toHaveAttribute('readonly');
  });
});
