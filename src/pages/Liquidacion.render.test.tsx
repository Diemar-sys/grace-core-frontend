import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Liquidacion from './Liquidacion';
import { hojaService } from '../services/frappeHoja';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappeHoja', () => ({ hojaService: { miHoja: vi.fn(), guardarRegreso: vi.fn() } }));
const s = vi.mocked(hojaService);
const R = {
  item_code: '1047', producto: 'CONCHAS', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
  impuesto: 'ieps', pedido: 100, enviado: 100, regreso: 0, merma: 0, precio: 12, importe: 1200,
};
const R2 = { ...R, item_code: '2000', producto: 'BOLILLO', enviado: 50, importe: 0 };
const mia = (factura: any = null) => ({ destino: 'ISMA', camioneta: true, renglones: [R], total: 1200, comision: 320, se_debe: 880, factura });

describe('Liquidacion — sobre la hoja, sin inventario', () => {
  beforeEach(() => vi.resetAllMocks());

  it('🔴 el preview cobra lo vendido menos 10% + $200', async () => {
    s.miHoja.mockResolvedValue(mia());
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Se tiró CONCHAS'), { target: { value: '5' } });
    expect(screen.getByText('$718.00')).toBeInTheDocument();   // 85 × 12 = 1020 − 302
  });

  it('🔴 la comisión se ve partida: 10% y cuota fija, no un solo número', async () => {
    // 85 × 12 = 1020; comisión total 302 = 102 (10%) + 200 (cuota). Si el 10%
    // se mostrara como los 302 completos (sin restar la cuota), $102.00 no
    // aparecería en pantalla.
    s.miHoja.mockResolvedValue(mia());
    const { container } = render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Se tiró CONCHAS'), { target: { value: '5' } });
    const totales = within(container.querySelector('.liq-totales')!);
    expect(totales.getByText('Venta')).toBeInTheDocument();
    expect(totales.getByText('$1,020.00')).toBeInTheDocument();
    expect(totales.getByText('Comisión 10%')).toBeInTheDocument();
    expect(totales.getByText('$102.00')).toBeInTheDocument();
    expect(totales.getByText('Cuota fija')).toBeInTheDocument();
    expect(totales.getByText('$200.00')).toBeInTheDocument();
    expect(totales.getByText('Se debe')).toBeInTheDocument();
    expect(totales.getByText('$718.00')).toBeInTheDocument();
  });

  it('sin venta no se muestran renglones de comisión', async () => {
    s.miHoja.mockResolvedValue(mia());
    render(<Liquidacion />);
    await screen.findByLabelText('Regresa CONCHAS');
    // Nada capturado: vendido = 100 (lo enviado), sí hay venta, así que en su
    // lugar se regresa/tira TODO para forzar comisión 0.
    fireEvent.change(screen.getByLabelText('Regresa CONCHAS'), { target: { value: '100' } });
    expect(screen.queryByText('Comisión 10%')).not.toBeInTheDocument();
    expect(screen.queryByText('Cuota fija')).not.toBeInTheDocument();
  });

  it('🔴 manda regreso y merma de TODOS los renglones, sin almacén ni precio', async () => {
    // BOLILLO (R2) no se toca: si solo se mandaran los tecleados, este
    // renglón se quedaría fuera de la petición aunque el servidor lo espere.
    s.miHoja.mockResolvedValue({ ...mia(), renglones: [R, R2] });
    s.guardarRegreso.mockResolvedValue(mia());
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(s.guardarRegreso).toHaveBeenCalledWith(expect.any(String), [
      { item_code: '1047', regreso: 10, merma: 0 },
      { item_code: '2000', regreso: 0, merma: 0 },
    ]));
  });

  it('cobrada: solo lectura', async () => {
    s.miHoja.mockResolvedValue(mia({ name: 'ACC-SINV-1', grand_total: 718, outstanding_amount: 718 }));
    render(<Liquidacion />);
    expect(await screen.findByLabelText('Regresa CONCHAS')).toBeDisabled();
    expect(screen.getByLabelText('Se tiró CONCHAS')).toBeDisabled();
  });
});
