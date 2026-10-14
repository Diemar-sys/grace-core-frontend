import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import VistaBolillo from './VistaBolillo';
import { hojaService, type BolilloDia, type Tanda } from '../services/frappeHoja';

vi.mock('../services/frappeHoja', () => ({
  hojaService: { vistaBolillo: vi.fn(), guardarBolillo: vi.fn() },
}));
const almacen = vi.hoisted(() => new Map<string, any>());
vi.mock('../db/borradorLocal', () => ({
  cargarBorradorForm: async (k: string) => almacen.get(k),
  guardarBorradorForm: async (k: string, datos: any) => { if (datos == null) almacen.delete(k); else almacen.set(k, { datos, actualizado: 'x' }); },
  borrarBorradorForm: async (k: string) => { almacen.delete(k); },
}));

const s = vi.mocked(hojaService);
// 14-oct: el servidor manda TODO en piezas; por_charola solo para partir en charolas + sueltas
const ITEMS: BolilloDia['items'] = [
  { item_code: '3001', unidad: 'piezas', por_charola: 16 }, { item_code: '3002', unidad: 'piezas', por_charola: 12 },
  { item_code: '3003', unidad: 'piezas', por_charola: 1 }, { item_code: '3004', unidad: 'piezas', por_charola: 1 },
];
const T = (tanda: number, tipo: string, bolillo: [number, number]): Tanda => ({
  tanda, tipo, segundo: '', horario: '07:00',
  celdas: { '3001': { pedido: bolillo[0], salio: bolillo[1] }, '3002': { pedido: 0, salio: 0 },
            '3003': { pedido: 0, salio: 0 }, '3004': { pedido: 0, salio: 0 } },
});
// en piezas: P.REAL pedido 4 + 24 charolas = 64 + 384; ya salieron 64 en la primera
const DIA = (): BolilloDia => ({
  items: ITEMS,
  destinos: [
    { destino: 'P.REAL', cobrado: false, tandas: [T(1, 'HORNEADO', [64, 64]), T(2, 'CRECIDO', [384, 0])] },
    { destino: 'DEli', cobrado: true, tandas: [T(1, 'HORNEADO', [96, 96])] },
  ],
  camionetas: {
    tandas: [T(1, 'TABLA', [224, 0])],
    salen: [{ destino: 'ISMA', cerrada: false, cobrada: false, cantidades: { '3001': 128 } },
            { destino: 'MARTIN', cerrada: true, cobrada: false, cantidades: { '3001': 96 } }],
  },
});
// TOTALES = la fila del pie; sin columna de etiqueta: 0 = Bolillo
const totalSalio = (tabla: HTMLElement, col: number) =>
  tabla.querySelector('tfoot tr')!.querySelectorAll('td')[col];
const ver = (destino: string) => render(<VistaBolillo fecha="2026-10-06" destino={destino} />);
const ch = (label: string) => screen.getByLabelText(`${label} charolas`);
const pz = (label: string) => screen.getByLabelText(`${label} sueltas`);

describe('VistaBolillo (08-oct; 09-oct PEDIDO | ENVIADO; 14-oct charolas + sueltas)', () => {
  beforeEach(() => { vi.resetAllMocks(); almacen.clear(); s.vistaBolillo.mockResolvedValue(DIA()); });

  it('🔴 solo sale el bolillo del destino elegido', async () => {
    ver('P.REAL');
    expect(await screen.findByRole('table', { name: 'Enviado P.REAL' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Enviado DEli' })).toBeNull();
    expect(screen.queryByRole('table', { name: 'Pedido camionetas' })).toBeNull();
  });

  it('🔴 PEDIDO fijo al lado de ENVIADO, sin hora ni tipo, TOTALES en piezas, sin «+ tanda»', async () => {
    ver('P.REAL');
    const pedido = await screen.findByRole('table', { name: 'Pedido P.REAL' });
    expect(within(pedido).queryAllByRole('spinbutton')).toHaveLength(0);           // no se teclea
    expect(within(pedido).getByText('384')).toBeInTheDocument();                   // la tanda 2, en piezas
    expect(totalSalio(pedido, 0).textContent).toBe('448');                         // 64 + 384, sin × 16 otra vez
    const enviado = screen.getByRole('table', { name: 'Enviado P.REAL' });
    // por tanda: bolillo y telera con charolas + sueltas, mini y baguet una casilla
    expect(within(enviado).getAllByRole('spinbutton')).toHaveLength(2 * (2 + 2 + 1 + 1));
    expect(totalSalio(enviado, 0).textContent).toBe('64');
    for (const t of ['Bolillo', 'Telera', 'Mini Bolillo', 'Baguets']) expect(within(enviado).getByText(t)).toBeInTheDocument();
    expect(screen.queryByText('HORNEADO')).toBeNull();
    expect(screen.queryByText('07:00')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ tanda' })).toBeNull();
  });

  it('🔴 lo guardado se parte en charolas + sueltas (64 bolillos = 4 ch + 0)', async () => {
    ver('P.REAL');
    await screen.findByRole('table', { name: 'Enviado P.REAL' });
    expect(ch('P.REAL tanda 1 BOLILLO')).toHaveValue(4);
    expect(pz('P.REAL tanda 1 BOLILLO')).toHaveValue(0);
    expect(screen.getByLabelText('P.REAL tanda 1 BOLILLO')).toHaveTextContent('= 64 pz');
  });

  it('🔴 teclear charolas recalcula la pieza de la tanda, el total y el color', async () => {
    ver('P.REAL');
    const tabla = await screen.findByRole('table', { name: 'Enviado P.REAL' });
    const suma2 = screen.getByLabelText('P.REAL tanda 2 BOLILLO');
    expect(suma2).toHaveClass('bolillo__total--falta');                 // pedido 384, salió 0
    expect(screen.getByLabelText('P.REAL tanda 1 BOLILLO')).toHaveClass('bolillo__total--exacto');
    fireEvent.change(ch('P.REAL tanda 2 BOLILLO'), { target: { value: '20' } });
    expect(suma2).toHaveTextContent('= 320 pz');
    expect(totalSalio(tabla, 0).textContent).toBe('384');               // 64 + 320
    expect(totalSalio(tabla, 0).querySelector('.bolillo__total--falta')).not.toBeNull();   // pedido 448
    fireEvent.change(ch('P.REAL tanda 2 BOLILLO'), { target: { value: '26' } });
    expect(totalSalio(tabla, 0).querySelector('.bolillo__total--demas')).not.toBeNull();   // 64 + 416
  });

  it('🔴 telera: 5 charolas + 7 sueltas = 67 piezas, y eso es lo que se guarda', async () => {
    ver('P.REAL');
    await screen.findByRole('table', { name: 'Enviado P.REAL' });
    fireEvent.change(ch('P.REAL tanda 2 TELERA'), { target: { value: '5' } });
    fireEvent.change(pz('P.REAL tanda 2 TELERA'), { target: { value: '7' } });
    expect(screen.getByLabelText('P.REAL tanda 2 TELERA')).toHaveTextContent('= 67 pz');
    expect(totalSalio(screen.getByRole('table', { name: 'Enviado P.REAL' }), 1).textContent).toBe('67');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar (1)' }));
    await waitFor(() => expect(s.guardarBolillo).toHaveBeenCalledWith('2026-10-06',
      [{ destino: 'P.REAL', tanda: 2, item_code: '3002', salio: 67 }], []));
  });

  it('mini y baguet: una sola casilla de piezas, sin charolas', async () => {
    ver('P.REAL');
    const mini = await screen.findByLabelText('P.REAL tanda 1 MINI');
    expect(mini.tagName).toBe('INPUT');
    expect(screen.queryByLabelText('P.REAL tanda 1 MINI charolas')).toBeNull();
    fireEvent.change(mini, { target: { value: '30' } });
    expect(totalSalio(screen.getByRole('table', { name: 'Enviado P.REAL' }), 2).textContent).toBe('30');
  });

  it('🔴 Guardar manda SOLO lo que cambió de ESE destino; lo tecleado en otro se queda', async () => {
    s.guardarBolillo.mockResolvedValue(DIA());
    // ISMA traía 9 piezas tecleadas sin guardar de antes: no viajan con P.REAL ni se pierden
    almacen.set('bolillo-dia', { datos: { '2026-10-06': { 'c|ISMA|3001': '9' } }, actualizado: 'x' });
    const { rerender } = ver('P.REAL');
    await screen.findByRole('table', { name: 'Enviado P.REAL' });
    fireEvent.change(ch('P.REAL tanda 2 BOLILLO'), { target: { value: '20' } });
    fireEvent.change(ch('P.REAL tanda 1 BOLILLO'), { target: { value: '4' } });   // igual: no viaja
    fireEvent.click(screen.getByRole('button', { name: 'Guardar (1)' }));
    await waitFor(() => expect(s.guardarBolillo).toHaveBeenCalledWith('2026-10-06',
      [{ destino: 'P.REAL', tanda: 2, item_code: '3001', salio: 320 }], []));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled());
    rerender(<VistaBolillo fecha="2026-10-06" destino="ISMA" />);
    expect(await screen.findByLabelText('ISMA BOLILLO')).toHaveTextContent('= 9 pz');
    expect(pz('ISMA BOLILLO')).toHaveValue(9);
  });

  it('🔴 camioneta: la bolsa y SOLO su renglón; el total es de todas contra la bolsa', async () => {
    s.guardarBolillo.mockResolvedValue(DIA());
    ver('ISMA');
    const tabla = await screen.findByRole('table', { name: 'Enviado ISMA' });
    expect(screen.queryByLabelText('MARTIN BOLILLO')).toBeNull();
    expect(totalSalio(tabla, 0).textContent).toBe('224');             // ISMA 128 + MARTIN 96 = bolsa 224
    expect(totalSalio(tabla, 0).querySelector('.bolillo__total--exacto')).not.toBeNull();
    expect(totalSalio(screen.getByRole('table', { name: 'Pedido camionetas' }), 0).textContent).toBe('224');
    fireEvent.change(ch('ISMA BOLILLO'), { target: { value: '9' } });
    fireEvent.change(pz('ISMA BOLILLO'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar (1)' }));
    await waitFor(() => expect(s.guardarBolillo).toHaveBeenCalledWith('2026-10-06', [],
      [{ destino: 'ISMA', item_code: '3001', cantidad: 147 }]));   // 9 × 16 + 3
  });

  it('🔴 destino cobrado y camioneta que ya salió no se teclean', async () => {
    const { unmount } = ver('DEli');
    await screen.findByRole('table', { name: 'Enviado DEli' });
    expect(ch('DEli tanda 1 BOLILLO')).toBeDisabled();
    expect(pz('DEli tanda 1 BOLILLO')).toBeDisabled();
    expect(screen.getByLabelText('DEli tanda 1 MINI')).toBeDisabled();
    unmount();
    ver('MARTIN');
    await screen.findByRole('table', { name: 'Enviado MARTIN' });
    expect(ch('MARTIN BOLILLO')).toBeDisabled();
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
