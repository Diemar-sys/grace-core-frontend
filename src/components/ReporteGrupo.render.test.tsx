import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ReporteGrupo from './ReporteGrupo';
import { hojaService } from '../services/frappeHoja';

vi.mock('../services/frappeHoja', () => ({ hojaService: { reporteGrupo: vi.fn() } }));
const h = vi.mocked(hojaService);

// 17-nov: la tabla del jefe — MONTO (efectivo) | 35% | fijos | gastos | TOTAL GASTOS | GANANCIA
const COLS = [{ clave: 'monto', titulo: 'MONTO TOTAL' }, { clave: 'materia', titulo: 'PROD PAN 35%' }, { clave: 'chofer', titulo: 'CHOFER' },
  { clave: 'SUELDO', titulo: 'SUELDO' }, { clave: 'gastos', titulo: 'TOTAL GASTOS' }, { clave: 'ganancia', titulo: 'GANANCIA' }];
const PUEBLOS = {
  grupo: 'PUEBLOS', desde: '2026-11-01', hasta: '2026-11-12',
  columnas: [{ clave: 'monto', titulo: 'MONTO TOTAL' }, { clave: 'gastos', titulo: 'TOTAL GASTOS' }, { clave: 'ganancia', titulo: 'GANANCIA' }],
  destinos: [
    { destino: 'MILA', sin_cobrar: 0, columnas: COLS, total: { monto: 2200, materia: 770, chofer: 300, SUELDO: 650, gastos: 2320, ganancia: -120 },
      dias: [{ fecha: '2026-11-09', nota: '', monto: 1200, materia: 420, chofer: 100, SUELDO: 300, gastos: 1020, ganancia: 180 },
             { fecha: '2026-11-10', nota: 'SIN ENTREGAR', monto: 0, materia: 0, chofer: 100, SUELDO: 0, gastos: 300, ganancia: -300 },
             { fecha: '2026-11-11', nota: '', monto: 1000, materia: 350, chofer: 100, SUELDO: 350, gastos: 1000, ganancia: 0 },
             { fecha: '2026-11-12', nota: 'SIN COBRAR', sin_cobrar: 1380 }] },
    // 17-nov: VEGIL trae SUS columnas (su 10%); las del grupo son las del total de abajo
    { destino: 'VEGIL', sin_cobrar: 0, columnas: [{ clave: 'monto', titulo: 'MONTO TOTAL' }, { clave: 'venta_pueblo', titulo: 'VENTA VEGIL 10%' }, { clave: 'ganancia', titulo: 'GANANCIA' }],
      total: { monto: 800, venta_pueblo: 80, ganancia: 340 },
      dias: [{ fecha: '2026-11-09', nota: '', monto: 800, venta_pueblo: 80, ganancia: 340 }] },
  ],
  total: { monto: 3000, gastos: 2780, ganancia: 220 },
};

describe('ReporteGrupo', () => {
  beforeEach(() => { vi.resetAllMocks(); h.reporteGrupo.mockResolvedValue(PUEBLOS as any); });

  it('🔴 pinta lo que manda el servidor: columnas, renglones, totales por destino y del grupo; avisa los destinos', async () => {
    const onDestinos = vi.fn();
    render(<ReporteGrupo grupo="PUEBLOS" desde="2026-11-01" hasta="2026-11-12" elegido="" onDestinos={onDestinos} onError={vi.fn()} />);
    const mila = (await screen.findByRole('heading', { name: 'MILA' })).closest('section')!;
    expect(h.reporteGrupo).toHaveBeenCalledWith('PUEBLOS', '2026-11-01', '2026-11-12');
    expect(onDestinos).toHaveBeenCalledWith(['MILA', 'VEGIL']);
    expect(within(mila).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha', 'MONTO TOTAL', 'PROD PAN 35%', 'CHOFER', 'SUELDO', 'TOTAL GASTOS', 'GANANCIA']);
    const filas = within(mila).getAllByRole('row');
    // 🔴 la ganancia va con signo: gana +, pierde −, en cero $0.00 (no «—»: cero es un resultado)
    expect(filas[1]).toHaveTextContent('$1,200.00$420.00$100.00$300.00$1,020.00+$180.00');
    expect(filas[2]).toHaveTextContent('SIN ENTREGAR——$100.00—$300.00−$300.00');   // sin efectivo: los fijos cuentan igual
    expect(filas[3]).toHaveTextContent('$1,000.00$350.00$100.00$350.00$1,000.00$0.00');
    expect(within(filas[1]).getByText('+$180.00')).toHaveClass('dif--mas');
    expect(within(filas[2]).getByText('−$300.00')).toHaveClass('dif--menos');
    expect(within(filas[3]).getByText('$0.00')).toHaveClass('dif--cero');
    expect(filas[4]).toHaveTextContent('SIN COBRAR $1,380.00');
    expect(filas[5]).toHaveTextContent('TOTAL$2,200.00$770.00$300.00$650.00$2,320.00−$120.00');   // la sumatoria es la del servidor
    const grupo = screen.getByRole('heading', { name: 'Todo el grupo' }).closest('section')!;
    expect(grupo).toHaveTextContent('MONTO TOTAL$3,000.00');
    const vegil = screen.getByRole('heading', { name: 'VEGIL' }).closest('section')!;
    expect(within(vegil).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha', 'MONTO TOTAL', 'VENTA VEGIL 10%', 'GANANCIA']);
    expect(within(vegil).getAllByRole('row')[1]).toHaveTextContent('$800.00$80.00+$340.00');
    expect(grupo).toHaveTextContent('GANANCIA+$220.00');
    expect(grupo).toHaveTextContent('TOTAL GASTOS$2,780.00');
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
