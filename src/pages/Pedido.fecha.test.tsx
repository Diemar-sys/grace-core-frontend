import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pedido from './Pedido';
import { pedidoService } from '../services/frappePedido';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappePedido', () => ({
  pedidoService: { previsualizar: vi.fn(), importar: vi.fn(), hayPedido: vi.fn(), destinatarios: vi.fn() },
  leerBase64: vi.fn().mockResolvedValue('YmFzZTY0'),
  urlPdfPedido: () => '#',
}));

const s = vi.mocked(pedidoService);
const previa = (fecha: string | null) => ({ fecha, hojas: [], cuadre: null, grupos: {}, ordenGrupos: [] });
const subir = () => fireEvent.change(document.getElementById('ped-file')!, {
  target: { files: [new File(['x'], 'PRODUCCIÓN 01 OCTUBRE.xlsx')] },
});

// 02-oct: el campo arrancaba en hoy; subir el Excel de ayer sin tocarlo lo guardaba como pedido de hoy
describe('Pedido — la fecha la dice el archivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.hayPedido.mockResolvedValue(false);
    s.destinatarios.mockResolvedValue([]);
  });

  it('precarga la FECHA que trae el Excel', async () => {
    s.previsualizar.mockResolvedValue(previa('2026-10-01'));
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    await waitFor(() => expect(screen.getByLabelText(/Fecha del pedido/)).toHaveValue('2026-10-01'));
  });

  it('sin fecha en el archivo deja la que estaba (el servidor rechaza al importar)', async () => {
    s.previsualizar.mockResolvedValue(previa(null));
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    const antes = (screen.getByLabelText(/Fecha del pedido/) as HTMLInputElement).value;
    subir();
    await waitFor(() => expect(s.previsualizar).toHaveBeenCalled());
    expect(screen.getByLabelText(/Fecha del pedido/)).toHaveValue(antes);
    // el estado tampoco se vacía: con fecha null se importaría «sin día»
    expect(s.hayPedido).not.toHaveBeenCalledWith(null);
  });
});
