import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReporteGrupo from './ReporteGrupo';
import { hojaService } from '../../../compartido/services/frappeHoja';

vi.mock('../../../compartido/services/frappeHoja', () => ({ hojaService: { reporteGrupo: vi.fn(), guardarCuentaPuertaReal: vi.fn() } }));
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

  // 24-nov: P.REAL (la tabla del jefe). Las columnas `mano` son input SOLO con puede_capturar; «Guardar» manda
  // solo lo que cambió y vuelve a pedir el reporte (las diferencias las recalcula el servidor).
  const PREAL_COLS = [{ clave: 'monto', titulo: 'MONTO' }, { clave: 'nomina', titulo: 'NÓMINA', mano: true },
    { clave: 'final', titulo: 'DIFERENCIA FINAL' }];
  const sucursales = (puede: boolean) => ({
    grupo: 'SUCURSALES', desde: '2026-11-16', hasta: '2026-11-19', columnas: [{ clave: 'venta', titulo: 'VENTA' }],
    destinos: [{ destino: 'P.REAL', sin_cobrar: 0, puede_capturar: puede, columnas: PREAL_COLS,
      total: { monto: 45418, nomina: 5829, final: 19898.65 },
      // los días completos del jefe: al recalcular en vivo, el día que no se tocó da lo mismo que el servidor
      dias: [{ fecha: '2026-11-16', nota: '', monto: 22608, descuento: 3843.36, abarrote: 480, s_tarjeta: 8933, banco: 8933,
               c_tarjeta: 8677.75, deposito: 16132, nomina: 0, seguro: 0, otro: 0, final: -5565.11 },
             { fecha: '2026-11-19', nota: '', monto: 22810, descuento: 3877.7, abarrote: 1803.2, s_tarjeta: 6174, banco: 6174,
               c_tarjeta: 5999.64, deposito: 14812, nomina: 5829, seguro: 0, otro: 19710.9, final: 25463.76 }] }],
    total: { venta: 45418 },
  });

  it('🔴 P.REAL: sin permiso solo lee; con permiso captura y guarda solo lo cambiado', async () => {
    h.reporteGrupo.mockResolvedValue(sucursales(false) as any);
    const { unmount } = render(<ReporteGrupo grupo="SUCURSALES" desde="2026-11-16" hasta="2026-11-19" elegido="" onDestinos={vi.fn()} onError={vi.fn()} />);
    const sec = (await screen.findByRole('heading', { name: 'P.REAL' })).closest('section')!;
    expect(within(sec).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(sec).queryByRole('button', { name: /Guardar/ })).toBeNull();
    expect(within(sec).getAllByRole('row')[2]).toHaveTextContent('$22,810.00$5,829.00$25,463.76');
    expect(within(sec).getAllByRole('row')[1]).toHaveTextContent('-$5,565.11');
    unmount();

    h.reporteGrupo.mockResolvedValue(sucursales(true) as any);
    h.guardarCuentaPuertaReal.mockResolvedValue({ guardadas: 1 });
    render(<ReporteGrupo grupo="SUCURSALES" desde="2026-11-16" hasta="2026-11-19" elegido="" onDestinos={vi.fn()} onError={vi.fn()} />);
    const sec2 = (await screen.findByRole('heading', { name: 'P.REAL' })).closest('section')!;
    expect(within(sec2).getByLabelText('NÓMINA 2026-11-19')).toHaveValue('5829');
    const guardar = within(sec2).getByRole('button', { name: 'Guardar' });
    expect(guardar).toBeDisabled();                                   // nada cambió
    fireEvent.change(within(sec2).getByLabelText('NÓMINA 2026-11-16'), { target: { value: '5,829' } });
    // en vivo: −5,565.11 + 5,829 = 263.89 en el renglón y en el TOTAL, antes de guardar
    expect(within(sec2).getAllByRole('row')[1]).toHaveTextContent('$22,608.00$263.89');
    expect(within(sec2).getAllByRole('row')[3]).toHaveTextContent('TOTAL$45,418.00$11,658.00$25,727.65');
    fireEvent.change(within(sec2).getByLabelText('NÓMINA 2026-11-19'), { target: { value: 'abc' } });
    expect(within(sec2).getByRole('button', { name: 'Guardar (1)' })).toBeDisabled();   // uno bueno + uno inválido: no se guarda
    expect(sec2).toHaveTextContent('no es un número');
    fireEvent.change(within(sec2).getByLabelText('NÓMINA 2026-11-19'), { target: { value: '5829' } });
    fireEvent.click(within(sec2).getByRole('button', { name: 'Guardar (1)' }));
    await vi.waitFor(() => expect(h.guardarCuentaPuertaReal).toHaveBeenCalledWith([{ fecha: '2026-11-16', nomina: 5829 }]));
    await vi.waitFor(() => expect(h.reporteGrupo).toHaveBeenCalledTimes(3));   // recarga: el servidor recalcula
  });
});
