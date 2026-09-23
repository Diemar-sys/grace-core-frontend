import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HojaDelDia from './HojaDelDia';
import { hojaService } from '../services/frappeHoja';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappeHoja', () => ({
  hojaService: { destinos: vi.fn(), hoja: vi.fn(), guardar: vi.fn(), confirmar: vi.fn() },
}));

const R = { item_code: '1047', producto: 'CONCHAS', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
  impuesto: 'ieps', pedido: 40, enviado: 0, regreso: 0, merma: 0, precio: 14, importe: 0 };
const hoja = (factura: any = null) => ({ destino: 'DELI', camioneta: false, renglones: [R], total: 0, comision: 0, se_debe: 0, factura });
const s = vi.mocked(hojaService);

// 23-sep: el destino se elige en un dropdown (antes, tarjetas-botón)
const elegir = async (destino: string) => {
  await screen.findByRole('option', { name: new RegExp(`^${destino} ·`) });
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: destino } });
};

describe('HojaDelDia — cableado', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    s.destinos.mockResolvedValue([{ destino: 'DELI', grupo: 'CLIENTES', camioneta: false, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar', factura: null }]);
  });

  it('🔴 guardar manda solo cantidades de lo que cambió', async () => {
    s.hoja.mockResolvedValue(hoja());
    s.guardar.mockResolvedValue(hoja());
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    const input = await screen.findByLabelText('Enviado CONCHAS');
    fireEvent.change(input, { target: { value: '30' } });
    expect(screen.getByText('$420.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(s.guardar).toHaveBeenCalledWith(expect.any(String), 'DELI', [{ item_code: '1047', enviado: 30 }]));
  });

  it('🔴 un destino cobrado es solo lectura y enseña el folio', async () => {
    s.hoja.mockResolvedValue(hoja({ name: 'ACC-SINV-2026-00099', grand_total: 420, outstanding_amount: 420 }));
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    expect(await screen.findByText(/ACC-SINV-2026-00099/)).toBeInTheDocument();
    expect(screen.getByLabelText('Enviado CONCHAS')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Confirmar y cobrar' })).toBeNull();
  });

  // C1 (fix round 1, controller): el modal enseña totalCapturado (lo
  // tecleado, sin guardar); `confirmar` en el servidor cobra lo último
  // GUARDADO. Si hay cambios sin guardar, cobrar podía facturar un monto
  // distinto al que el modal mostró — por eso cobrar debe guardar PRIMERO
  // (mismo payload que «Guardar») y solo si eso sale bien, confirmar.
  it('🔴 C1: Confirmar y cobrar guarda lo tecleado ANTES de cobrar', async () => {
    s.hoja.mockResolvedValue(hoja());
    s.guardar.mockResolvedValue(hoja());
    s.confirmar.mockResolvedValue({ factura: 'ACC-SINV-2026-00100', total: 420, comision: 0, se_debe: 420 });
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    const input = await screen.findByLabelText('Enviado CONCHAS');
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(s.confirmar).toHaveBeenCalled());
    expect(s.guardar).toHaveBeenCalledWith(expect.any(String), 'DELI', [{ item_code: '1047', enviado: 30 }]);
    expect(s.guardar.mock.invocationCallOrder[0]).toBeLessThan(s.confirmar.mock.invocationCallOrder[0]);
  });

  it('🔴 C1: si el guardado falla, no cobra y enseña el error', async () => {
    s.hoja.mockResolvedValue(hoja());
    s.guardar.mockRejectedValue(new Error('el servidor rechazó el guardado'));
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    const input = await screen.findByLabelText('Enviado CONCHAS');
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    expect(await screen.findByText('el servidor rechazó el guardado')).toBeInTheDocument();
    expect(s.confirmar).not.toHaveBeenCalled();
  });

  // C2 (fix round 1, controller): cambiar de destino con una petición
  // lenta en vuelo podía pintar la hoja VIEJA encima de la selección
  // NUEVA si la respuesta lenta llegaba después. Aquí DELI es lenta,
  // ZAKIA rápida, y DELI resuelve AL FINAL: el panel debe seguir
  // mostrando ZAKIA.
  it('🔴 C2: abrir un destino lento y luego uno rápido — el lento no pisa al rápido al resolver tarde', async () => {
    const rZakia = { ...R, item_code: '2002', producto: 'BOLILLO' };
    s.destinos.mockResolvedValue([
      { destino: 'DELI', grupo: 'CLIENTES', camioneta: false, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar', factura: null },
      { destino: 'ZAKIA', grupo: 'CLIENTES', camioneta: false, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar', factura: null },
    ]);
    let resolverDeli!: (v: any) => void;
    const promesaDeli = new Promise(resolve => { resolverDeli = resolve; });
    s.hoja.mockImplementation(((_fecha: string, destino: string) => {
      if (destino === 'DELI') return promesaDeli;
      return Promise.resolve({ destino: 'ZAKIA', camioneta: false, renglones: [rZakia], total: 0, comision: 0, se_debe: 0, factura: null });
    }) as any);

    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    await elegir('ZAKIA');
    expect(await screen.findByLabelText('Enviado BOLILLO')).toBeInTheDocument();

    await act(async () => {
      resolverDeli(hoja());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByLabelText('Enviado CONCHAS')).toBeNull();
    expect(screen.getByLabelText('Enviado BOLILLO')).toBeInTheDocument();
  });

  // I (fix round 1, controller): camioneta sin cobertura. REGRESO/MERMA/
  // VENDIDO son celdas de solo lectura (nunca inputs), y el resumen usa
  // hoja.total/hoja.comision/hoja.se_debe TAL CUAL del servidor — no un
  // recálculo. `se_debe` aquí ($850) NO es total-comision ($900) a
  // propósito: si alguien lo recalculara en el navegador, el número que
  // saldría sería otro y el test lo cachería.
  it('🔴 I: camioneta — regreso/merma/vendido de solo lectura, resumen tal cual del servidor (con comisión partida)', async () => {
    const rCamioneta = { item_code: '3003', producto: 'BOLSA NEGRA', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
      impuesto: 'ieps', pedido: 50, enviado: 40, regreso: 5, merma: 2, precio: 10, importe: 330 };
    // 🔴 Los tres números NO se derivan entre sí, a propósito (fix round 2):
    // total 1025, comisión 302, se_debe 718. Con 1020/302/718 el test era
    // hueco — 1020-302 daba 718 y 10% de 1020 daba 102, así que recalcular
    // en el navegador pintaba lo mismo y el mutante sobrevivía. Ahora
    // total-comision = 723 ≠ 718 y total*0.10 = 102.50 ≠ 102.00.
    s.destinos.mockResolvedValue([
      { destino: 'CAMIONETA 1', grupo: 'REPARTO', camioneta: true, total: 1025, comision: 302, se_debe: 718, estado: 'sin_confirmar', factura: null },
    ]);
    s.hoja.mockResolvedValue({ destino: 'CAMIONETA 1', camioneta: true, renglones: [rCamioneta], total: 1025, comision: 302, se_debe: 718, factura: null });

    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('CAMIONETA 1');
    expect(await screen.findByLabelText('Enviado BOLSA NEGRA')).toBeInTheDocument();

    // regreso/merma/vendido no son campos capturables aquí (los captura
    // el repartidor en /liquidacion): ningún input con esos aria-label.
    expect(screen.queryByLabelText(/Regreso|Merma|Vendido/i)).toBeNull();
    expect(screen.getByText('5')).toBeInTheDocument();   // REGRESO
    expect(screen.getByText('2')).toBeInTheDocument();   // MERMA
    expect(screen.getByText('33')).toBeInTheDocument();  // VENDIDO = 40-5-2

    // Venta, Comisión 10%, Cuota fija, Se debe — en ese orden y con el
    // <strong> asociado a cada etiqueta (Se debe se repite en el botón del
    // destino, así que se ancla por label → nextSibling, no por texto suelto).
    expect(screen.getByText('Venta').nextSibling).toHaveTextContent('$1,025.00');
    expect(screen.getByText('Comisión 10%').nextSibling).toHaveTextContent('$102.00'); // 302 - 200; total*0.10 daría $102.50
    expect(screen.getByText('Cuota fija').nextSibling).toHaveTextContent('$200.00');
    expect(screen.getByText('Se debe').nextSibling).toHaveTextContent('$718.00'); // del servidor; total-comision daría $723.00
  });

  // Mientras hay una petición en vuelo no se puede cambiar de destino ni de
  // fecha: una respuesta vieja pintando sobre la selección nueva fue el otro
  // hallazgo de la revisión (C2), y el candado visual es su primera mitad.
  it('🔴 mientras guarda, los destinos y la fecha quedan bloqueados', async () => {
    s.hoja.mockResolvedValue(hoja());
    let liberar: (v: any) => void = () => {};
    s.guardar.mockReturnValue(new Promise(res => { liberar = res; }) as any);
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    fireEvent.change(await screen.findByLabelText('Enviado CONCHAS'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByLabelText('Destino')).toBeDisabled());
    expect(screen.getByLabelText('Fecha')).toBeDisabled();

    await act(async () => { liberar(hoja()); });
    await waitFor(() => expect(screen.getByLabelText('Destino')).not.toBeDisabled());
  });

  it('🔴 I: camioneta sin venta (comisión 0) no pinta renglones de comisión', async () => {
    const rCamioneta = { item_code: '3003', producto: 'BOLSA NEGRA', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
      impuesto: 'ieps', pedido: 50, enviado: 0, regreso: 0, merma: 0, precio: 10, importe: 0 };
    s.destinos.mockResolvedValue([
      { destino: 'CAMIONETA 1', grupo: 'REPARTO', camioneta: true, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar', factura: null },
    ]);
    s.hoja.mockResolvedValue({ destino: 'CAMIONETA 1', camioneta: true, renglones: [rCamioneta], total: 0, comision: 0, se_debe: 0, factura: null });

    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('CAMIONETA 1');
    await screen.findByLabelText('Enviado BOLSA NEGRA');

    expect(screen.queryByText('Comisión 10%')).toBeNull();
    expect(screen.queryByText('Cuota fija')).toBeNull();
  });

  // 23-sep (Diemar): la hoja trae todos los panes de la pestaña, así que no hay
  // «agregar pan»; los destinos van en un dropdown agrupado con su estado.
  it('🔴 dropdown agrupado por tipo de destino, con estado y monto; sin «agregar pan»', async () => {
    s.destinos.mockResolvedValue([
      { destino: 'DELI', grupo: 'CLIENTES', camioneta: false, total: 420, comision: 0, se_debe: 420, estado: 'sin_confirmar', factura: null },
      { destino: 'ISMA', grupo: 'CAMIONETAS', camioneta: true, total: 1025, comision: 302, se_debe: 718, estado: 'confirmado', factura: null },
    ]);
    s.hoja.mockResolvedValue(hoja());
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    const isma = await screen.findByRole('option', { name: 'ISMA · Cobrado · $718.00' });
    expect(isma.parentElement).toHaveAttribute('label', 'CAMIONETAS');
    expect(screen.getByRole('option', { name: 'DELI · Sin confirmar · $420.00' }).parentElement)
      .toHaveAttribute('label', 'CLIENTES');
    await elegir('DELI');
    await screen.findByLabelText('Enviado CONCHAS');
    expect(screen.queryByPlaceholderText('Clave del pan')).toBeNull();
    expect(screen.queryByText(/Agregar pan/)).toBeNull();
  });
});
