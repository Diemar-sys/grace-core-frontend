import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Nomina from './Nomina';
import { nominaService } from './frappeNomina';

// 23-nov: confirmar y cancelar una corrida mueven el gasto de nómina. Antes los
// cuidaba un window.confirm; ahora un ConfirmModal. Si alguien quita la pregunta,
// el servicio se llamaría con el primer clic: estos casos truenan.
vi.mock('../../../app/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../../../compartido/services/printService', () => ({ imprimirNominaTermico: vi.fn() }));
vi.mock('./frappeNomina', () => ({
  nominaService: {
    getEmpleados: vi.fn(), getSucursales: vi.fn(), getCorridas: vi.fn(),
    cancelarCorrida: vi.fn(), crearCorrida: vi.fn(), getCorrida: vi.fn(),
    getUltimoRenglon: vi.fn(), getReporteCostoReal: vi.fn(),
  },
}));
const s = vi.mocked(nominaService);

const CONFIRMADA = {
  name: 'NOM-2026-0099', docstatus: 1, nomina_de: 'LUIS TORRES', fecha_pago: '2026-11-18',
  total_neto: 1000, total_costo: 1200, egreso_generado: 'EGR-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  s.getEmpleados.mockResolvedValue([
    { name: 'EMP-1', employee_name: 'ROSA', custom_nomina_de: 'LUIS TORRES', date_of_joining: '2025-01-01' },
  ] as never);
  s.getSucursales.mockResolvedValue([] as never);
  s.getCorridas.mockResolvedValue([CONFIRMADA] as never);
  s.cancelarCorrida.mockResolvedValue({} as never);
  s.crearCorrida.mockResolvedValue({ name: 'NOM-2026-0100' } as never);
  s.getUltimoRenglon.mockResolvedValue(null as never);
});

describe('Nómina: pregunta antes de mover el gasto', () => {
  it('🔴 cancelar corrida: el × solo pregunta; «Cancelar» no hace nada; «Sí» cancela', async () => {
    render(<Nomina />);
    fireEvent.click(await screen.findByTitle('Cancelar corrida'));
    expect(screen.getByText(`¿Cancelar la corrida ${CONFIRMADA.name}?`)).toBeTruthy();
    expect(s.cancelarCorrida).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(`¿Cancelar la corrida ${CONFIRMADA.name}?`)).toBeNull();
    expect(s.cancelarCorrida).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Cancelar corrida'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar corrida' }));
    await waitFor(() => expect(s.cancelarCorrida).toHaveBeenCalledWith(CONFIRMADA.name));
    expect(s.cancelarCorrida).toHaveBeenCalledTimes(1);
  });

  it('🔴 «Guardar y confirmar» solo pregunta; «Sí, confirmar» guarda con submit=1', async () => {
    render(<Nomina />);
    fireEvent.change(screen.getByLabelText('Nómina de'), { target: { value: 'LUIS TORRES' } });
    const emp = await screen.findByDisplayValue('— elegir empleado —');
    await screen.findByRole('option', { name: 'ROSA' });
    fireEvent.change(emp, { target: { value: 'EMP-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar y confirmar' }));
    expect(screen.getByText('¿Confirmar la corrida?')).toBeTruthy();
    expect(s.crearCorrida).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));
    await waitFor(() => expect(s.crearCorrida).toHaveBeenCalledTimes(1));
    expect(s.crearCorrida.mock.calls[0][0]).toMatchObject({ submit: 1, nomina_de: 'LUIS TORRES' });
  });

  it('«Guardar borrador» no pregunta (no genera gasto)', async () => {
    render(<Nomina />);
    fireEvent.change(screen.getByLabelText('Nómina de'), { target: { value: 'LUIS TORRES' } });
    const emp = await screen.findByDisplayValue('— elegir empleado —');
    await screen.findByRole('option', { name: 'ROSA' });
    fireEvent.change(emp, { target: { value: 'EMP-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(s.crearCorrida).toHaveBeenCalledTimes(1));
    expect(s.crearCorrida.mock.calls[0][0]).toMatchObject({ submit: 0 });
    expect(screen.queryByText('¿Confirmar la corrida?')).toBeNull();
  });
});
