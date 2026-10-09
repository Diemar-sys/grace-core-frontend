import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import VistaBolillo from './VistaBolillo';
import { hojaService, type BolilloDia, type Tanda } from '../services/frappeHoja';

vi.mock('../services/frappeHoja', () => ({
  hojaService: { vistaBolillo: vi.fn(), guardarBolillo: vi.fn(), agregarTanda: vi.fn() },
}));
const almacen = vi.hoisted(() => new Map<string, any>());
vi.mock('../db/borradorLocal', () => ({
  cargarBorradorForm: async (k: string) => almacen.get(k),
  guardarBorradorForm: async (k: string, datos: any) => { if (datos == null) almacen.delete(k); else almacen.set(k, { datos, actualizado: 'x' }); },
  borrarBorradorForm: async (k: string) => { almacen.delete(k); },
}));

const s = vi.mocked(hojaService);
const ITEMS: BolilloDia['items'] = [
  { item_code: '3001', unidad: 'charolas', por_charola: 16 }, { item_code: '3002', unidad: 'charolas', por_charola: 12 },
  { item_code: '3003', unidad: 'piezas', por_charola: 1 }, { item_code: '3004', unidad: 'piezas', por_charola: 1 },
];
const T = (tanda: number, tipo: string, bolillo: [number, number]): Tanda => ({
  tanda, tipo, segundo: '', horario: '07:00',
  celdas: { '3001': { pedido: bolillo[0], salio: bolillo[1] }, '3002': { pedido: 0, salio: 0 },
            '3003': { pedido: 0, salio: 0 }, '3004': { pedido: 0, salio: 0 } },
});
const DIA = (): BolilloDia => ({
  items: ITEMS,
  destinos: [
    { destino: 'P.REAL', cobrado: false, tandas: [T(1, 'HORNEADO', [4, 4]), T(2, 'CRECIDO', [24, 0])] },
    { destino: 'DEli', cobrado: true, tandas: [T(1, 'HORNEADO', [6, 6])] },
  ],
  camionetas: {
    tandas: [T(1, 'TABLA', [14, 0])],
    salen: [{ destino: 'ISMA', cerrada: false, cobrada: false, cantidades: { '3001': 8 } },
            { destino: 'MARTIN', cerrada: true, cobrada: false, cantidades: { '3001': 6 } }],
  },
});
const totalSalio = (tabla: HTMLElement, col: number) =>
  within(tabla).getAllByRole('row').at(-1)!.querySelectorAll('td')[col];
const ver = (destino: string) => render(<VistaBolillo fecha="2026-10-06" destino={destino} />);

describe('VistaBolillo (08-oct)', () => {
  beforeEach(() => { vi.resetAllMocks(); almacen.clear(); s.vistaBolillo.mockResolvedValue(DIA()); });

  it('🔴 solo sale el bolillo del destino elegido', async () => {
    ver('P.REAL');
    expect(await screen.findByRole('table', { name: 'Bolillo P.REAL' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Bolillo DEli' })).toBeNull();
    expect(screen.queryByRole('table', { name: 'Bolillo camionetas' })).toBeNull();
  });

  it('🔴 teclear recalcula total, piezas y color', async () => {
    ver('P.REAL');
    const tabla = await screen.findByRole('table', { name: 'Bolillo P.REAL' });
    const t2 = screen.getByLabelText('P.REAL tanda 2 BOLILLO');
    expect(t2).toHaveValue(0);
    expect(t2).toHaveClass('hoja-input--falta');                      // pedido 24, salió 0
    expect(screen.getByLabelText('P.REAL tanda 1 BOLILLO')).toHaveClass('hoja-input--exacto');
    fireEvent.change(t2, { target: { value: '20' } });
    expect(totalSalio(tabla, 1).textContent).toBe('24= 384 pz');      // 4 + 20 charolas × 16
    expect(totalSalio(tabla, 1).querySelector('.bolillo__total--falta')).not.toBeNull();   // pedido 28
    fireEvent.change(t2, { target: { value: '26' } });
    expect(totalSalio(tabla, 1).querySelector('.bolillo__total--demas')).not.toBeNull();
  });

  it('🔴 Guardar manda SOLO lo que cambió de ESE destino; lo tecleado en otro se queda', async () => {
    s.guardarBolillo.mockResolvedValue(DIA());
    // ISMA traía algo tecleado sin guardar de antes: no viaja con P.REAL ni se pierde
    almacen.set('bolillo-dia', { datos: { '2026-10-06': { 'c|ISMA|3001': '9' } }, actualizado: 'x' });
    const { rerender } = ver('P.REAL');
    fireEvent.change(await screen.findByLabelText('P.REAL tanda 2 BOLILLO'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('P.REAL tanda 1 BOLILLO'), { target: { value: '4' } });   // igual: no viaja
    fireEvent.click(screen.getByRole('button', { name: 'Guardar (1)' }));
    await waitFor(() => expect(s.guardarBolillo).toHaveBeenCalledWith('2026-10-06',
      [{ destino: 'P.REAL', tanda: 2, item_code: '3001', salio: 20 }], []));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled());
    // al elegir ISMA, su 9 tecleado sigue ahí (no se lo llevó el guardado de P.REAL)
    rerender(<VistaBolillo fecha="2026-10-06" destino="ISMA" />);
    expect(await screen.findByLabelText('ISMA BOLILLO')).toHaveValue(9);
  });

  it('🔴 camioneta: la bolsa y SOLO su renglón; el total es de todas contra la bolsa', async () => {
    s.guardarBolillo.mockResolvedValue(DIA());
    ver('ISMA');
    const tabla = await screen.findByRole('table', { name: 'Bolillo camionetas' });
    expect(screen.queryByLabelText('MARTIN BOLILLO')).toBeNull();
    expect(totalSalio(tabla, 1).textContent).toBe('14= 224 pz');      // ISMA 8 + MARTIN 6 = bolsa 14
    expect(totalSalio(tabla, 1).querySelector('.bolillo__total--exacto')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('ISMA BOLILLO'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar (1)' }));
    await waitFor(() => expect(s.guardarBolillo).toHaveBeenCalledWith('2026-10-06', [],
      [{ destino: 'ISMA', item_code: '3001', cantidad: 9 }]));
  });

  it('🔴 destino cobrado y camioneta que ya salió no se teclean; el cobrado no agrega tandas', async () => {
    const { unmount } = ver('DEli');
    expect(await screen.findByLabelText('DEli tanda 1 BOLILLO')).toBeDisabled();
    expect(screen.queryByRole('button', { name: '+ tanda' })).toBeNull();
    unmount();
    ver('MARTIN');
    expect(await screen.findByLabelText('MARTIN BOLILLO')).toBeDisabled();
  });

  it('+ tanda la pide al servidor para ESE destino', async () => {
    s.agregarTanda.mockResolvedValue(DIA());
    ver('P.REAL');
    fireEvent.click(await screen.findByRole('button', { name: '+ tanda' }));
    await waitFor(() => expect(s.agregarTanda).toHaveBeenCalledWith('2026-10-06', 'P.REAL'));
  });

  it('sin destino lo pide; destino sin tandas (ZAKIA) dice dónde se captura; sin pestaña lo dice', async () => {
    const a = ver('');
    expect(await screen.findByText(/Elige un destino/)).toBeInTheDocument();
    a.unmount();
    const b = ver('ZAKIA');
    expect(await screen.findByText(/ZAKIA no lleva bolillo por tandas/)).toBeInTheDocument();
    b.unmount();
    s.vistaBolillo.mockResolvedValue({ items: ITEMS, destinos: [], camionetas: null });
    ver('P.REAL');
    expect(await screen.findByText(/no trae la pestaña BOLILLO/)).toBeInTheDocument();
  });
});
