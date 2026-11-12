import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ReporteGrupo from './ReporteGrupo';
import { hojaService } from '../services/frappeHoja';

vi.mock('../services/frappeHoja', () => ({ hojaService: { reporteGrupo: vi.fn() } }));
const h = vi.mocked(hojaService);

const COLS = [{ clave: 'venta', titulo: 'ENVIADO' }, { clave: 'efectivo', titulo: 'ENTREGÓ' }, { clave: 'AGUA', titulo: 'AGUA' },
  { clave: 'egreso', titulo: 'TOTAL GASTOS' }, { clave: 'debe', titulo: 'SIN JUSTIFICAR' }];
const PUEBLOS = {
  grupo: 'PUEBLOS', desde: '2026-11-01', hasta: '2026-11-12', columnas: COLS,
  destinos: [
    { destino: 'MILA', sin_cobrar: 0, total: { venta: 3570, efectivo: 2500, AGUA: 500, egreso: 500, debe: 570 },
      dias: [{ fecha: '2026-11-09', nota: '', venta: 1555, efectivo: 1000, AGUA: 500, egreso: 500, debe: 55 },
             { fecha: '2026-11-10', nota: '', venta: 2015, efectivo: 1500, AGUA: 0, egreso: 0, debe: 515 },
             { fecha: '2026-11-11', nota: 'SIN COBRAR', sin_cobrar: 1380 }] },
    { destino: 'VEGIL', sin_cobrar: 0, total: { venta: 800, efectivo: 800, AGUA: 0, egreso: 0, debe: 0 },
      dias: [{ fecha: '2026-11-09', nota: '', venta: 800, efectivo: 800, AGUA: 0, egreso: 0, debe: 0 }] },
  ],
  total: { venta: 4370, efectivo: 3300, AGUA: 500, egreso: 500, debe: 570 },
};

describe('ReporteGrupo', () => {
  beforeEach(() => { vi.resetAllMocks(); h.reporteGrupo.mockResolvedValue(PUEBLOS as any); });

  it('🔴 pinta lo que manda el servidor: columnas, renglones, totales por destino y del grupo; avisa los destinos', async () => {
    const onDestinos = vi.fn();
    render(<ReporteGrupo grupo="PUEBLOS" desde="2026-11-01" hasta="2026-11-12" elegido="" onDestinos={onDestinos} onError={vi.fn()} />);
    const mila = (await screen.findByRole('heading', { name: 'MILA' })).closest('section')!;
    expect(h.reporteGrupo).toHaveBeenCalledWith('PUEBLOS', '2026-11-01', '2026-11-12');
    expect(onDestinos).toHaveBeenCalledWith(['MILA', 'VEGIL']);
    expect(within(mila).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha', 'ENVIADO', 'ENTREGÓ', 'AGUA', 'TOTAL GASTOS', 'SIN JUSTIFICAR']);
    const filas = within(mila).getAllByRole('row');
    expect(filas[1]).toHaveTextContent('$1,555.00$1,000.00$500.00$500.00$55.00');
    expect(filas[2]).toHaveTextContent('$2,015.00$1,500.00——$515.00');          // 0 se pinta —, no $0.00
    expect(filas[3]).toHaveTextContent('SIN COBRAR $1,380.00');
    expect(filas[4]).toHaveTextContent('TOTAL$3,570.00$2,500.00$500.00$500.00$570.00');   // el total es el del servidor
    const grupo = screen.getByRole('heading', { name: 'Todo el grupo' }).closest('section')!;
    expect(grupo).toHaveTextContent('ENVIADO$4,370.00');
    expect(grupo).toHaveTextContent('SIN JUSTIFICAR$570.00');
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
