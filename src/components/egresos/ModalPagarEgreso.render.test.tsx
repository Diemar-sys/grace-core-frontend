// 27-oct: «Por pagar» pregunta con qué se pagó. Lo que puede mentir: marcar pagado sin preguntar,
// mandar el cobro equivocado (o ninguno), dejar elegir un cobro que no alcanza, o tragarse el
// rechazo del servidor (Eva desmarcando un egreso pagado con cobro).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Egresos from '../../pages/Egresos';
import { egresosService } from '../../services/frappeEgresos';
import { auth } from '../../services/frappeAuth';

vi.mock('../Layout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('../../services/frappeEgresos', () => ({
  egresosService: { getEgresos: vi.fn(), marcarPagado: vi.fn(), cobrosParaEgreso: vi.fn() },
}));
vi.mock('../../services/frappeAuth', () => ({ auth: { getUser: vi.fn() } }));

const s = vi.mocked(egresosService);
const PIPA = { name: 'EGR-552', fecha: '2026-10-22', subcategoria: 'AGUA', concepto: 'PIPA DE AGUA', monto: 1276, pagado: 0 };
const CON_COBRO = { ...PIPA, name: 'EGR-553', concepto: 'GARRAFONES', pagado: 1, pagado_con: 'ACC-PAY-70' };
const COBROS = [
  { cobro: 'ACC-PAY-70', cliente: 'SR GUSTAVO', fecha: '2026-10-25', facturas: ['F23', 'F24', 'F25'], recibido: 5995, disponible: 5995 },
  { cobro: 'ACC-PAY-71', cliente: 'DELI', fecha: '2026-10-26', facturas: ['F26'], recibido: 1500, disponible: 300 },
];

const montar = async () => {
  render(<MemoryRouter initialEntries={['/egresos?modo=consulta']}><Egresos /></MemoryRouter>);
  return (await screen.findByText('PIPA DE AGUA')).closest('tr')!;
};

describe('Egresos: ¿con qué se pagó?', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.getUser).mockReturnValue({ role: 'Gerente' } as never);
    s.getEgresos.mockResolvedValue([PIPA, CON_COBRO] as never);
    s.cobrosParaEgreso.mockResolvedValue(COBROS);
    s.marcarPagado.mockImplementation(async (name, pagado, cobro) => ({ name, pagado, pagado_con: cobro ?? null }));
  });

  it('🔴 «Por pagar» pregunta antes de marcar; «Pago normal» manda sin cobro', async () => {
    const fila = await montar();
    fireEvent.click(within(fila).getByText('Por pagar'));
    expect(await screen.findByRole('dialog', { name: '¿Con qué se pagó?' })).toBeInTheDocument();
    expect(s.marcarPagado).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Pago normal'));
    await waitFor(() => expect(s.marcarPagado).toHaveBeenCalledWith('EGR-552', 1, null));
    expect(within(fila).getByText('✓ Pagado')).toBeInTheDocument();
  });

  it('🔴 con cobro: manda ESE cobro; el que no alcanza no se deja elegir', async () => {
    const fila = await montar();
    fireEvent.click(within(fila).getByText('Por pagar'));
    const gus = await screen.findByRole('radio', { name: /ACC-PAY-70/ });
    const deli = screen.getByRole('radio', { name: /ACC-PAY-71/ });
    expect(deli).toBeDisabled();                                   // 300 < 1,276
    expect(screen.getByText('solo quedan $300.00')).toBeInTheDocument();
    expect(screen.getByText('Pagar con este cobro')).toBeDisabled();   // sin elegir
    fireEvent.click(gus);
    fireEvent.click(screen.getByText('Pagar con este cobro'));
    await waitFor(() => expect(s.marcarPagado).toHaveBeenCalledWith('EGR-552', 1, 'ACC-PAY-70'));
    expect(within(fila).getByText('✓ Con cobro')).toBeInTheDocument();
  });

  it('🔴 el rechazo del servidor se ve y el modal se queda', async () => {
    s.marcarPagado.mockRejectedValue(new Error('EGR-552 es de $1276.0 y del cobro ACC-PAY-70 solo quedan $1000.0.'));
    const fila = await montar();
    fireEvent.click(within(fila).getByText('Por pagar'));
    fireEvent.click(await screen.findByRole('radio', { name: /ACC-PAY-70/ }));
    fireEvent.click(screen.getByText('Pagar con este cobro'));
    expect(await screen.findByText(/solo quedan \$1000\.0/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(fila).getByText('Por pagar')).toBeInTheDocument();
  });

  it('🔴 pagado con cobro: dice «Con cobro» y si el servidor no deja quitarlo, el porqué se ve', async () => {
    s.marcarPagado.mockRejectedValue(new Error('EGR-553 se pagó con el cobro ACC-PAY-70: solo Luis o Administrator lo quitan.'));
    await montar();
    const btn = screen.getByText('✓ Con cobro');
    expect(btn).toHaveAttribute('title', expect.stringContaining('ACC-PAY-70'));
    fireEvent.click(btn);
    await waitFor(() => expect(s.marcarPagado).toHaveBeenCalledWith('EGR-553', 0));
    expect(await screen.findByText(/solo Luis o Administrator lo quitan/)).toBeInTheDocument();
    expect(screen.getByText('✓ Con cobro')).toBeInTheDocument();          // el renglón no se queda «Por pagar»
  });
});
