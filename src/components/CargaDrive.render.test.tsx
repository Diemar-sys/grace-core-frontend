import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CargaDrive from './CargaDrive';
import { pedidoService, type EstadoDrive } from '../services/frappePedido';

const base: EstadoDrive = {
  activo: false, cambio_por: null, cambio_cuando: null, puede_cambiar: true, configurado: true,
};

afterEach(() => vi.restoreAllMocks());

describe('CargaDrive', () => {
  it('sin carpeta configurada en el servidor no pinta nada', async () => {
    const spy = vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue({ ...base, configurado: false });
    const { container } = render(<CargaDrive />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('el switch solo lo ve quien puede cambiarlo (Gerente); los demás ven el estado', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue({ ...base, puede_cambiar: false });
    render(<CargaDrive />);
    await screen.findByText('Automático apagado');
    expect(screen.queryByText('Encender automático')).toBeNull();
  });

  it('el switch pinta lo que contestó el servidor', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue(base);
    vi.spyOn(pedidoService, 'cambiarDrive').mockResolvedValue({
      ...base, activo: true, cambio_por: 'luis.th', cambio_cuando: '2026-11-06 11:40',
    });
    render(<CargaDrive />);
    fireEvent.click(await screen.findByText('Encender automático'));
    await screen.findByText('Automático encendido');
    expect(screen.getByText(/luis.th · 2026-11-06 11:40/)).toBeInTheDocument();
  });

  it('si el servidor rechaza el cambio, lo dice y no finge que cambió', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue(base);
    vi.spyOn(pedidoService, 'cambiarDrive').mockRejectedValue(new Error('No tienes permisos'));
    render(<CargaDrive />);
    fireEvent.click(await screen.findByText('Encender automático'));
    await screen.findByText('No tienes permisos');
    expect(screen.getByText('Automático apagado')).toBeInTheDocument();
  });
});
