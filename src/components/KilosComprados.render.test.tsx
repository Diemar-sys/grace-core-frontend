import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import KilosComprados from './KilosComprados';
import { comprasService } from '../services/frappePurchase';

// Lo que puede mentir en pantalla: pedir otro año, que la pastilla de cuenta
// no filtre, sumar Kg con L en la categoría, o que el insumo no salga al abrir.
const FILAS = [
  { mes: '2026-10', cuenta: 'luis', item_code: 'H1', item_name: 'HARINA TRIGO', item_group: 'HARINA', uom: 'Kg', cantidad: 2350 },
  { mes: '2026-10', cuenta: 'sinFactura', item_code: 'H1', item_name: 'HARINA TRIGO', item_group: 'HARINA', uom: 'Kg', cantidad: 150 },
  { mes: '2026-10', cuenta: 'luis', item_code: 'LECHE', item_name: 'LECHE', item_group: 'LACTEOS', uom: 'L', cantidad: 40 },
  { mes: '2026-10', cuenta: 'luis', item_code: 'CREMA', item_name: 'CREMA', item_group: 'LACTEOS', uom: 'Kg', cantidad: 3 },
];

describe('KilosComprados', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(comprasService, 'getKilosComprados').mockResolvedValue(FILAS);
  });

  const renglon = (nombre: string) => screen.getByText(nombre).closest('tr') as HTMLElement;

  it('pide el año de la pantalla y suma todas las cuentas', async () => {
    render(<KilosComprados anio={2026} />);
    await screen.findByText('HARINA');
    expect(comprasService.getKilosComprados).toHaveBeenCalledWith(2026);
    expect(within(renglon('HARINA')).getAllByText('2,500 Kg')).toHaveLength(2); // Oct y Total
  });

  it('la pastilla de cuenta filtra', async () => {
    render(<KilosComprados anio={2026} />);
    await screen.findByText('HARINA');
    fireEvent.click(screen.getByRole('button', { name: 'Sin factura' }));
    expect(within(renglon('HARINA')).getAllByText('150 Kg')).toHaveLength(2);
    expect(screen.queryByText('LACTEOS')).toBeNull();
  });

  it('Kg y L no se suman en la categoría', async () => {
    render(<KilosComprados anio={2026} />);
    await screen.findByText('LACTEOS');
    expect(within(renglon('LACTEOS')).getAllByText('3 Kg · 40 L')).toHaveLength(2);
  });

  it('la flecha abre los insumos de la categoría', async () => {
    render(<KilosComprados anio={2026} />);
    const boton = (await screen.findByText('HARINA')).closest('button') as HTMLElement;
    expect(renglon('HARINA TRIGO')).toHaveClass('rga-oculto');
    fireEvent.click(boton);
    expect(renglon('HARINA TRIGO')).not.toHaveClass('rga-oculto');
    expect(boton).toHaveAttribute('aria-expanded', 'true');
  });
});
