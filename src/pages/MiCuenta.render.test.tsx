import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MiCuenta, { facturadoPorDia, pctPagado, surtido, techo, totalesFacturas } from './MiCuenta';
import { fechaCorta, fechaLarga, rangoFechas } from '../utils/hora';
import { clienteService } from '../services/frappeCliente';
import { getRoleConfig } from '../config/roles';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappeCliente', () => ({ clienteService: { miCuenta: vi.fn(), miPedido: vi.fn() } }));
const s = vi.mocked(clienteService);

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
    s.miPedido.mockResolvedValue([{ item_code: '1001', producto: 'MANTECADA GDE', piezas: 48, enviado: 40, precio: 14 }]);
    render(<MiCuenta />);
    await screen.findByLabelText('Saldo');
    fireEvent.click(screen.getByRole('button', { name: /^Pedidos$/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver pan' }));
    await waitFor(() => expect(s.miPedido).toHaveBeenCalledWith('2026-10-15'));
    expect(await screen.findByText('MANTECADA GDE')).toBeInTheDocument();
  });
});
