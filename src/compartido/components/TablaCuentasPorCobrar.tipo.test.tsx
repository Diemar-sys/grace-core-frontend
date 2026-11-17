// Filtro Tipo (Pan / Abarrote-MP) de Cuentas por Cobrar (Task 12, 22-sep):
// pan se cobra desde la Hoja del día, abarrote/materia prima desde Venta B2B.
// Lo que se prueba: el select manda el `tipo` correcto al servicio (filtrado
// en la BASE, no en el navegador) y "Todo" vuelve a pedir sin tipo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TablaCuentasPorCobrar from './TablaCuentasPorCobrar';
import { ventasService } from '../services/frappeSales';

vi.mock('../services/frappeSales', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/frappeSales')>();
  return { ...actual, ventasService: { ...actual.ventasService, getCuentasPorCobrar: vi.fn(), getFacturasPendientes: vi.fn() } };
});

const getCuentasPorCobrar = vi.mocked(ventasService.getCuentasPorCobrar);
const getFacturasPendientes = vi.mocked(ventasService.getFacturasPendientes);
const DELI = { customer: 'DELI', customer_name: 'DELI', n: 17, total: 20616.21, pagado: 0, pendiente: 20616.21 };

describe('TablaCuentasPorCobrar — filtro Tipo', () => {
  beforeEach(() => {
    getCuentasPorCobrar.mockReset().mockResolvedValue([]);
  });

  it('al montar pide Todo: sin tipo', async () => {
    render(<TablaCuentasPorCobrar />);
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenCalledWith(expect.anything()));
  });

  it('elegir «Pan» pide tipo=pan', async () => {
    render(<TablaCuentasPorCobrar />);
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'pan' } });
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenLastCalledWith(expect.anything(), 'pan'));
  });

  it('elegir «MATERIA PRIMA» pide tipo=abarrote', async () => {
    render(<TablaCuentasPorCobrar />);
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'abarrote' } });
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenLastCalledWith(expect.anything(), 'abarrote'));
  });

  it('volver a «Todo» después de Pan vuelve a pedir sin tipo', async () => {
    render(<TablaCuentasPorCobrar />);
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'pan' } });
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenLastCalledWith(expect.anything(), 'pan'));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '' } });
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenLastCalledWith(expect.anything()));
  });

  // 23-sep (Diemar): con MATERIA PRIMA, el modal de cobro de DELI enseñaba hasta
  // abajo la factura de PAN de la Hoja del día. El modal pide con el mismo tipo.
  it('🔴 «Cobrar» con MATERIA PRIMA pide solo las facturas de ese tipo; con TODO, sin tipo', async () => {
    getCuentasPorCobrar.mockResolvedValue([DELI] as never);
    getFacturasPendientes.mockReset().mockResolvedValue([]);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<TablaCuentasPorCobrar />);

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'abarrote' } });
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenLastCalledWith(expect.anything(), 'abarrote'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(getFacturasPendientes).toHaveBeenLastCalledWith({ customer: 'DELI', tipo: 'abarrote' }));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '' } });
    await waitFor(() => expect(getCuentasPorCobrar).toHaveBeenLastCalledWith(expect.anything()));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(getFacturasPendientes).toHaveBeenLastCalledWith({ customer: 'DELI', tipo: undefined }));
  });

  it('las opciones van en mayúsculas: TODO / PAN / MATERIA PRIMA', () => {
    render(<TablaCuentasPorCobrar />);
    const opciones = [...(screen.getByLabelText('Tipo') as HTMLSelectElement).options].map(o => o.textContent);
    expect(opciones).toEqual(['TODO', 'PAN', 'MATERIA PRIMA']);
  });
});

describe('getFacturasPendientes — filtro por tipo', () => {
  it('pan = factura de la Hoja del día; materia prima = sin pedido; sin tipo = sin filtro', async () => {
    const { ventasService: real } = await vi.importActual<typeof import('../services/frappeSales')>('../services/frappeSales');
    const svc = real as any;
    const original = svc._fetch;
    const urls: string[] = [];
    svc._fetch = vi.fn(async (url: string) => { urls.push(url); return { data: [] }; });
    try {
      await real.getFacturasPendientes({ customer: 'DELI', tipo: 'pan' });
      await real.getFacturasPendientes({ customer: 'DELI', tipo: 'abarrote' });
      await real.getFacturasPendientes({ customer: 'DELI' });
    } finally { svc._fetch = original; }
    const filtros = urls.map(u => JSON.parse(new URLSearchParams(u.split('?')[1]).get('filters')!));
    expect(filtros[0]).toContainEqual(['custom_pedido_diario', 'is', 'set']);
    expect(filtros[1]).toContainEqual(['custom_pedido_diario', 'is', 'not set']);
    expect(JSON.stringify(filtros[2])).not.toContain('custom_pedido_diario');
  });
});
