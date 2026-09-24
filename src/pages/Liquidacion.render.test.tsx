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
const mia = (factura: any = null, merma = 0) => ({ destino: 'ISMA', camioneta: true, etapa: 'enviado' as const,
  renglones: [{ ...R, merma }], total: 1200, comision: 320, se_debe: 880, a_favor: 0, factura });

describe('Liquidacion — sobre la hoja, sin inventario', () => {
  beforeEach(() => vi.resetAllMocks());

  it('🔴 el preview cobra lo vendido menos 10% + $200', async () => {
    s.miHoja.mockResolvedValue(mia(null, 5));   // la merma (5) la puso Héctor
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '10' } });
    expect(screen.getByText('$718.00')).toBeInTheDocument();   // 85 × 12 = 1020 − 302
  });

  it('🔴 la comisión se ve partida: 10% y cuota fija, no un solo número', async () => {
    // 85 × 12 = 1020; comisión total 302 = 102 (10%) + 200 (cuota). Si el 10%
    // se mostrara como los 302 completos (sin restar la cuota), $102.00 no
    // aparecería en pantalla.
    s.miHoja.mockResolvedValue(mia(null, 5));
    const { container } = render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '10' } });
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

  it('🔴 manda el regreso de TODOS los renglones, sin merma, almacén ni precio', async () => {
    // BOLILLO (R2) no se toca: si solo se mandaran los tecleados, este
    // renglón se quedaría fuera de la petición aunque el servidor lo espere.
    s.miHoja.mockResolvedValue({ ...mia(), renglones: [R, R2] });
    s.guardarRegreso.mockResolvedValue(mia());
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(s.guardarRegreso).toHaveBeenCalledWith(expect.any(String), [
      { item_code: '1047', regreso: 10 },
      { item_code: '2000', regreso: 0 },
    ]));
  });

  it('cobrada: solo lectura', async () => {
    s.miHoja.mockResolvedValue(mia({ name: 'ACC-SINV-1', grand_total: 718, outstanding_amount: 718 }));
    render(<Liquidacion />);
    expect(await screen.findByLabelText('Regresa CONCHAS')).toBeDisabled();
  });

  // 23-sep (Diemar): la merma la pone Héctor; el repartidor la ve, no la teclea
  it('🔴 «Se tiró» no se captura aquí: se ve la merma que puso Héctor', async () => {
    s.miHoja.mockResolvedValue(mia(null, 7));
    render(<Liquidacion />);
    await screen.findByLabelText('Regresa CONCHAS');
    expect(screen.queryByLabelText('Se tiró CONCHAS')).toBeNull();
    expect(screen.getByText('7.00')).toBeInTheDocument();
  });

  it('🔴 antes de que matriz confirme el envío: aviso, sin tabla', async () => {
    s.miHoja.mockResolvedValue({ ...mia(), etapa: '' as const, renglones: [], total: 0, comision: 0, se_debe: 0 });
    render(<Liquidacion />);
    expect(await screen.findByText(/Todavía no te envían pan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar/ })).toBeNull();
  });

  it('🔴 excepción: vende menos que su sueldo → se debe $0 y «A tu favor»', async () => {
    s.miHoja.mockResolvedValue({ ...mia(), renglones: [{ ...R, enviado: 10 }] });
    const { container } = render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Regresa CONCHAS'), { target: { value: '9' } });   // vendió 1 × $12
    const totales = within(container.querySelector('.liq-totales')!);
    expect(totales.getByText('Se debe').nextSibling).toHaveTextContent('$0.00');
    expect(totales.getByText('A tu favor').nextSibling).toHaveTextContent('$189.20');   // 1.20 + 200 − 12
  });
});
