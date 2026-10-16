import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pedido from './Pedido';
import { pedidoService } from '../services/frappePedido';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappePedido', () => ({
  pedidoService: { previsualizar: vi.fn(), importar: vi.fn(), hayPedido: vi.fn(), destinatarios: vi.fn(), quitar: vi.fn() },
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

  // 07-oct: arrancaba con toISOString (UTC): después de las 18:00 proponía el día de MAÑANA
  it('🔴 a las 19:30 el campo arranca en HOY, no en mañana', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T01:30:00Z')); // 07-oct 19:30 en México
    try {
      render(<MemoryRouter><Pedido /></MemoryRouter>);
      expect(screen.getByLabelText(/Fecha del pedido/)).toHaveValue('2026-10-07');
    } finally { vi.useRealTimers(); }
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

// 16-oct (Diemar): un Excel por día. Con pedido guardado no se importa otro encima;
// primero se quita el que está (se confirma: borra lo capturado).
describe('Pedido — un Excel por día', () => {
  const hoja = { pestana: 'P', sugerida: true, es_resumen: false, duplica_a: [], renglones: [], destinos: [], problemas: [], total_piezas: 0 };
  beforeEach(() => {
    vi.clearAllMocks();
    s.destinatarios.mockResolvedValue([]);
    s.previsualizar.mockResolvedValue({ ...previa('2026-10-16'), hojas: [hoja] });
  });

  it('🔴 con pedido guardado, «Importar al sistema» no se prende', async () => {
    s.hayPedido.mockResolvedValue(true);
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    const btn = await screen.findByRole('button', { name: 'Importar al sistema' });
    await screen.findByRole('button', { name: 'Quitar el pedido guardado' });
    expect(btn).toBeDisabled();
  });

  it('sin pedido guardado sí se importa', async () => {
    s.hayPedido.mockResolvedValue(false);
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    const btn = await screen.findByRole('button', { name: 'Importar al sistema' });
    await waitFor(() => expect(btn).toBeEnabled());
  });

  it('quitar pide confirmación y luego deja importar', async () => {
    s.hayPedido.mockResolvedValue(true);
    s.quitar.mockResolvedValue({ quitado: 'PED-2026-10-16' });
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar el pedido guardado' }));
    expect(s.quitar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar y borrar todo' }));
    await waitFor(() => expect(s.quitar).toHaveBeenCalledWith('2026-10-16'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Importar al sistema' })).toBeEnabled());
  });
});
