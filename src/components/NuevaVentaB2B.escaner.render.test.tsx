import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NuevaVentaB2B from './NuevaVentaB2B';
import { ventasService } from '../services/frappeSales';
import { stockService } from '../services/frappeStock';

// 04-nov: escáner en venta B2B. Lo que puede mentir: buscar el código por
// NOMBRE (nunca lo encuentra), tomar la primera de dos variantes, colar pan
// por el código, o perder la cascada (el renglón nuevo sin foco: el inputRef
// se pasaba pero FilaProducto no lo recibía).
vi.mock('./BuscadorCliente', () => ({ default: () => <div>cliente</div> }));

const AZUL = { item_code: '7501553905567', item_name: 'VELAS No. 6 AZUL', stock_uom: 'PZA', item_group: 'VELAS', custom_tipo_item: 'MATERIA PRIMA', custom_impuesto: 'tasa0', custom_precio_de_venta: 10 };
const ROSA = { ...AZUL, item_code: 'ABR_VELAS_6_ROSA', item_name: 'VELAS No. 6 ROSA' };
const PAN = { item_code: '75000000999', item_name: 'CONCHA', stock_uom: 'PZA', item_group: 'PAN DULCE', custom_tipo_item: 'PRODUCTO TERMINADO', custom_impuesto: 'tasa0' };

const buscador = () => screen.getAllByLabelText('Buscar producto');
const escanear = (input: HTMLElement, codigo: string) => {
  fireEvent.change(input, { target: { value: codigo } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('NuevaVentaB2B — escáner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(stockService, 'getStockActual').mockResolvedValue({ actual_qty: 50 } as never);
  });

  it('un resultado: entra, cantidad con foco, Enter abre renglón nuevo con foco (cascada)', async () => {
    vi.spyOn(ventasService, 'buscarItems').mockImplementation(async (c = '') => (c === AZUL.item_code ? [AZUL] : []) as never);
    render(<NuevaVentaB2B onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(buscador()[0], AZUL.item_code);
    await waitFor(() => expect(buscador()[0]).toHaveValue('VELAS No. 6 AZUL'));
    await waitFor(() => expect(document.activeElement).not.toBe(buscador()[0]));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });
    await waitFor(() => expect(buscador()).toHaveLength(2));
    await waitFor(() => expect(document.activeElement).toBe(buscador()[1]));
  });

  it('dos variantes: se ofrecen las dos y no entra ninguna sola', async () => {
    vi.spyOn(ventasService, 'buscarItems').mockResolvedValue([AZUL, ROSA] as never);
    render(<NuevaVentaB2B onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(buscador()[0], AZUL.item_code);
    expect(await screen.findByText('VELAS No. 6 ROSA')).toBeInTheDocument();
    expect(screen.getByText('VELAS No. 6 AZUL')).toBeInTheDocument();
    expect(buscador()[0]).toHaveValue(AZUL.item_code);
    fireEvent.mouseDown(screen.getByText('VELAS No. 6 ROSA'));
    await waitFor(() => expect(buscador()[0]).toHaveValue('VELAS No. 6 ROSA'));
  });

  it('el pan no entra por código: aviso', async () => {
    vi.spyOn(ventasService, 'buscarItems').mockResolvedValue([PAN] as never);
    render(<NuevaVentaB2B onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(buscador()[0], PAN.item_code);
    expect(await screen.findByRole('alert')).toHaveTextContent(`Código ${PAN.item_code} no está en venta B2B`);
    expect(buscador()[0]).toHaveValue(PAN.item_code);
  });

  it('código desconocido: aviso que manda a ligarlo en Compras', async () => {
    vi.spyOn(ventasService, 'buscarItems').mockResolvedValue([] as never);
    render(<NuevaVentaB2B onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(buscador()[0], '7509999999999');
    expect(await screen.findByRole('alert')).toHaveTextContent('lígalo en Compras');
  });
});
