import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HojaDelDia from './HojaDelDia';
import { hojaService } from '../services/frappeHoja';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../components/EstadoCuentaHoja', () => ({ default: () => <div>VISTA ESTADO DE CUENTA</div> }));
vi.mock('../services/frappeHoja', () => ({
  hojaService: { destinos: vi.fn(), hoja: vi.fn(), guardar: vi.fn(), confirmar: vi.fn(),
    confirmarEnvio: vi.fn(), reabrirEnvio: vi.fn(), guardarMerma: vi.fn() },
}));

const R = { item_code: '1047', producto: 'CONCHAS', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
  impuesto: 'ieps', pedido: 40, enviado: 0, regreso: 0, merma: 0, precio: 14, importe: 0 };
const hoja = (factura: any = null) => ({ destino: 'DELI', camioneta: false, etapa: '' as const, renglones: [R], total: 0, comision: 0, se_debe: 0, a_favor: 0, factura });
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

  it('🔴 /hoja?vista=estado (tarjeta de Reportes) abre directo en el estado de cuenta', () => {
    window.history.pushState({}, '', '/hoja?vista=estado');
    try {
      render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
      expect(screen.getByText('VISTA ESTADO DE CUENTA')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Estado de cuenta' })).toHaveAttribute('aria-selected', 'true');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('sin ?vista abre en la captura del día', () => {
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    expect(screen.queryByText('VISTA ESTADO DE CUENTA')).toBeNull();
  });

  it('🔴 guardar manda solo cantidades de lo que cambió', async () => {
    s.hoja.mockResolvedValue(hoja());
    s.guardar.mockResolvedValue(hoja());
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('DELI');
    const input = await screen.findByLabelText('Enviado CONCHAS');
    fireEvent.change(input, { target: { value: '30' } });
    // el importe del renglón y el total del día se recalculan al teclear
    expect(within(input.closest('tr')!).getByText('$420.00')).toBeInTheDocument();
    expect(screen.getByText('$420.00', { selector: '.hoja-dia__total strong' })).toBeInTheDocument();
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
      return Promise.resolve({ destino: 'ZAKIA', camioneta: false, etapa: '' as const, renglones: [rZakia], total: 0, comision: 0, se_debe: 0, a_favor: 0, factura: null });
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
    s.hoja.mockResolvedValue({ destino: 'CAMIONETA 1', camioneta: true, etapa: '' as const, renglones: [rCamioneta], total: 1025, comision: 302, se_debe: 718, a_favor: 0, factura: null });

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
    s.hoja.mockResolvedValue({ destino: 'CAMIONETA 1', camioneta: true, etapa: '' as const, renglones: [rCamioneta], total: 0, comision: 0, se_debe: 0, a_favor: 0, factura: null });

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

  // 23-sep: la camioneta no enseña PIZZERIA si ese día no lleva; un cliente sí
  it('🔴 camioneta sin la sección de pizza; el cliente sí la ve', async () => {
    const pizza = { ...R, item_code: '1093', producto: 'PIZZA', categoria: 'PIZZERIA', pedido: 0, enviado: 0 };
    const feite = { ...R, item_code: '1052', producto: 'FEITE', categoria: 'PAN FEITE' };
    s.destinos.mockResolvedValue([
      { destino: 'ISMA', grupo: 'CAMIONETAS', camioneta: true, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar', factura: null },
      { destino: 'DELI', grupo: 'CLIENTES', camioneta: false, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar', factura: null },
    ]);
    s.hoja.mockImplementation(((_f: string, d: string) => Promise.resolve(
      { destino: d, camioneta: d === 'ISMA', etapa: '' as const, renglones: [feite, pizza], total: 0, comision: 0, se_debe: 0, a_favor: 0, factura: null })) as any);
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('ISMA');
    await screen.findByLabelText('Enviado FEITE');
    expect(screen.queryByText('PIZZERIA')).toBeNull();
    await elegir('DELI');
    expect(await screen.findByText('PIZZERIA')).toBeInTheDocument();
  });

  // 23-sep (Diemar): camioneta en tres pasos — Héctor confirma el envío, el
  // repartidor captura lo que regresa, Héctor pone la merma y cobra
  describe('camioneta en tres pasos', () => {
    const rc = { ...R, item_code: '1003', producto: 'CHINOS', pedido: 20, enviado: 0, precio: 12 };
    const destinoIsma = [{ destino: 'ISMA', grupo: 'CAMIONETAS', camioneta: true, total: 0, comision: 0, se_debe: 0, estado: 'sin_capturar' as const, factura: null }];
    // PANQUECITOS: pan de la pestaña que ISMA no se llevó (enviado 0)
    const rNo = { ...R, item_code: '1004', producto: 'PANQUECITOS', pedido: 0, enviado: 0, precio: 12 };
    const hojaIsma = (etapa: '' | 'enviado' | 'liquidado', extra: Partial<typeof rc> = {}) =>
      ({ destino: 'ISMA', camioneta: true, etapa, renglones: [{ ...rc, ...extra }, rNo], total: 1025, comision: 302, se_debe: 718, a_favor: 0, factura: null });

    it('🔴 capturando: el botón confirma el ENVÍO (guardando antes), no cobra', async () => {
      s.destinos.mockResolvedValue(destinoIsma);
      s.hoja.mockResolvedValue(hojaIsma(''));
      s.guardar.mockResolvedValue(hojaIsma(''));
      s.confirmarEnvio.mockResolvedValue(hojaIsma('enviado', { enviado: 20 }));
      render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
      await elegir('ISMA');
      fireEvent.change(await screen.findByLabelText('Enviado CHINOS'), { target: { value: '20' } });
      expect(screen.queryByRole('button', { name: 'Confirmar y cobrar' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar envío' }));
      const botones = await screen.findAllByRole('button', { name: 'Confirmar envío' });
      fireEvent.click(botones[botones.length - 1]);   // el del modal
      await waitFor(() => expect(s.confirmarEnvio).toHaveBeenCalledWith(expect.any(String), 'ISMA'));
      expect(s.guardar).toHaveBeenCalledWith(expect.any(String), 'ISMA', [{ item_code: '1003', enviado: 20 }]);
      expect(s.guardar.mock.invocationCallOrder[0]).toBeLessThan(s.confirmarEnvio.mock.invocationCallOrder[0]);
      expect(s.confirmar).not.toHaveBeenCalled();
    });

    it('🔴 en ruta: el enviado queda fijo, no se cobra, se puede reabrir', async () => {
      s.destinos.mockResolvedValue(destinoIsma);
      s.hoja.mockResolvedValue(hojaIsma('enviado', { enviado: 20 }));
      s.reabrirEnvio.mockResolvedValue(hojaIsma(''));
      render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
      await elegir('ISMA');
      expect(await screen.findByLabelText('Enviado CHINOS')).toBeDisabled();
      expect(screen.getByText(/En ruta: esperando que ISMA/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cobrar/i })).toBeNull();
      expect(screen.queryByLabelText('Merma CHINOS')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Reabrir envío' }));
      await waitFor(() => expect(s.reabrirEnvio).toHaveBeenCalledWith(expect.any(String), 'ISMA'));
      expect(await screen.findByLabelText('Enviado CHINOS')).not.toBeDisabled();
    });

    it('🔴 regresó: Héctor captura la merma; no se cobra con merma sin guardar; el modal dice lo que se debe', async () => {
      s.destinos.mockResolvedValue(destinoIsma);
      s.hoja.mockResolvedValue(hojaIsma('liquidado', { enviado: 20, regreso: 3 }));
      s.guardarMerma.mockResolvedValue(hojaIsma('liquidado', { enviado: 20, regreso: 3, merma: 2 }));
      s.confirmar.mockResolvedValue({ factura: 'ACC-SINV-2026-00200', total: 1025, comision: 302, se_debe: 718 });
      render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
      await elegir('ISMA');
      expect(await screen.findByLabelText('Enviado CHINOS')).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Merma CHINOS'), { target: { value: '2' } });
      // al teclear: vendido 20 − 3 − 2 = 15 e importe 15 × $12 = $180 (no 20 × $12 = $240)
      const fila = screen.getByLabelText('Merma CHINOS').closest('tr')!;
      expect(within(fila).getByText('15')).toBeInTheDocument();
      expect(within(fila).getByText('$180.00')).toBeInTheDocument();
      expect(within(fila).queryByText('$240.00')).toBeNull();
      expect(screen.getByRole('button', { name: 'Confirmar y cobrar' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Guardar merma' }));
      expect(screen.queryByLabelText('Merma PANQUECITOS')).toBeNull();   // no se lo llevó: no hay merma que poner
      await waitFor(() => expect(s.guardarMerma).toHaveBeenCalledWith(expect.any(String), 'ISMA', [{ item_code: '1003', merma: 2 }]));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar y cobrar' })).not.toBeDisabled());
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y cobrar' }));
      // se debe (718) del servidor, no lo enviado × precio (240)
      expect(await screen.findByText(/¿Cobrar \$718\.00 a ISMA\?/)).toBeInTheDocument();
    });
  });

  // 23-sep: dos vistas en la misma pantalla
  it('🔴 la pestaña «Estado de cuenta» cambia la vista y esconde la captura del día', async () => {
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    expect(screen.getByLabelText('Fecha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Estado de cuenta' }));
    expect(screen.getByText('VISTA ESTADO DE CUENTA')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Captura del día' }));
    expect(screen.queryByText('VISTA ESTADO DE CUENTA')).toBeNull();
  });

  // 23-sep: excepción — vendió menos que su sueldo
  it('🔴 camioneta que vende menos que su sueldo: 10% del sueldo completo y aviso de lo que se le debe', async () => {
    const r = { item_code: '1003', producto: 'CHINOS', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
      impuesto: 'tasa0', pedido: 10, enviado: 10, regreso: 9, merma: 0, precio: 12, importe: 12 };
    s.destinos.mockResolvedValue([{ destino: 'MARTIN', grupo: 'CAMIONETAS', camioneta: true, total: 12, comision: 12, se_debe: 0, estado: 'regreso', factura: null }]);
    s.hoja.mockResolvedValue({ destino: 'MARTIN', camioneta: true, etapa: 'liquidado', renglones: [r], total: 12, comision: 12, se_debe: 0, a_favor: 189.2, factura: null });
    render(<MemoryRouter><HojaDelDia /></MemoryRouter>);
    await elegir('MARTIN');
    await screen.findByLabelText('Merma CHINOS');
    expect(screen.getByText('Comisión 10%').nextSibling).toHaveTextContent('$1.20');   // no −$188
    expect(screen.getByRole('note')).toHaveTextContent('la panadería le debe $189.20 a MARTIN');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y cobrar' }));
    expect(await screen.findByText(/le debe \$189\.20 a MARTIN \(por nómina\)/)).toBeInTheDocument();
  });
});
