import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Liquidacion from './Liquidacion';
import { hojaService } from '../services/frappeHoja';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappeHoja', () => ({ hojaService: { miHoja: vi.fn(), guardarRegreso: vi.fn() } }));
const s = vi.mocked(hojaService);
const R = {
  item_code: '1047', producto: 'CONCHAS', departamento: 'PAN DULCE', categoria: 'PAN MANTECA',
  impuesto: 'ieps', pedido: 100, enviado: 100, merma: 0, precio: 12, importe: 1200,
};
const R2 = { ...R, item_code: '2000', producto: 'BOLILLO', enviado: 50, importe: 0 };
const mia = (factura: any = null, merma = 0) => ({ destino: 'ISMA', camioneta: true, etapa: 'enviado' as const,
  renglones: [{ ...R, merma }], total: 1200, comision: 320, se_debe: 880, a_favor: 0, factura });

describe('Liquidacion — sobre la hoja, sin inventario', () => {
  beforeEach(() => vi.resetAllMocks());

  it('🔴 el preview cobra lo vendido menos 10% + $200', async () => {
    s.miHoja.mockResolvedValue(mia());
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Merma CONCHAS'), { target: { value: '15' } });
    expect(screen.getByText('$718.00')).toBeInTheDocument();   // (100 − 15) × 12 = 1020 − 302
  });

  it('🔴 la comisión se ve partida: 10% y cuota fija, no un solo número', async () => {
    // 85 × 12 = 1020; comisión total 302 = 102 (10%) + 200 (cuota). Si el 10%
    // se mostrara como los 302 completos (sin restar la cuota), $102.00 no
    // aparecería en pantalla.
    s.miHoja.mockResolvedValue(mia());
    const { container } = render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Merma CONCHAS'), { target: { value: '15' } });
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
    await screen.findByLabelText('Merma CONCHAS');
    // Nada capturado: vendido = 100 (lo enviado), sí hay venta, así que en su
    // lugar se captura TODO como merma para forzar comisión 0.
    fireEvent.change(screen.getByLabelText('Merma CONCHAS'), { target: { value: '100' } });
    expect(screen.queryByText('Comisión 10%')).not.toBeInTheDocument();
    expect(screen.queryByText('Cuota fija')).not.toBeInTheDocument();
  });

  it('🔴 manda la merma de TODOS los renglones, sin almacén ni precio', async () => {
    // BOLILLO (R2) no se toca: si solo se mandaran los tecleados, este
    // renglón se quedaría fuera de la petición aunque el servidor lo espere.
    s.miHoja.mockResolvedValue({ ...mia(), renglones: [R, R2] });
    s.guardarRegreso.mockResolvedValue(mia());
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Merma CONCHAS'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(s.guardarRegreso).toHaveBeenCalledWith(expect.any(String), [
      { item_code: '1047', merma: 10 },
      { item_code: '2000', merma: 0 },
    ]));
  });

  // 12-oct (Diemar): los sabores que cuestan igual se capturan juntos; solo importa el total
  it('🔴 polvorones en UN renglón: se teclea el total y viaja repartido por pan', async () => {
    const P = (item_code: string, producto: string, enviado: number, merma = 0) =>
      ({ ...R, item_code, producto, categoria: 'PAN POLVORON', impuesto: 'tasa0', enviado, merma });
    s.miHoja.mockResolvedValue({ ...mia(), renglones: [R, P('1016', 'POLVORON NARJ', 2, 1), P('1017', 'POLVORON CHOCO', 5)] });
    s.guardarRegreso.mockResolvedValue(mia());
    render(<Liquidacion />);
    const grupo = await screen.findByLabelText('Merma POLVORON');
    expect(grupo).toHaveValue('1');                           // la merma guardada, sumada
    expect(screen.queryByLabelText('Merma POLVORON NARJ')).toBeNull();
    fireEvent.change(grupo, { target: { value: '4' } });
    const tarjeta = grupo.closest('li')!;
    expect(within(tarjeta).getByText('3')).toBeInTheDocument();        // vendido 7 − 4, piezas sin decimales
    expect(within(tarjeta).getByText('$36.00')).toBeInTheDocument();   // 3 × $12
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(s.guardarRegreso).toHaveBeenCalledWith(expect.any(String), [
      { item_code: '1047', merma: 0 },
      { item_code: '1016', merma: 2 },
      { item_code: '1017', merma: 2 },
    ]));
  });

  it('🔴 un grupo con más merma de lo enviado no se deja enviar', async () => {
    const P = (item_code: string, enviado: number) =>
      ({ ...R, item_code, producto: `POLVORON ${item_code}`, categoria: 'PAN POLVORON', impuesto: 'tasa0', enviado });
    s.miHoja.mockResolvedValue({ ...mia(), renglones: [P('1016', 2), P('1017', 5)] });
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Merma POLVORON'), { target: { value: '8' } });
    expect(screen.getByRole('button', { name: /Enviar/ })).toBeDisabled();
    expect(screen.getByLabelText('Merma POLVORON').closest('li')).toHaveClass('liq-renglon--malo');
  });

  it('🔴 el repartidor elige el día: carga y guarda ESE día, no hoy', async () => {
    // 28-sep: MARTIN no pudo liquidar el viernes porque la pantalla solo abría hoy.
    s.miHoja.mockResolvedValue(mia());
    s.guardarRegreso.mockResolvedValue(mia());
    render(<Liquidacion />);
    await screen.findByLabelText('Merma CONCHAS');
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '2026-09-25' } });
    await waitFor(() => expect(s.miHoja).toHaveBeenLastCalledWith('2026-09-25'));
    fireEvent.change(await screen.findByLabelText('Merma CONCHAS'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(s.guardarRegreso).toHaveBeenCalledWith('2026-09-25', expect.any(Array)));
  });

  // 13-oct (Diemar): «todo verde; cuando se ponga en la casilla y altere, cambia de color»
  it('🔴 merma 0 en verde desde que abre; con merma, rojo', async () => {
    s.miHoja.mockResolvedValue(mia());
    render(<Liquidacion />);
    const casilla = await screen.findByLabelText('Merma CONCHAS');
    expect(casilla).toHaveClass('liq-input--sin-merma');
    fireEvent.change(casilla, { target: { value: '4' } });
    expect(casilla).toHaveClass('liq-input--con-merma');
    expect(casilla).not.toHaveClass('liq-input--sin-merma');
    fireEvent.change(casilla, { target: { value: '0' } });
    expect(casilla).toHaveClass('liq-input--sin-merma');
  });

  // 13-oct (Diemar, opción A): la merma se manda UNA vez; después la corrige Héctor
  it('🔴 merma ya enviada: solo lectura, sin «Enviar», con aviso', async () => {
    s.miHoja.mockResolvedValue({ ...mia(null, 3), etapa: 'liquidado' as const });
    render(<Liquidacion />);
    expect(await screen.findByLabelText('Merma CONCHAS')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Enviar/ })).toBeNull();
    expect(screen.getByText(/avisarle al responsable del área/)).toBeInTheDocument();
  });

  it('🔴 al enviar se cierra sola: la hoja que regresa ya viene «liquidado»', async () => {
    s.miHoja.mockResolvedValue(mia());
    s.guardarRegreso.mockResolvedValue({ ...mia(null, 5), etapa: 'liquidado' as const });
    render(<Liquidacion />);
    fireEvent.change(await screen.findByLabelText('Merma CONCHAS'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(screen.getByLabelText('Merma CONCHAS')).toBeDisabled());
    expect(screen.queryByRole('button', { name: /Enviar/ })).toBeNull();
  });

  it('cobrada: solo lectura', async () => {
    s.miHoja.mockResolvedValue(mia({ name: 'ACC-SINV-1', grand_total: 718, outstanding_amount: 718 }));
    render(<Liquidacion />);
    expect(await screen.findByLabelText('Merma CONCHAS')).toBeDisabled();
  });

  // 30-sep (Diemar): merma y regreso son lo mismo. Una sola columna, MERMA, que
  // captura el repartidor; al volver trae lo guardado (o lo que corrigió Héctor).
  it('🔴 una sola columna MERMA: capturable y cargada con lo guardado', async () => {
    s.miHoja.mockResolvedValue(mia(null, 7));
    render(<Liquidacion />);
    expect(await screen.findByLabelText('Merma CONCHAS')).toHaveValue('7');
    expect(screen.queryByText('Regresa')).toBeNull();
    expect(screen.queryByText('Se tiró')).toBeNull();
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
    fireEvent.change(await screen.findByLabelText('Merma CONCHAS'), { target: { value: '9' } });   // vendió 1 × $12
    const totales = within(container.querySelector('.liq-totales')!);
    expect(totales.getByText('Se debe').nextSibling).toHaveTextContent('$0.00');
    expect(totales.getByText('A tu favor').nextSibling).toHaveTextContent('$189.20');   // 1.20 + 200 − 12
  });
});
