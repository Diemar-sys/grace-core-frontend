import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { FilaItem } from './Inventario';

afterEach(cleanup);

const mkItem = (overrides = {}) => ({
  item_code: 'MP_AZUCAR',
  custom_código_interno: 'A0001',
  item_name: 'AZUCAR ESTANDAR',
  custom_precio_final: '19.44',
  actual_qty: 2125,
  custom_cantidad_por_presentación: 25,
  custom_presentación: 'BULTO',
  stock_uom: 'Kg',
  ...overrides,
});

describe('FilaItem — columnas en orden correcto', () => {
  it('renderiza código, código interno, nombre, precio, stock, total', () => {
    render(<table><tbody><FilaItem item={mkItem()} /></tbody></table>);
    const cells = screen.getAllByRole('cell');
    expect(cells[0].textContent).toContain('MP_AZUCAR');
    expect(cells[1].textContent).toContain('A0001');
    expect(cells[2].textContent).toContain('AZUCAR ESTANDAR');
    expect(cells[3].textContent).toContain('$19.44');
    expect(cells[4].textContent).toContain('BULTO');
    expect(cells[5].textContent).toContain('2,125.00');
    expect(cells[5].textContent).toContain('Kg');
  });

  it('6 columnas (Unidad de Medida eliminada)', () => {
    render(<table><tbody><FilaItem item={mkItem()} /></tbody></table>);
    expect(screen.getAllByRole('cell')).toHaveLength(6);
  });

  it('código interno "—" si falta custom_código_interno', () => {
    render(<table><tbody><FilaItem item={mkItem({ custom_código_interno: '' })} /></tbody></table>);
    const cells = screen.getAllByRole('cell');
    expect(cells[1].textContent).toBe('—');
  });

  it('stock "Agotado" si actual_qty = 0', () => {
    render(<table><tbody><FilaItem item={mkItem({ actual_qty: 0 })} /></tbody></table>);
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('precio "—" si no tiene custom_precio_final', () => {
    render(<table><tbody><FilaItem item={mkItem({ custom_precio_final: '' })} /></tbody></table>);
    const cells = screen.getAllByRole('cell');
    expect(cells[3].textContent).toBe('—');
  });
});
