// 03-nov (Diemar): cerrar el modal de merma o de salida tiraba la captura.
// Mismo respaldo local que Compras/Envío: se guarda al teclear, se retoma al abrir
// y se borra cuando el documento ya existe en ERPNext.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegistroMerma from './RegistroMerma';
import RegistroSalida from './RegistroSalida';
import { stockService } from '../services/frappeStock';

vi.mock('../services/frappeStock', () => ({
  stockService: {
    fetchAllWarehousesInclusive: vi.fn(), fetchAlmacenesAgrupados: vi.fn(), fetchAlmacenes: vi.fn(),
    registrarMerma: vi.fn(), registrarSalida: vi.fn(), buscarItemsTexto: vi.fn(),
  },
}));
vi.mock('../utils/stockMP', () => ({ fetchStockMapKg: async () => ({ X: { stockKg: 100, actual: 100 } }) }));
vi.mock('../config/clientesB2B', () => ({ getSucursalesDestino: () => [] }));
vi.mock('./SelectorTipoItem', () => ({ default: () => null }));

// IndexedDB en memoria: sobrevive al desmontar (la «recarga» del modal)
const almacen = vi.hoisted(() => new Map());
vi.mock('../db/borradorLocal', () => ({
  cargarBorradorForm: async (k) => almacen.get(k),
  guardarBorradorForm: async (k, datos) => { if (datos == null) almacen.delete(k); else almacen.set(k, { datos, actualizado: 'x' }); },
  borrarBorradorForm: async (k) => { almacen.delete(k); },
}));

const s = vi.mocked(stockService);
const PROD = { name: 'Produccion - G', label: 'Producción' };
const FILA = { _id: 1, item_code: 'X', item_name: 'HARINA', qty: '5', uom: 'Kg', cantPres: 1, presentacion: '' };
const enBorrador = (k) => waitFor(() => expect(almacen.has(k)).toBe(true), { timeout: 2000 });

beforeEach(() => {
  vi.resetAllMocks();
  almacen.clear();
  s.fetchAllWarehousesInclusive.mockResolvedValue([PROD]);
  s.fetchAlmacenesAgrupados.mockResolvedValue([{ tipo: 'DEPTO', almacenes: [PROD] }]);
  s.fetchAlmacenes.mockResolvedValue([PROD]);
  s.registrarMerma.mockResolvedValue({});
  s.registrarSalida.mockResolvedValue({});
});

describe.each([
  ['merma', RegistroMerma, 'merma-inventario', 'Detalle adicional de la merma...', { almacenOrigen: PROD.name, motivo: 'Plaga' }],
  ['salida', RegistroSalida, 'salida-inventario', 'Ej: Pedido para produccion del dia...', { almacenDestino: PROD.name }],
])('%s — borrador local', (_n, Modal, clave, phNotas, extra) => {
  it('🔴 lo tecleado sobrevive a cerrar y volver a abrir', async () => {
    const { unmount } = render(<Modal />);
    await screen.findByText('Producción');   // ya cargó (una persona no teclea en el primer milisegundo)
    fireEvent.change(screen.getByPlaceholderText(phNotas), { target: { value: 'se cayó la charola' } });
    await enBorrador(clave);
    unmount();
    render(<Modal />);
    await waitFor(() => expect(screen.getByPlaceholderText(phNotas)).toHaveValue('se cayó la charola'));
    expect(screen.getByText(/Se retomó/)).toBeInTheDocument();
  });

  it('🔴 retoma los renglones y al confirmar se borra el borrador', async () => {
    almacen.set(clave, { datos: { tipoItem: '', notas: '', filas: [FILA], ...extra }, actualizado: 'x' });
    const { unmount } = render(<Modal />);
    expect(await screen.findByDisplayValue('HARINA')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /^Confirmar/ }));
    const si = screen.queryByRole('button', { name: /Sí, registrar/ });
    if (si) fireEvent.click(si);
    const registrar = Modal === RegistroMerma ? s.registrarMerma : s.registrarSalida;
    await waitFor(() => expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ item_code: 'X', qty: 5, uom: 'Kg' }],
    })));
    // se cierra el modal YA (antes del debounce del autosave): el borrador no puede quedar vivo
    await screen.findByText(/registrada/);
    unmount();
    expect(almacen.has(clave)).toBe(false);
  });

  it('«Descartar» limpia la captura y el borrador', async () => {
    almacen.set(clave, { datos: { tipoItem: '', notas: 'vieja', filas: [FILA], ...extra }, actualizado: 'x' });
    render(<Modal />);
    fireEvent.click(await screen.findByRole('button', { name: /Descartar/ }));
    expect(screen.getByPlaceholderText(phNotas)).toHaveValue('');
    expect(screen.queryByDisplayValue('HARINA')).toBeNull();
    expect(screen.queryByText(/Se retomó/)).toBeNull();
    await waitFor(() => expect(almacen.has(clave)).toBe(false), { timeout: 2000 });
  });
});
