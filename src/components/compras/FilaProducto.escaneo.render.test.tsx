// 04-nov: escáner USB en Compras (teclea el código + Enter). Lo que puede mentir:
// que Enter tome la primera sugerencia del nombre, que un código desconocido no
// avise, o que con dos resultados elija uno a ciegas.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FilaProducto from './FilaProducto';
import { comprasService } from '../../services/frappePurchase';

vi.mock('../../services/frappePurchase', async (orig) => ({
  ...(await orig<typeof import('../../services/frappePurchase')>()),
  comprasService: { buscarItems: vi.fn() },
}));

const buscar = vi.mocked(comprasService.buscarItems);
const AZUCAR = { item_code: '7501553905567', item_name: 'AZUCAR ZULKA 1KG', stock_uom: 'Kg', custom_impuesto: 'tasa0' };

const montar = () => {
  const onChange = vi.fn();
  render(<table><tbody><FilaProducto fila={{ bultos: '', rate: '' }} margen={0} onChange={onChange}
    onImpuesto={vi.fn()} onEliminar={vi.fn()} onFocusNext={vi.fn()} inputRef={null} soloUna /></tbody></table>);
  const input = screen.getByPlaceholderText('Buscar producto...');
  const escanear = (codigo: string) => {
    fireEvent.change(input, { target: { value: codigo } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  return { onChange, escanear };
};

describe('Compras: escanear código de barras', () => {
  beforeEach(() => buscar.mockReset());

  it('un resultado → se elige el producto sin esperar el debounce', async () => {
    buscar.mockResolvedValue([AZUCAR]);
    const { onChange, escanear } = montar();
    escanear('7501553905567');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ item_code: '7501553905567' })));
    expect(buscar).toHaveBeenCalledWith('7501553905567');
  });

  it('código desconocido → avisa y no elige nada', async () => {
    buscar.mockResolvedValue([]);
    const { onChange, escanear } = montar();
    escanear('7509999999999');
    expect(await screen.findByRole('alert')).toHaveTextContent('7509999999999 no está en el catálogo');
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ item_code: expect.stringMatching(/./) }));
  });

  it('dos resultados (variantes) → las ofrece y no elige a ciegas', async () => {
    buscar.mockResolvedValue([AZUCAR, { ...AZUCAR, item_code: 'OTRO', item_name: 'AZUCAR ZULKA ROSA' }]);
    const { onChange, escanear } = montar();
    escanear('7501553905567');
    expect(await screen.findByText('AZUCAR ZULKA ROSA')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ item_code: expect.stringMatching(/./) }));
    fireEvent.mouseDown(screen.getByText('AZUCAR ZULKA ROSA'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ item_code: 'OTRO' }));
  });
});
