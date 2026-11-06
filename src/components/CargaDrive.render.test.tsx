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
    const { container } = render(<CargaDrive onCargado={() => {}} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('el switch solo lo ve quien puede cambiarlo (Gerente)', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue({ ...base, puede_cambiar: false });
    render(<CargaDrive onCargado={() => {}} />);
    await screen.findByText('Traer de Drive y mandar');
    expect(screen.queryByText('Encender automático')).toBeNull();
  });

  it('traer: avisa a la pantalla y dice qué cargó, con sus problemas', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue(base);
    vi.spyOn(pedidoService, 'traerDeDrive').mockResolvedValue({
      archivo: 'PRODUCCIÓN 06 NOVIEMBRE.xlsx', renglones: 2946, problemas: 2, telegram_fallo: [],
    });
    const onCargado = vi.fn();
    render(<CargaDrive onCargado={onCargado} />);
    fireEvent.click(await screen.findByText('Traer de Drive y mandar'));
    await screen.findByText(/Cargado «PRODUCCIÓN 06 NOVIEMBRE.xlsx» \(2946 renglones\).*2 renglón/);
    expect(onCargado).toHaveBeenCalledTimes(1);
  });

  it('cargado pero Telegram falló: NO dice «mandado»', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue(base);
    vi.spyOn(pedidoService, 'traerDeDrive').mockResolvedValue({
      archivo: 'X.xlsx', renglones: 10, problemas: 0, telegram_fallo: ['Telegram sin configurar'],
    });
    render(<CargaDrive onCargado={() => {}} />);
    fireEvent.click(await screen.findByText('Traer de Drive y mandar'));
    const aviso = await screen.findByText(/NO salió a: Telegram sin configurar/);
    expect(aviso.textContent).not.toMatch(/mandado/);
  });

  it('traer que falla: muestra el error del servidor y NO avisa que se cargó', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue(base);
    vi.spyOn(pedidoService, 'traerDeDrive').mockRejectedValue(
      new Error('No encontré en Drive una hoja con la FECHA de hoy.'));
    const onCargado = vi.fn();
    render(<CargaDrive onCargado={onCargado} />);
    fireEvent.click(await screen.findByText('Traer de Drive y mandar'));
    await screen.findByText('No encontré en Drive una hoja con la FECHA de hoy.');
    expect(onCargado).not.toHaveBeenCalled();
  });

  it('el switch pinta lo que contestó el servidor', async () => {
    vi.spyOn(pedidoService, 'estadoDrive').mockResolvedValue(base);
    vi.spyOn(pedidoService, 'cambiarDrive').mockResolvedValue({
      ...base, activo: true, cambio_por: 'luis.th', cambio_cuando: '2026-11-06 11:40',
    });
    render(<CargaDrive onCargado={() => {}} />);
    fireEvent.click(await screen.findByText('Encender automático'));
    await screen.findByText('Automático encendido');
    expect(screen.getByText(/luis.th · 2026-11-06 11:40/)).toBeInTheDocument();
  });
});
