import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import AvisoMantenimiento from './AvisoMantenimiento';
import { leerAviso, cuentaRegresiva } from '../utils/mantenimiento';
import { useAvisoMantenimiento, MantenimientoContext } from '../hooks/useAvisoMantenimiento';
import Reloj from './Reloj';

describe('leerAviso', () => {
  const FECHA = 'Thu, 22 Oct 2026 21:40:00 GMT';
  const inicio = Date.parse(FECHA) / 1000 + 300;

  it('la cuenta sale del reloj de la TORRE, no del navegador', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(FECHA) + 4 * 60_000);   // tablet 4 min adelantada
    const a = leerAviso(200, JSON.stringify({ inicio }), FECHA);
    vi.useRealTimers();
    expect(a).toEqual({ tipo: 'aviso', inicio, faltaMs: 300_000 });
  });

  it('503 = ya está en mantenimiento', () => {
    expect(leerAviso(503, null, FECHA)).toEqual({ tipo: 'activo' });
  });

  it('404, 502 (contenedor recreándose), html de Vite o inicio raro = nada', () => {
    expect(leerAviso(404, null, FECHA).tipo).toBe('nada');
    expect(leerAviso(502, null, FECHA).tipo).toBe('nada');
    expect(leerAviso(200, '<!doctype html><html>', FECHA).tipo).toBe('nada');
    expect(leerAviso(200, '{"inicio":"mañana"}', FECHA).tipo).toBe('nada');
  });

  it('cuentaRegresiva', () => {
    expect(cuentaRegresiva(300_000)).toBe('5:00');
    expect(cuentaRegresiva(9_200)).toBe('0:10');   // redondea hacia arriba: no dice 0:00 antes de tiempo
    expect(cuentaRegresiva(-5_000)).toBe('0:00');
  });
});

describe('AvisoMantenimiento', () => {
  afterEach(() => vi.useRealTimers());

  it('sin aviso no pinta nada', () => {
    const { container } = render(<AvisoMantenimiento estado={{ tipo: 'nada' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('aviso: modal con cuenta regresiva y hora; corre cada segundo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 15, 40, 0));
    render(<AvisoMantenimiento estado={{ tipo: 'aviso', inicio: 1, hasta: new Date(2026, 9, 22, 15, 45, 0).getTime() }} />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento en 5:00')).toBeInTheDocument();
    expect(screen.getByText(/A las 3:45 p\.m\./)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(screen.getByText('Mantenimiento en 3:59')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(238_000); });
    expect(screen.getByText('Mantenimiento en 0:01')).toBeInTheDocument();
  });

  it('en 0 pasa SOLA a «en mantenimiento», aunque hayan cerrado el aviso y sin esperar a la torre', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 15, 44, 58));
    render(<AvisoMantenimiento estado={{ tipo: 'aviso', inicio: 1, hasta: new Date(2026, 9, 22, 15, 45, 0).getTime() }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Sistema en mantenimiento');
    expect(screen.queryByRole('button', { name: 'Entendido' })).not.toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/No recargues ni cierres esta pestaña/);
  });

  it('«Entendido» quita el modal (para poder guardar); la cuenta sigue en la píldora del reloj', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 15, 40, 0));
    const estado = { tipo: 'aviso' as const, inicio: 1, hasta: new Date(2026, 9, 22, 15, 45, 0).getTime() };
    render(
      <MantenimientoContext.Provider value={estado}>
        <AvisoMantenimiento estado={estado} />
        <Reloj />
      </MantenimientoContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Mantenimiento en 5:00' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByRole('status', { name: 'Mantenimiento en 4:57' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(297_000); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();   // en 0 se va: manda el modal
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Sistema en mantenimiento');
  });

  it('sin aviso el reloj va solo, sin píldora', () => {
    render(<Reloj />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cerrar el aviso no tapa el de «ya en mantenimiento»: ese vuelve a abrir', () => {
    const { rerender } = render(<AvisoMantenimiento estado={{ tipo: 'aviso', inicio: 1, hasta: Date.now() + 60_000 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    rerender(<AvisoMantenimiento estado={{ tipo: 'activo' }} />);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/No recargues ni cierres esta pestaña/);
  });

  it('ya EN mantenimiento no se puede cerrar: sin botón, ni con Escape, y nada que deje usar la pantalla', () => {
    render(<AvisoMantenimiento estado={{ tipo: 'activo' }} />);
    const modal = screen.getByRole('alertdialog');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.keyDown(modal, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('useAvisoMantenimiento', () => {
  afterEach(() => vi.unstubAllGlobals());

  function Muestra() {
    const e = useAvisoMantenimiento();
    return <span>{e.tipo}</span>;
  }

  it('pregunta a /mantenimiento/aviso sin caché y pinta lo que contesta', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    render(<Muestra />);
    await waitFor(() => expect(screen.getByText('activo')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/mantenimiento/aviso', { cache: 'no-store' });
  });

  it('sin red se queda en nada (no inventa mantenimiento)', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetch);
    render(<Muestra />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('nada')).toBeInTheDocument();
  });
});
