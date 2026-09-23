// El cableado del modal de cobro: ver QUÉ se debe sin estorbar el cobro.
// Marcar la casilla o teclear el monto no debe desplegar productos, y reabrir
// una factura no vuelve a pegarle al servidor.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModalRegistrarPago from './ModalRegistrarPago';
import { ventasService } from '../../services/frappeSales';

vi.mock('../../services/frappeSales', () => ({
  ventasService: { getFacturaItems: vi.fn(), registrarPago: vi.fn() },
}));

const getFacturaItems = vi.mocked(ventasService.getFacturaItems);
const registrarPago = vi.mocked(ventasService.registrarPago);

const grupo = {
  customer: 'ALEJANDRO TORRES',
  customer_name: 'ALEJANDRO TORRES',
  totalDeuda: 1318.32,
  facturas: [
    { name: 'ACC-SINV-1', posting_date: '2026-08-14', custom_no_de_venta: 56, grand_total: 1260, outstanding_amount: 1260 },
    // Con abono previo: total ≠ saldo, para que cobrar el total en vez del saldo truene.
    { name: 'ACC-SINV-2', posting_date: '2026-08-21', custom_no_de_venta: 63, grand_total: 100, outstanding_amount: 58.32 },
  ],
};

const renglon = (texto: string) => screen.getByText(texto).closest('tr')!;

describe('ModalRegistrarPago — productos de la deuda', () => {
  beforeEach(() => {
    getFacturaItems.mockReset();
    registrarPago.mockReset();
    getFacturaItems.mockResolvedValue([
      { item_code: '1050', item_name: 'CHORREADA', qty: 40, uom: 'Pza', rate: 12.962963, amount: 518.51852,
        precio: 14, importe: 560 },
    ] as never);
  });

  it('🔴 abrir la factura pinta sus productos y reabrirla NO vuelve a pedirlos', async () => {
    render(<ModalRegistrarPago grupo={grupo} onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(renglon('#56'));
    expect(await screen.findByText('CHORREADA')).toBeTruthy();
    expect(getFacturaItems).toHaveBeenCalledWith('ACC-SINV-1');
    // 23-sep: se pinta lo que paga el cliente (con impuesto), no la base de ERPNext
    expect(screen.getByText('$14.00')).toBeTruthy();
    expect(screen.getByText('$560.00')).toBeTruthy();
    expect(screen.queryByText('$12.96')).toBeNull();

    fireEvent.click(renglon('#56'));             // cerrar
    expect(screen.queryByText('CHORREADA')).toBeNull();
    fireEvent.click(renglon('#56'));             // reabrir
    expect(screen.getByText('CHORREADA')).toBeTruthy();
    expect(getFacturaItems).toHaveBeenCalledTimes(1);
  });

  it('🔴 marcar la casilla o teclear el monto no despliega productos', () => {
    render(<ModalRegistrarPago grupo={grupo} onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Pagar factura 56'));
    fireEvent.click(screen.getByLabelText('Monto a cobrar de 63'));
    expect(getFacturaItems).not.toHaveBeenCalled();
  });

  it('🔴 un fallo al cargar productos se ve, no se confunde con factura vacía', async () => {
    getFacturaItems.mockRejectedValueOnce(new Error('Sin permiso'));
    render(<ModalRegistrarPago grupo={grupo} onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(renglon('#56'));
    expect(await screen.findByText('Sin permiso')).toBeTruthy();
  });

  it('se sigue cobrando exactamente lo marcado', async () => {
    registrarPago.mockResolvedValue({} as never);
    const onSuccess = vi.fn();
    render(<ModalRegistrarPago grupo={grupo} onSuccess={onSuccess} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Pagar factura 63'));
    fireEvent.click(screen.getByRole('button', { name: /Registrar pago/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(registrarPago).toHaveBeenCalledWith({
      customer: 'ALEJANDRO TORRES',
      facturas: [{ name: 'ACC-SINV-2', allocated: 58.32 }],
      monto: 58.32,
    });
  });
});
