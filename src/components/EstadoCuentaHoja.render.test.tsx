import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EstadoCuentaHoja, { diasDelRango } from './EstadoCuentaHoja';
import { hojaService } from '../services/frappeHoja';
import { ventasService } from '../services/frappeSales';

vi.mock('../services/frappeHoja', () => ({ hojaService: { deudores: vi.fn(), estadoCuenta: vi.fn(), liquidar: vi.fn() } }));
vi.mock('../services/frappeSales', async (orig) => {
  const actual = await orig<typeof import('../services/frappeSales')>();
  return { ...actual, ventasService: { getFacturasPendientes: vi.fn() } };
});
vi.mock('./modals/ModalRegistrarPago', () => ({
  default: ({ grupo }: any) => <div role="dialog">COBRO {grupo.customer} · {grupo.facturas.length} facturas · {grupo.totalDeuda}</div>,
}));
vi.mock('../utils/hora', async (orig) => ({ ...(await orig<typeof import('../utils/hora')>()), hoyISO: () => '2026-09-23' }));

const h = vi.mocked(hojaService);
const v = vi.mocked(ventasService);
const DEUDORES = [
  { destino: 'DELI', grupo: 'CLIENTES', cliente: 'DELI', camioneta: false },
  { destino: 'ISMA', grupo: 'CAMIONETAS', cliente: 'REPARTIDOR ISMA', camioneta: true },
];
const dia = (fecha: string, factura: string, x: Partial<any>) => ({
  fecha, factura, estado: 'pendiente', venta: 0, comision: 0, ayudante: 0, sueldo: 0, recibir: 0, pagado: 0, debe: 0, a_favor: 0,
  liquidado: null, eva_debe: null, ...x,
});
const ISMA = {
  destino: 'ISMA', cliente: 'REPARTIDOR ISMA', camioneta: true, desde: '2026-09-21', hasta: '2026-09-27',
  dias: [
    dia('2026-09-22', 'SI-1', { estado: 'liquidado', venta: 8761, comision: 876.1, ayudante: 200, sueldo: 1076.1, recibir: 7684.9, pagado: 7684.9 }),
    dia('2026-09-23', 'SI-2', { estado: 'abono', venta: 6571, comision: 657.1, ayudante: 200, sueldo: 857.1, recibir: 5713.9, pagado: 1000, debe: 4713.9 }),
  ],
  puede_liquidar: false,
  total: { venta: 15332, comision: 1533.2, ayudante: 400, sueldo: 1933.2, recibir: 13398.8, pagado: 8684.9, debe: 4713.9, a_favor: 0,
           liquidado: 0, eva_debe: 0 },
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
    for (const t of ['$8,761.00', '$876.10', '$200.00', '$1,076.10', '$7,684.90', 'PAGADO'])
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
    expect(screen.queryByText('DESCUENTO')).toBeNull();                      // sin descuento en la semana
  });

  it('🔴 15-oct: cliente con descuento — columna DESCUENTO entre la venta y lo que se recibe', async () => {
    h.estadoCuenta.mockResolvedValue({ ...ISMA, destino: 'DELI', cliente: 'DELI', camioneta: false,
      dias: [dia('2026-10-12', 'SI-D', { venta: 5082, descuento: 2032.8, recibir: 3049.2, debe: 3049.2 }),
             dia('2026-10-13', 'SI-E', { venta: 100, descuento: 0, recibir: 100, debe: 100 })],
      total: { ...ISMA.total, venta: 5182, descuento: 2032.8, recibir: 3149.2, debe: 3149.2, comision: 0 } } as any);
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    const fila = (await screen.findByText('12/10/2026')).closest('tr')!;
    for (const t of ['$5,082.00', '−$2,032.80', '$3,049.20']) expect(within(fila).getByText(t)).toBeInTheDocument();
    const celdas = within(fila).getAllByRole('cell').map(c => c.textContent);
    expect(celdas.indexOf('−$2,032.80')).toBe(celdas.indexOf('$5,082.00') + 1);
    expect(within(screen.getByText('13/10/2026').closest('tr')!).getAllByRole('cell')[2].textContent).toBe('—');
    expect(screen.getByText('DESCUENTO')).toBeInTheDocument();
    expect(within(screen.getByText('TOTAL').closest('tr')!).getByText('−$2,032.80')).toBeInTheDocument();
  });

  it('🔴 15-oct: la camioneta no lleva columna DESCUENTO (su descuento es la comisión)', async () => {
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    await screen.findByText('22/09/2026');
    expect(screen.queryByText('DESCUENTO')).toBeNull();
  });

  // 20-oct (Diemar): rango libre en vez de semanas; arranca en la semana de hoy
  it('🔴 arranca en la semana de hoy y pide el rango Desde/Hasta que se elija', async () => {
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    await screen.findByText('22/09/2026');
    expect(h.estadoCuenta).toHaveBeenLastCalledWith('ISMA', '2026-09-21', '2026-09-27');   // mié 23 → lun 21..dom 27
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-03' } });
    await waitFor(() => expect(h.estadoCuenta).toHaveBeenLastCalledWith('ISMA', '2026-09-03', '2026-09-27'));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-10' } });
    await waitFor(() => expect(h.estadoCuenta).toHaveBeenLastCalledWith('ISMA', '2026-09-03', '2026-09-10'));
    expect(screen.getByText('3 – 10 sep 2026 · 8 días')).toBeInTheDocument();
  });

  it('🔴 rango al revés o de más de 32 días: avisa y no pregunta al servidor', async () => {
    expect([diasDelRango('2026-09-01', '2026-09-01'), diasDelRango('2026-09-01', '2026-10-02'), diasDelRango('2026-03-01', '2026-03-31')])
      .toEqual([1, 32, 31]);   // 31 de marzo: el cambio de horario no mueve el conteo
    render(<EstadoCuentaHoja />);
    await elegir('ISMA');
    await screen.findByText('22/09/2026');
    const llamadas = h.estadoCuenta.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-08-26' } });   // 33 días
    expect(await screen.findByText('Máximo 32 días por consulta.')).toBeInTheDocument();
    expect(screen.queryByText('22/09/2026')).toBeNull();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-30' } });   // después de «Hasta»
    expect(await screen.findByText('«Hasta» va después de «Desde».')).toBeInTheDocument();
    expect(h.estadoCuenta.mock.calls.length).toBe(llamadas);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-08-27' } });   // 32 justos sí
    await waitFor(() => expect(h.estadoCuenta).toHaveBeenLastCalledWith('ISMA', '2026-08-27', '2026-09-27'));
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

  // 09-oct: LIQUIDADO = lo que Eva le entregó a Luis. Lo dice el servidor (liquidado/eva_debe/puede_liquidar).
  const DELI_LIQ = (puede: boolean) => ({ ...ISMA, destino: 'DELI', cliente: 'DELI', camioneta: false, puede_liquidar: puede,
    dias: [
      dia('2026-09-22', 'SI-1', { estado: 'liquidado', venta: 1000, recibir: 1000, pagado: 1000, liquidado: 900, eva_debe: 100 }),
      dia('2026-09-23', 'SI-2', { estado: 'liquidado', venta: 500, recibir: 500, pagado: 500 }),
      dia('2026-09-24', 'SI-3', { estado: 'pendiente', venta: 300, recibir: 300, debe: 300 }),
      dia('2026-09-25', 'SI-4', { estado: 'liquidado', venta: 200, recibir: 200, pagado: 200, liquidado: 200, eva_debe: 0 }),
      dia('2026-09-26', 'SI-5', { estado: 'liquidado', venta: 100, recibir: 100, pagado: 100, liquidado: 120, eva_debe: -20 }),
    ],
    total: { ...ISMA.total, debe: 300, liquidado: 1220, eva_debe: 80 } });
  const filaDe = (fecha: string) => screen.getByText(fecha).closest('tr')!;

  it('🔴 LIQUIDADO de solo lectura: monto y diferencia del servidor; sin liquidar ≠ debe 0; sin cobro no aplica', async () => {
    h.estadoCuenta.mockResolvedValue(DELI_LIQ(false) as any);
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('22/09/2026');
    expect(screen.getByText('LIQUIDADO')).toBeInTheDocument();
    expect(within(filaDe('22/09/2026')).getByText('$900.00')).toBeInTheDocument();
    expect(within(filaDe('22/09/2026')).getByText('EVA DEBE $100.00')).toBeInTheDocument();
    expect(within(filaDe('23/09/2026')).getByText('POR ENTREGAR $500.00')).toBeInTheDocument();   // sin por_entregar: lo cobrado
    expect(within(filaDe('24/09/2026')).getByText('—')).toBeInTheDocument();
    expect(within(filaDe('25/09/2026')).getByText('ENTREGÓ TODO')).toBeInTheDocument();
    expect(within(filaDe('26/09/2026')).getByText('SOBRA $20.00')).toBeInTheDocument();
    expect(screen.getByText(/\$1,220\.00 · Eva debe \$80\.00/)).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^Liquidado /)).toHaveLength(0);              // no es Luis: no se teclea
  });

  it('🔴 Luis/Administrator: casilla solo en días con cobro; Guardar manda la factura y vuelve a leer', async () => {
    h.estadoCuenta.mockResolvedValue(DELI_LIQ(true) as any);
    h.liquidar.mockResolvedValue({ factura: 'SI-2', liquidado: 450, eva_debe: 50 });
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('22/09/2026');
    expect(screen.getByLabelText('Liquidado 22/09/2026')).toHaveValue(900);        // lo guardado precargado
    expect(screen.getByLabelText('Liquidado 23/09/2026')).toHaveValue(null);       // sin liquidar: vacío, no 0
    expect(screen.queryByLabelText('Liquidado 24/09/2026')).toBeNull();            // pendiente: no se liquida
    const guardar = within(filaDe('23/09/2026')).getByRole('button', { name: 'Guardar' });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Liquidado 23/09/2026'), { target: { value: '450' } });
    const lecturas = h.estadoCuenta.mock.calls.length;
    fireEvent.click(guardar);
    await waitFor(() => expect(h.liquidar).toHaveBeenCalledWith('SI-2', 450));
    await waitFor(() => expect(h.estadoCuenta.mock.calls.length).toBe(lecturas + 1));
  });

  it('🔴 si el servidor rechaza (más de lo cobrado) se ve el error y lo tecleado se queda', async () => {
    h.estadoCuenta.mockResolvedValue(DELI_LIQ(true) as any);
    h.liquidar.mockRejectedValue(new Error('SI-2: no puede pasar de lo cobrado ($500.00).'));
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('23/09/2026');
    fireEvent.change(screen.getByLabelText('Liquidado 23/09/2026'), { target: { value: '600' } });
    fireEvent.keyDown(screen.getByLabelText('Liquidado 23/09/2026'), { key: 'Enter' });
    expect(await screen.findByText(/no puede pasar de lo cobrado/)).toBeInTheDocument();
    expect(screen.getByLabelText('Liquidado 23/09/2026')).toHaveValue(600);
  });

  // 27-oct: EGRESO después de LIQUIDADO, solo si Eva pagó algo con lo cobrado (lo dice el servidor).
  it('🔴 EGRESO: monto del día, folio y quién; sin egresos no hay columna', async () => {
    const pipa = { egreso: 'EGR-2026-0552', cobro: 'ACC-PAY-70', subcategoria: 'AGUA', concepto: 'PIPA', monto: 1276,
                   capturo: 'eva.rh@grace.mx', cuando: '2026-10-22 12:13' };
    const base = DELI_LIQ(false);
    h.estadoCuenta.mockResolvedValue({ ...base,
      dias: [{ ...base.dias[0], egreso: 100, eva_debe: 0, egresos: [pipa] }, ...base.dias.slice(1)],
      total: { ...base.total, egreso: 100 } } as any);
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('22/09/2026');
    expect(screen.getByText('EGRESO')).toBeInTheDocument();
    const fila = filaDe('22/09/2026');
    expect(within(fila).getByText('−$100.00')).toBeInTheDocument();
    expect(within(fila).getByText(/EGR-2026-0552 · AGUA \$1,276\.00 · eva\.rh 10-22 12:13/)).toBeInTheDocument();
    expect(within(fila).getByText('ENTREGÓ TODO')).toBeInTheDocument();      // eva_debe del servidor ya restó el egreso
    expect(screen.getAllByText('−$100.00')).toHaveLength(3);                 // fila, pie y tarjeta
    // EGRESO va entre PAGADO/ABONO y LIQUIDADO (Diemar 27-oct)
    const cabeza = screen.getAllByRole('columnheader').map(th => th.textContent);
    expect(cabeza.slice(-3)).toEqual(['PAGADO/ABONO', 'EGRESO', 'LIQUIDADO']);
    // tarjetas de la caja de Eva: egresos, entregado y lo que falta (por entregar + Eva debe)
    expect(screen.getByText('Pagado en egresos').nextSibling).toHaveTextContent('−$100.00');
    expect(screen.getByText('Entregado a Luis').nextSibling).toHaveTextContent('$1,220.00');
    expect(screen.getByText('Falta entregar').nextSibling).toHaveTextContent('$80.00');
  });

  // 27-oct: sin liquidar, cuánto debe esperar Luis = cobrado − egresos (lo manda el servidor)
  it('🔴 POR ENTREGAR: lo del servidor (con egreso restado), en la insignia, la casilla y el pie', async () => {
    const base = DELI_LIQ(true);
    h.estadoCuenta.mockResolvedValue({ ...base,
      dias: [base.dias[0], { ...base.dias[1], egreso: 276, por_entregar: 224 }, ...base.dias.slice(2)],
      total: { ...base.total, egreso: 276, por_entregar: 224 } } as any);
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('23/09/2026');
    expect(within(filaDe('23/09/2026')).getByText('POR ENTREGAR $224.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Liquidado 23/09/2026')).toHaveAttribute('placeholder', '224');
    expect(screen.getByLabelText('Liquidado 23/09/2026')).toHaveValue(null);    // sugerido, no tecleado
    expect(screen.getByText(/por entregar \$224\.00/)).toBeInTheDocument();
    expect(screen.getByText('Falta entregar').nextSibling).toHaveTextContent('$304.00');   // 224 sin liquidar + 80 que Eva debe
  });

  it('sin egresos en el rango no sale la columna EGRESO', async () => {
    h.estadoCuenta.mockResolvedValue(DELI_LIQ(false) as any);
    render(<EstadoCuentaHoja />);
    await elegir('DELI');
    await screen.findByText('22/09/2026');
    expect(screen.queryByText('EGRESO')).toBeNull();
    expect(screen.queryByText('Pagado en egresos')).toBeNull();
    expect(screen.getByText('Falta entregar').nextSibling).toHaveTextContent('$80.00');   // sí liquidó: la caja sale
  });
});
