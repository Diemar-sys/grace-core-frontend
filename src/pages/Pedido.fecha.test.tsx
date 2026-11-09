import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Pedido from './Pedido';
import { pedidoService } from '../services/frappePedido';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappePedido', () => ({
  pedidoService: { previsualizar: vi.fn(), importar: vi.fn(), hayPedido: vi.fn(), destinatarios: vi.fn(), quitar: vi.fn(),
    enviar: vi.fn(), buscarEnDrive: vi.fn(),
    estadoDrive: vi.fn(() => Promise.resolve({ configurado: false })) },
  leerBase64: vi.fn().mockResolvedValue('YmFzZTY0'),
  urlPdfPedido: () => '#',
}));

const s = vi.mocked(pedidoService);
const previa = (fecha: string | null) => ({ fecha, hojas: [], cuadre: null, grupos: {}, ordenGrupos: [] });
// a mano solo se sube tras «¿Drive no responde?» (06-nov)
const subir = () => {
  fireEvent.click(screen.getByRole('button', { name: '¿Drive no responde? Subir archivo' }));
  fireEvent.change(document.getElementById('ped-file')!, {
    target: { files: [new File(['x'], 'PRODUCCIÓN 01 OCTUBRE.xlsx')] },
  });
};

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

  it('🔴 con pedido guardado, «Importar y mandar» no se prende', async () => {
    s.hayPedido.mockResolvedValue(true);
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    const btn = await screen.findByRole('button', { name: 'Importar y mandar' });
    await screen.findByRole('button', { name: 'Quitar el pedido guardado' });
    expect(btn).toBeDisabled();
  });

  it('sin pedido guardado sí se importa', async () => {
    s.hayPedido.mockResolvedValue(false);
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    const btn = await screen.findByRole('button', { name: 'Importar y mandar' });
    await waitFor(() => expect(btn).toBeEnabled());
  });

  it('quitar pide confirmación y luego deja importar', async () => {
    s.hayPedido.mockResolvedValue(true);
    s.quitar.mockResolvedValue({ quitado: 'PED-2026-10-16' });
    render(<MemoryRouter><Pedido /></MemoryRouter>);
    subir();
    // 20-oct: el botón sale primero con la fecha de HOY y se vuelve a montar cuando llega la
    // del Excel (hayPedido pregunta otra vez). Con 8 workers el clic caía en el de antes y el
    // modal no salía: se espera a que se pregunte por la fecha del Excel y a ESE botón prendido.
    await waitFor(() => expect(s.hayPedido).toHaveBeenCalledWith('2026-10-16'));
    const quitar = () => screen.getByRole('button', { name: 'Quitar el pedido guardado' });
    await waitFor(() => expect(quitar()).toBeEnabled());
    fireEvent.click(quitar());
    expect(s.quitar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar y borrar todo' }));
    await waitFor(() => expect(s.quitar).toHaveBeenCalledWith('2026-10-16'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Importar y mandar' })).toBeEnabled());
  });
});

// 06-nov: «Traer de Drive» baja la hoja de la FECHA del campo y la previsualiza como un
// .xlsx subido; «Importar y mandar» guarda y manda a TODOS; limpio → regresa al panel.
describe('Pedido — Traer de Drive e Importar y mandar', () => {
  const hoja = { pestana: 'P', sugerida: true, es_resumen: false, duplica_a: [], renglones: [], destinos: [], problemas: [], total_piezas: 0 };
  const guardado = { pedido: 'PED-2026-11-06', renglones: 10, destinos: ['P.REAL'], pestanas: ['P'], problemas: [] as any[] };
  const pantalla = () => render(
    <MemoryRouter initialEntries={['/pedido']}>
      <Routes>
        <Route path="/pedido" element={<Pedido />} />
        <Route path="/panel" element={<div>PANEL</div>} />
      </Routes>
    </MemoryRouter>);
  const traerEImportar = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Traer de Drive' }));
    const btn = await screen.findByRole('button', { name: 'Importar y mandar' });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
  };
  beforeEach(() => {
    vi.clearAllMocks();
    s.hayPedido.mockResolvedValue(false);
    s.destinatarios.mockResolvedValue(['Panaderos', 'Luis']);
    s.buscarEnDrive.mockResolvedValue({ archivo: 'QUJD', nombre: 'PRODUCCIÓN 06 NOVIEMBRE.xlsx' });
    s.previsualizar.mockResolvedValue({ ...previa('2026-11-06'), hojas: [hoja] });
    s.importar.mockResolvedValue(guardado);
    s.enviar.mockResolvedValue({ enviado_a: 'x', archivo: 'x.pdf', bytes: 1 });
  });

  it('trae la hoja de la FECHA del campo y la previsualiza con su nombre, sin guardar', async () => {
    pantalla();
    fireEvent.change(screen.getByLabelText(/Fecha del pedido/), { target: { value: '2026-11-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Traer de Drive' }));
    await screen.findByRole('button', { name: 'Importar y mandar' });
    expect(s.buscarEnDrive).toHaveBeenCalledWith('2026-11-05');
    expect(s.previsualizar).toHaveBeenCalledWith('QUJD', 'PRODUCCIÓN 06 NOVIEMBRE.xlsx');
    expect(s.importar).not.toHaveBeenCalled();
  });

  it('limpio: guarda, manda a TODOS y regresa al panel', async () => {
    pantalla();
    await traerEImportar();
    await screen.findByText('PANEL', {}, { timeout: 3000 });
    expect(s.importar).toHaveBeenCalledWith('QUJD', 'PRODUCCIÓN 06 NOVIEMBRE.xlsx', '2026-11-06', ['P']);
    expect(s.enviar).toHaveBeenCalledWith('2026-11-06', 'Panaderos');
    expect(s.enviar).toHaveBeenCalledWith('2026-11-06', 'Luis');
  });

  it('🔴 Telegram falló a uno: se queda y dice a quién NO salió', async () => {
    s.enviar.mockImplementation(async (_f: string, d?: string) => {
      if (d === 'Luis') throw new Error('chat caído');
      return { enviado_a: d!, archivo: 'x.pdf', bytes: 1 };
    });
    pantalla();
    await traerEImportar();
    await screen.findByText('⚠️ NO salió a: Luis');
    await new Promise((ok) => setTimeout(ok, 1700));
    expect(screen.queryByText('PANEL')).toBeNull();
  });

  it('🔴 con renglones fuera por su clave: se queda para que se vean', async () => {
    s.importar.mockResolvedValue({ ...guardado, problemas: [{ clave: 'X', producto: 'X', motivo: 'no existe' }] });
    pantalla();
    await traerEImportar();
    await screen.findByText(/renglones quedaron fuera/);
    await new Promise((ok) => setTimeout(ok, 1700));
    expect(screen.queryByText('PANEL')).toBeNull();
  });

  it('Drive sin hoja de esa fecha: muestra el error y no previsualiza nada', async () => {
    s.buscarEnDrive.mockRejectedValue(new Error('No encontré en Drive una hoja con la FECHA 2026-11-06.'));
    pantalla();
    fireEvent.click(await screen.findByRole('button', { name: 'Traer de Drive' }));
    await screen.findByText('No encontré en Drive una hoja con la FECHA 2026-11-06.');
    expect(s.previsualizar).not.toHaveBeenCalled();
  });
});
