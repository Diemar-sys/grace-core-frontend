// El cableado de las vistas de CxP: el dropdown «Vista» tiene que llegar a la tabla, al
// strip y al desglose. Las funciones puras ya tienen su test; esto prueba que la
// pantalla las use con la vista elegida y no con todo el dato.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReporteCuentasPorPagar from './ReporteCuentasPorPagar';
import { egresosService } from '../services/frappeEgresos';

vi.mock('../components/Layout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('../services/frappeEgresos', () => ({
  egresosService: { getCuentasPorPagar: vi.fn(), getPendientesProveedor: vi.fn() },
}));

const getCuentasPorPagar = vi.mocked(egresosService.getCuentasPorPagar);
const getPendientesProveedor = vi.mocked(egresosService.getPendientesProveedor);

// Caso difícil: LA CATARINA con compra Y egreso bajo el mismo facturado.
const filas = [
  { proveedor: 'LA CATARINA', facturado_a: 'SIN FACTURA', tipo: 'Compra', n: 1, total: 120, pagado: 0, pendiente: 120 },
  { proveedor: 'LA CATARINA', facturado_a: 'SIN FACTURA', tipo: 'Egreso', n: 2, total: 300, pagado: 20, pendiente: 280 },
  { proveedor: 'EL TRIGAL', facturado_a: 'LUIS TORRES', tipo: 'Compra', n: 1, total: 1000, pagado: 0, pendiente: 1000 },
];
const docs = [
  { name: 'MAT-PRE-1', tipo: 'Compra', fecha: '2026-09-01', folio: 7, factura: 'A1', concepto: '', facturado_a: 'SIN FACTURA', monto: 120 },
  { name: 'EGR-1', tipo: 'Egreso', fecha: '2026-09-02', folio: 8, factura: '', concepto: 'LUZ', facturado_a: 'SIN FACTURA', monto: 280 },
];

const montar = async () => {
  render(<MemoryRouter><ReporteCuentasPorPagar /></MemoryRouter>);
  await screen.findByText('LA CATARINA');
};
const renglon = (texto: string) => screen.getByText(texto).closest('tr')!;
const elegirVista = (vista: string) =>
  fireEvent.change(screen.getByLabelText('Vista'), { target: { value: vista } });

describe('CxP — vistas General / Compras / Egresos', () => {
  beforeEach(() => {
    getCuentasPorPagar.mockReset().mockResolvedValue(filas as never);
    getPendientesProveedor.mockReset().mockResolvedValue(docs as never);
  });

  it('General: LA CATARINA en un renglón con compra + egreso', async () => {
    await montar();
    expect(within(renglon('LA CATARINA')).getByText('$400.00')).toBeInTheDocument();
    expect(screen.getByText(/compras \$1,120\.00 · egresos \$280\.00/)).toBeInTheDocument();
  });

  it('🔴 vista Egresos: la tabla, el total y el strip cargan solo egresos', async () => {
    await montar();
    elegirVista('Egreso');
    expect(within(renglon('LA CATARINA')).getByText('$280.00')).toBeInTheDocument();
    expect(screen.queryByText('EL TRIGAL')).toBeNull();
    expect(screen.getByText('Egresos · total que se debe').previousSibling!.textContent).toBe('$280.00');
    // Strip "Sin factura" = solo el egreso, no 400.
    expect(screen.getByText('Sin factura · se debe').previousSibling!.textContent).toBe('$280.00');
  });

  it('🔴 vista Compras: el desglose enseña solo la compra y cambiar de vista no vuelve a pedir', async () => {
    await montar();
    elegirVista('Compra');
    fireEvent.click(screen.getByText('LA CATARINA'));
    await screen.findByText('#7');
    expect(screen.queryByText('#8')).toBeNull();
    expect(screen.getByText('Lo que se le debe a LA CATARINA (1)')).toBeInTheDocument();

    // El desglose sigue abierto y se refiltra con la vista nueva.
    elegirVista('general');
    await screen.findByText('#8');
    expect(screen.getByText('Lo que se le debe a LA CATARINA (2)')).toBeInTheDocument();
    expect(getPendientesProveedor).toHaveBeenCalledTimes(1);
  });
});
