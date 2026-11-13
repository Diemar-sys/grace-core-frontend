import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ReporteGrupo from './ReporteGrupo';
import { hojaService } from '../services/frappeHoja';

vi.mock('../services/frappeHoja', () => ({ hojaService: { reporteGrupo: vi.fn() } }));
const h = vi.mocked(hojaService);

// 13-nov: la tabla de Diemar — PAN | EFECTIVO | DIFERENCIA | gasto | ENTREGADO
const COLS = [{ clave: 'venta', titulo: 'PAN' }, { clave: 'efectivo', titulo: 'EFECTIVO' }, { clave: 'diferencia', titulo: 'DIFERENCIA' },
  { clave: 'SUELDO', titulo: 'SUELDO' }, { clave: 'egreso', titulo: 'TOTAL GASTOS' }, { clave: 'entregado', titulo: 'ENTREGADO' }];
const PUEBLOS = {
  grupo: 'PUEBLOS', desde: '2026-11-01', hasta: '2026-11-12', columnas: COLS,
  destinos: [
    { destino: 'MILA', sin_cobrar: 0, total: { venta: 8000, efectivo: 6800, diferencia: -1200, SUELDO: 300, egreso: 300, entregado: 6500 },
      dias: [{ fecha: '2026-11-09', nota: '', venta: 1000, efectivo: 1200, diferencia: 200, SUELDO: 300, egreso: 300, entregado: 900 },
             { fecha: '2026-11-10', nota: '', venta: 2000, efectivo: 600, diferencia: -1400, SUELDO: 0, egreso: 0, entregado: 600 },
             { fecha: '2026-11-11', nota: '', venta: 5000, efectivo: 5000, diferencia: 0, SUELDO: 0, egreso: 0, entregado: 5000 },
             { fecha: '2026-11-12', nota: 'SIN COBRAR', sin_cobrar: 1380 }] },
    { destino: 'VEGIL', sin_cobrar: 0, total: { venta: 800, efectivo: 800, diferencia: 0, SUELDO: 0, egreso: 0, entregado: 800 },
      dias: [{ fecha: '2026-11-09', nota: '', venta: 800, efectivo: 800, diferencia: 0, SUELDO: 0, egreso: 0, entregado: 800 }] },
  ],
  total: { venta: 8800, efectivo: 7600, diferencia: -1200, SUELDO: 300, egreso: 300, entregado: 7300 },
};

describe('ReporteGrupo', () => {
  beforeEach(() => { vi.resetAllMocks(); h.reporteGrupo.mockResolvedValue(PUEBLOS as any); });

  it('🔴 pinta lo que manda el servidor: columnas, renglones, totales por destino y del grupo; avisa los destinos', async () => {
    const onDestinos = vi.fn();
    render(<ReporteGrupo grupo="PUEBLOS" desde="2026-11-01" hasta="2026-11-12" elegido="" onDestinos={onDestinos} onError={vi.fn()} />);
    const mila = (await screen.findByRole('heading', { name: 'MILA' })).closest('section')!;
    expect(h.reporteGrupo).toHaveBeenCalledWith('PUEBLOS', '2026-11-01', '2026-11-12');
    expect(onDestinos).toHaveBeenCalledWith(['MILA', 'VEGIL']);
    expect(within(mila).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha', 'PAN', 'EFECTIVO', 'DIFERENCIA', 'SUELDO', 'TOTAL GASTOS', 'ENTREGADO']);
    const filas = within(mila).getAllByRole('row');
    // 🔴 la diferencia va con signo: de más +, de menos −, en cero $0.00 (no «—»: cero es un resultado)
    expect(filas[1]).toHaveTextContent('$1,000.00$1,200.00+$200.00$300.00$300.00$900.00');
    expect(filas[2]).toHaveTextContent('$2,000.00$600.00−$1,400.00——$600.00');        // gasto en 0 se pinta —
    expect(filas[3]).toHaveTextContent('$5,000.00$5,000.00$0.00——$5,000.00');
    expect(within(filas[1]).getByText('+$200.00')).toHaveClass('dif--mas');
    expect(within(filas[2]).getByText('−$1,400.00')).toHaveClass('dif--menos');
    expect(within(filas[3]).getByText('$0.00')).toHaveClass('dif--cero');
    expect(filas[4]).toHaveTextContent('SIN COBRAR $1,380.00');
    expect(filas[5]).toHaveTextContent('TOTAL$8,000.00$6,800.00−$1,200.00$300.00$300.00$6,500.00');   // la sumatoria es la del servidor
    const grupo = screen.getByRole('heading', { name: 'Todo el grupo' }).closest('section')!;
    expect(grupo).toHaveTextContent('PAN$8,800.00');
    expect(grupo).toHaveTextContent('DIFERENCIA−$1,200.00');
    expect(grupo).toHaveTextContent('ENTREGADO$7,300.00');
  });

  it('con un destino elegido solo sale ese y no el total del grupo; si el servidor truena lo dice', async () => {
    const { unmount } = render(<ReporteGrupo grupo="PUEBLOS" desde="2026-11-01" hasta="2026-11-12" elegido="VEGIL" onDestinos={vi.fn()} onError={vi.fn()} />);
    await screen.findByRole('heading', { name: 'VEGIL' });
    expect(screen.queryByRole('heading', { name: 'MILA' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Todo el grupo' })).toBeNull();
    unmount();
    h.reporteGrupo.mockRejectedValue(new Error('El rango va de 1 a 32 días.'));
    const onError = vi.fn();
    render(<ReporteGrupo grupo="CLIENTES" desde="2026-09-01" hasta="2026-11-12" elegido="" onDestinos={vi.fn()} onError={onError} />);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('El rango va de 1 a 32 días.'));
  });
});
