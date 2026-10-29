import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MiCuenta, { claseLlego, facturadoPorDia, llegadasCambiadas, pctPagado, surtido, techo, totalesFacturas } from './MiCuenta';
import { fechaCorta, fechaLarga, rangoFechas } from '../utils/hora';
import { clienteService } from '../services/frappeCliente';
import { getRoleConfig } from '../config/roles';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappeCliente', () => ({ clienteService: { miCuenta: vi.fn(), miPedido: vi.fn(), confirmarLlegada: vi.fn() } }));
const s = vi.mocked(clienteService);

const dia = (renglones: any[], abierta = false) => ({ renglones, abierta, cierre: 19 });
const pan = (item_code: string, producto: string, piezas: number, enviado: number, llego: number | null = null, llego_supuesto = false) =>
  ({ item_code, producto, piezas, enviado, precio: 14, llego, llego_supuesto });

const CUENTA = {
  cliente: 'ALEJANDRO TORRES', desde: '2026-10-01', hasta: '2026-10-16', saldo: 329439.68,
  antiguedad: [{ tramo: '0 a 7 días', monto: 164284.68 }, { tramo: '8 a 30 días', monto: 165155 },
    { tramo: '31 a 60 días', monto: 0 }, { tramo: 'Más de 60 días', monto: 0 }],
  pedidos: [{ fecha: '2026-10-15', piezas: 1451, enviado: 1400 }],
  facturas: [
    { factura: 'ACC-SINV-1', fecha: '2026-10-15', tipo: 'pan' as const, total: 14272, pagado: 0, debe: 14272 },
    { factura: 'ACC-SINV-2', fecha: '2026-10-15', tipo: 'abarrote' as const, total: 500, pagado: 200, debe: 300 },
  ],
  envios: [], envios_truncados: false,
};

// 16-oct (Diemar): Alejandro ve SOLO lo suyo, de lectura
describe('Mi cuenta (cliente)', () => {
  beforeEach(() => { vi.clearAllMocks(); s.miCuenta.mockResolvedValue(CUENTA); });

  it('el nivel Cliente solo entra a /mi-cuenta', () => {
    const c = getRoleConfig('Cliente');
    expect(c.rutas).toEqual(['/mi-cuenta']);
    expect(c.inicio).toBe('/mi-cuenta');
    expect(c.modulosPanel).toEqual([]);
  });

  it('totales del periodo suman las facturas', () => {
    expect(totalesFacturas(CUENTA.facturas)).toEqual({ total: 14772, pagado: 200, debe: 14572 });
  });

  it('% pagado (tope 100), surtido, tope del eje y facturado por día', () => {
    expect(pctPagado({ total: 14772, pagado: 200 })).toBe(1);
    expect(pctPagado({ total: 0, pagado: 0 })).toBe(0);
    expect(pctPagado({ total: 100, pagado: 150 })).toBe(100);
    expect(surtido(1451, 1400)).toBe(96);
    expect(surtido(10, 12)).toBe(100);          // lo de más no pasa de 100
    expect(surtido(0, 5)).toBeNull();           // sin pedido no hay %
    expect([techo(14772), techo(180), techo(200), techo(0.4), techo(0)]).toEqual([20000, 200, 200, 0.5, 1]);  // 200 justo no brinca a 500
    expect(facturadoPorDia(CUENTA.facturas)).toEqual([{ fecha: '2026-10-15', pagado: 200, debe: 14572 }]);
  });

  it('fechas bonitas sin correrse un día (UTC)', () => {
    expect(fechaCorta('2026-10-02')).toBe('vie 2 oct');
    expect(fechaLarga('2026-10-16')).toBe('vie 16 oct 2026');
    expect(rangoFechas('2026-10-01', '2026-10-16')).toBe('1 – 16 oct 2026');
    expect(rangoFechas('2026-09-28', '2026-10-16')).toBe('28 sep – 16 oct 2026');
    expect(rangoFechas('2025-12-29', '2026-01-04')).toBe('29 dic 2025 – 4 ene 2026');
  });

  it('enseña el saldo de toda la cuenta y, en Facturas, sus facturas', async () => {
    render(<MiCuenta />);
    expect(await screen.findByLabelText('Saldo')).toHaveTextContent('329,439.68');
    expect(screen.getByRole('img', { name: 'Pagado 1%' })).toBeInTheDocument();
    expect(screen.getByLabelText('Surtido')).toHaveTextContent('96%');
    expect(within(screen.getByRole('list', { name: 'Antigüedad del saldo' })).getByText('$165,155.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Facturas$/ }));
    const t = screen.getByRole('table', { name: 'Facturas' });
    expect(within(t).getByText('ACC-SINV-1')).toBeInTheDocument();
    expect(within(t).getByText('Abarrotes')).toBeInTheDocument();
  });

  it('«Ver pan» trae el pedido de ESE día', async () => {
    s.miPedido.mockResolvedValue(dia([pan('1001', 'MANTECADA GDE', 48, 40)]));
    render(<MiCuenta />);
    await screen.findByLabelText('Saldo');
    fireEvent.click(screen.getByRole('button', { name: /^Pedidos$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver pan' }));
    await waitFor(() => expect(s.miPedido).toHaveBeenCalledWith('2026-10-15'));
    expect(await screen.findByText('MANTECADA GDE')).toBeInTheDocument();
  });

  // 19-oct (Diemar): «si el producto no tiene decimales, que no salgan»
  it('Envíos: cantidad entera sin decimales, fraccionaria con dos', async () => {
    s.miCuenta.mockResolvedValue({ ...CUENTA, envios: [
      { envio: 'MAT-1', fecha: '2026-10-15', item_code: 'A', producto: 'AZUCAR REFINADA', cantidad: 25, unidad: 'Kg', almacen: 'T' },
      { envio: 'MAT-1', fecha: '2026-10-15', item_code: 'B', producto: 'POLIPAPEL', cantidad: 2.5, unidad: 'Kg', almacen: 'T' }] });
    render(<MiCuenta />);
    await screen.findByLabelText('Saldo');
    fireEvent.click(screen.getByRole('button', { name: /^Envíos$/ }));
    const t = screen.getByRole('table', { name: 'Envíos' });
    expect(within(t).getByText('25 Kg')).toBeInTheDocument();     // con el código viejo: «25.00 Kg»
    expect(within(t).getByText('2.50 Kg')).toBeInTheDocument();
  });

  // 19-oct (Diemar): «el de ver pan no se ve el pan» — se pintaba debajo de TODA la tabla
  it('el más reciente arriba; el pan del día se abre justo debajo de ESE día', async () => {
    s.miCuenta.mockResolvedValue({ ...CUENTA, pedidos: [
      { fecha: '2026-10-01', piezas: 967, enviado: 1921 }, { fecha: '2026-10-02', piezas: 1215, enviado: 2338 }] });
    s.miPedido.mockResolvedValue(dia([pan('3001', 'BOLILLO', 0, 896)]));
    render(<MiCuenta />);
    await screen.findByLabelText('Saldo');
    fireEvent.click(screen.getByRole('button', { name: /^Pedidos$/ }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver pan' }))[0]);
    const fila = (await screen.findByText('BOLILLO')).closest('.mc-fila-detalle')!;
    expect(fila.previousElementSibling).toHaveTextContent('vie 2 oct 2026');
    expect(fila.nextElementSibling).toHaveTextContent('jue 1 oct 2026');
  });

  // 20-oct (Diemar): ve lo que se mandó (no lo toca) y anota lo que le LLEGÓ, pan por pan
  it('llegadasCambiadas: solo lo que cambia, entero y ≥ 0; vacío no va', () => {
    const rs = [pan('A', 'A', 1, 1, 5), pan('B', 'B', 1, 1), pan('C', 'C', 1, 1), pan('D', 'D', 1, 1), pan('E', 'E', 1, 1)];
    expect(llegadasCambiadas(rs, { A: '5', B: '0', C: '', D: '2.5', E: '-1' })).toEqual([{ item_code: 'B', llego: 0 }]);
    expect(llegadasCambiadas(rs, { A: '7' })).toEqual([{ item_code: 'A', llego: 7 }]);
  });

  async function abrirPan() {
    render(<MiCuenta />);
    await screen.findByLabelText('Saldo');
    fireEvent.click(screen.getByRole('button', { name: /^Pedidos$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver pan' }));
  }

  it('29-oct: «Te llegó» se pinta contra lo mandado, como la Hoja', () => {
    expect(claseLlego(24, '22')).toBe('falta');
    expect(claseLlego(24, '30')).toBe('demas');
    expect(claseLlego(24, '24')).toBe('nada');
    expect(claseLlego(24, '')).toBe('nada');
    expect(claseLlego(0, '0')).toBe('nada');
  });

  it('hoy: «Se mandó» de lectura, «Te llegó» se teclea y manda SOLO lo cambiado, con el total', async () => {
    s.miPedido.mockResolvedValue(dia([pan('1001', 'CONCHA', 60, 60, 40), pan('1002', 'OJOS', 36, 30)], true));
    s.confirmarLlegada.mockResolvedValue(dia([pan('1001', 'CONCHA', 60, 60, 58), pan('1002', 'OJOS', 36, 30)], true));
    await abrirPan();
    const t = await screen.findByRole('table', { name: 'Pedido del 2026-10-15' });
    expect(within(t).getAllByRole('spinbutton')).toHaveLength(2);           // solo «Te llegó» se teclea
    const guardar = screen.getByRole('button', { name: 'Guardar lo que llegó' });
    expect(guardar).toBeDisabled();                                          // sin cambios no manda nada
    fireEvent.change(screen.getByLabelText('Te llegó CONCHA'), { target: { value: '58' } });
    fireEvent.click(guardar);
    await waitFor(() => expect(s.confirmarLlegada).toHaveBeenCalledWith('2026-10-15', [{ item_code: '1001', llego: 58 }]));
    await waitFor(() => expect(screen.getByLabelText('Te llegó CONCHA')).toHaveValue(58));
  });

  it('cerrado: sin casillas; lo no anotado sale como lo mandado con *', async () => {
    s.miPedido.mockResolvedValue(dia([pan('1001', 'CONCHA', 60, 60, 58), pan('1002', 'OJOS', 36, 30, 30, true)]));
    await abrirPan();
    const t = await screen.findByRole('table', { name: 'Pedido del 2026-10-15' });
    expect(within(t).queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Guardar lo que llegó' })).not.toBeInTheDocument();
    expect(within(t).getByText('58')).toBeInTheDocument();
    expect(within(t).getByText('30 *')).toBeInTheDocument();
    expect(screen.getByText(/No lo anotaste a tiempo/)).toBeInTheDocument();
  });

  // 29-oct: buscador del pan del día; Guardar manda también lo que quedó escondido
  it('🔴 buscador: filtra el pan y Guardar manda también lo escondido', async () => {
    s.miPedido.mockResolvedValue(dia([pan('1001', 'CONCHA', 60, 60), pan('1002', 'OJOS', 36, 30)], true));
    s.confirmarLlegada.mockResolvedValue(dia([pan('1001', 'CONCHA', 60, 60, 58), pan('1002', 'OJOS', 36, 30)], true));
    await abrirPan();
    fireEvent.change(await screen.findByLabelText('Te llegó CONCHA'), { target: { value: '58' } });
    fireEvent.change(screen.getByLabelText('Buscar pan'), { target: { value: 'ojo' } });
    expect(screen.queryByLabelText('Te llegó CONCHA')).toBeNull();
    expect(screen.getByLabelText('Te llegó OJOS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar lo que llegó' }));
    await waitFor(() => expect(s.confirmarLlegada).toHaveBeenCalledWith('2026-10-15', [{ item_code: '1001', llego: 58 }]));
  });

  // 29-oct: la relectura de cada minuto se pausa con la pestaña escondida o el celular bloqueado
  it('🔴 relee cada minuto solo si la pantalla se ve', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      s.miPedido.mockResolvedValue(dia([pan('1001', 'CONCHA', 60, 60)], true));
      await abrirPan();
      await screen.findByLabelText('Te llegó CONCHA');
      const pedidas = s.miPedido.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(s.miPedido.mock.calls.length).toBe(pedidas + 1);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
      expect(s.miPedido.mock.calls.length).toBe(pedidas + 1);
    } finally {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      vi.useRealTimers();
    }
  });
});
