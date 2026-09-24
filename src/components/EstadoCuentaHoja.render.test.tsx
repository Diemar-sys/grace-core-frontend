import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EstadoCuentaHoja from './EstadoCuentaHoja';
import { hojaService } from '../services/frappeHoja';
import { ventasService } from '../services/frappeSales';

vi.mock('../services/frappeHoja', () => ({ hojaService: { deudores: vi.fn(), estadoCuenta: vi.fn() } }));
vi.mock('../services/frappeSales', async (orig) => {
  const actual = await orig<typeof import('../services/frappeSales')>();
  return { ...actual, ventasService: { getFacturasPendientes: vi.fn() } };
});
vi.mock('./modals/ModalRegistrarPago', () => ({
  default: ({ grupo }: any) => <div role="dialog">COBRO {grupo.customer} · {grupo.facturas.length} facturas · {grupo.totalDeuda}</div>,
}));
vi.mock('./modals/ModalEntradaPan', () => ({ hoyISO: () => '2026-09-23' }));

const h = vi.mocked(hojaService);
const v = vi.mocked(ventasService);
const DEUDORES = [
  { destino: 'DELI', grupo: 'CLIENTES', cliente: 'DELI', camioneta: false },
  { destino: 'ISMA', grupo: 'CAMIONETAS', cliente: 'REPARTIDOR ISMA', camioneta: true },
];
const dia = (fecha: string, factura: string, x: Partial<any>) => ({
  fecha, factura, estado: 'pendiente', venta: 0, comision: 0, ayudante: 0, sueldo: 0, recibir: 0, pagado: 0, debe: 0, a_favor: 0, ...x,
});
const ISMA = {
  destino: 'ISMA', cliente: 'REPARTIDOR ISMA', camioneta: true, desde: '2026-09-21', hasta: '2026-09-27',
  dias: [
    dia('2026-09-22', 'SI-1', { estado: 'liquidado', venta: 8761, comision: 876.1, ayudante: 200, sueldo: 1076.1, recibir: 7684.9, pagado: 7684.9 }),
    dia('2026-09-23', 'SI-2', { estado: 'abono', venta: 6571, comision: 657.1, ayudante: 200, sueldo: 857.1, recibir: 5713.9, pagado: 1000, debe: 4713.9 }),
  ],
  total: { venta: 15332, comision: 1533.2, ayudante: 400, sueldo: 1933.2, recibir: 13398.8, pagado: 8684.9, debe: 4713.9, a_favor: 0 },
};

const elegir = async (destino: string) => {
  await screen.findByRole('option', { name: destino });
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: destino } });
};

describe('EstadoCuentaHoja', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.deudores.mockResolvedValue(DEUDORES);
    h.estadoCuenta.mockResolvedValue(ISMA as any);
  });

  it('🔴 camioneta: las seis columnas del cuadro de Diemar, con los números del servidor', async () => {
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    await waitFor(() => expect(h.estadoCuenta).toHaveBeenCalledWith('ISMA', '2026-09-21', '2026-09-27'));
    const fila = (await screen.findByText('22/09/2026')).closest('tr')!;
    for (const t of ['$8,761.00', '$876.10', '$200.00', '$1,076.10', '$7,684.90', 'LIQUIDADO'])
      expect(within(fila).getByText(t)).toBeInTheDocument();
    const abono = screen.getByText('23/09/2026').closest('tr')!;
    expect(within(abono).getByText('Debe $4,713.90')).toBeInTheDocument();
    expect(within(abono).getByText('abonó $1,000.00')).toBeInTheDocument();
    expect(screen.getByText('COMISIÓN 10%')).toBeInTheDocument();
    expect(screen.getByText('RECIBIR/PAGAR')).toBeInTheDocument();
  });

  it('🔴 cliente: sin columnas de comisión, ayudante ni sueldo', async () => {
    h.estadoCuenta.mockResolvedValue({ ...ISMA, destino: 'DELI', cliente: 'DELI', camioneta: false,
      dias: [dia('2026-09-22', 'SI-D', { estado: 'liquidado', venta: 10811, recibir: 10811, pagado: 10811 })],
      total: { ...ISMA.total, debe: 0 } } as any);
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('22/09/2026');
    expect(screen.queryByText('COMISIÓN 10%')).toBeNull();
    expect(screen.queryByText('SUELDO TOTAL')).toBeNull();
    expect(screen.getByText('RECIBIR')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cobrar' })).toBeNull();   // no debe nada
  });

  it('🔴 elegir un día en el calendario pide SU semana lunes-domingo', async () => {
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    await screen.findByText('22/09/2026');
    // un jueves → de su lunes a su domingo
    fireEvent.change(screen.getByLabelText('Semana'), { target: { value: '2026-09-17' } });
    await waitFor(() => expect(h.estadoCuenta).toHaveBeenLastCalledWith('ISMA', '2026-09-14', '2026-09-20'));
    // un domingo es el ÚLTIMO día de su semana, no el primero de la siguiente
    fireEvent.change(screen.getByLabelText('Semana'), { target: { value: '2026-10-04' } });
    await waitFor(() => expect(h.estadoCuenta).toHaveBeenLastCalledWith('ISMA', '2026-09-28', '2026-10-04'));
    expect(screen.getByText('Lunes 28/09/2026 al domingo 04/10/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Semana/ })).toBeNull();
  });

  it('🔴 «Cobrar» abre el modal de siempre con las facturas de PAN con saldo de ese deudor', async () => {
    v.getFacturasPendientes.mockResolvedValue([
      { name: 'SI-2', outstanding_amount: 4713.9 }, { name: 'SI-0', outstanding_amount: 0.001 },
    ] as any);
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(v.getFacturasPendientes).toHaveBeenCalledWith({ customer: 'REPARTIDOR ISMA', tipo: 'pan' }));
    // sin la basurilla de 0.001: una sola factura, deuda exacta
    expect((await screen.findByRole('dialog')).textContent).toBe('COBRO REPARTIDOR ISMA · 1 facturas · 4713.9');
  });

  it('🔴 cambiar rápido de destino: la respuesta vieja que llega tarde no pisa la nueva', async () => {
    let soltarIsma!: (x: any) => void;
    h.estadoCuenta.mockImplementation(((destino: string) => destino === 'ISMA'
      ? new Promise(r => { soltarIsma = r; })
      : Promise.resolve({ ...ISMA, destino: 'DELI', cliente: 'DELI', camioneta: false,
          dias: [dia('2026-09-24', 'SI-D', { estado: 'liquidado', venta: 1, recibir: 1 })], total: { ...ISMA.total, debe: 0 } })) as any);
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    await elegir('DELI');
    await screen.findByText('24/09/2026');
    soltarIsma(ISMA);
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText('22/09/2026')).toBeNull();
    expect(screen.getByText('24/09/2026')).toBeInTheDocument();
  });

  it('🔴 excepción: día con saldo a favor del repartidor', async () => {
    h.estadoCuenta.mockResolvedValue({ ...ISMA,
      dias: [dia('2026-09-25', 'SI-P', { estado: 'liquidado', venta: 12, comision: 1.2, ayudante: 200, sueldo: 201.2, recibir: 0, a_favor: 189.2 })],
      total: { ...ISMA.total, debe: 0, a_favor: 189.2 } } as any);
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    const fila = (await screen.findByText('25/09/2026')).closest('tr')!;
    expect(within(fila).getByText('A FAVOR $189.20')).toBeInTheDocument();
    expect(screen.getByText(/a favor del repartidor \$189\.20/)).toBeInTheDocument();
  });
});
