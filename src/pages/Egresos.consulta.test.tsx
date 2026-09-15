// Consulta de egresos: una sola tabla con Categoría → Subcategoría en dropdown,
// en vez de ir y volver por los mosaicos. Lo que se prueba es lo que puede
// mentir: una respuesta vieja pintando otra categoría, un filtro de subcategoría
// que sobrevive al cambio y deja la tabla vacía, y Nómina a quien no la ve.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Egresos from './Egresos';
import { egresosService } from '../services/frappeEgresos';
import { auth } from '../services/frappeAuth';

vi.mock('../components/Layout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('../services/frappeEgresos', () => ({ egresosService: { getEgresos: vi.fn() } }));
vi.mock('../services/frappeAuth', () => ({ auth: { getUser: vi.fn() } }));

const getEgresos = vi.mocked(egresosService.getEgresos);
const getUser = vi.mocked(auth.getUser);

const eg = (name: string, subcategoria: string, concepto: string) =>
  ({ name, fecha: '2026-09-14', subcategoria, concepto, monto: 100, facturado_a: 'LUIS TORRES', pagado: true });

const POR_CATEGORIA: Record<string, unknown[]> = {
  GASTO: [eg('EGR-1', 'GASOLINA', 'TORNADO VAN 1'), eg('EGR-2', 'AGUA', 'GARRAFONES')],
  'ACTIVO FIJO': [eg('EGR-3', 'MAQUINARIA', 'HORNO NUEVO'), eg('EGR-4', 'MOBILIARIO', 'VITRINA')],
  IMPUESTO: [eg('EGR-5', 'IMSS', 'IMSS BIMESTRE')],
};

const montar = async () => {
  render(
    <MemoryRouter initialEntries={['/egresos?modo=consulta']}>
      <Routes>
        <Route path="/egresos" element={<Egresos />} />
        <Route path="/panel" element={<div>PANEL CONSULTAS</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const categoria = () => screen.getByLabelText('Categoría') as HTMLSelectElement;
const opciones = (sel: HTMLSelectElement) => [...sel.options].map(o => o.text);

describe('Egresos en modo consulta', () => {
  beforeEach(() => {
    getUser.mockReturnValue({ role: 'Gerente' } as never);
    getEgresos.mockReset().mockImplementation(async ({ categoria }: { categoria?: string } = {}) =>
      (categoria ? POR_CATEGORIA[categoria] ?? [] : Object.values(POR_CATEGORIA).flat()) as never);
  });

  it('🔴 entra directo a la tabla con TODAS las categorías, sin mosaicos', async () => {
    await montar();
    expect(await screen.findByText('TORNADO VAN 1')).toBeInTheDocument();
    expect(screen.getByText('HORNO NUEVO')).toBeInTheDocument();
    expect(screen.getByText('IMSS BIMESTRE')).toBeInTheDocument();
    expect(getEgresos).toHaveBeenCalledWith({});
    expect(categoria().value).toBe('todas');
    expect(screen.getByRole('heading', { name: 'Egresos' })).toBeInTheDocument();
    expect(opciones(categoria())).toEqual(
      ['Todas', 'Gastos', 'Camioneta (vista)', 'Activo Fijo', 'Préstamos', 'Nómina', 'Impuestos', 'Renta']);
  });

  it('🔴 quien no ve nómina no la tiene en el dropdown', async () => {
    getUser.mockReturnValue({ role: 'Almacén' } as never);
    await montar();
    await screen.findByText('TORNADO VAN 1');
    expect(opciones(categoria())).not.toContain('Nómina');
  });

  it('🔴 cambiar de categoría pide esa categoría y las subcategorías salen de ella, desde «Todas»', async () => {
    await montar();
    await screen.findByText('TORNADO VAN 1');
    fireEvent.change(categoria(), { target: { value: 'Gasto' } });
    expect(await screen.findByText('GARRAFONES')).toBeInTheDocument();
    expect(getEgresos).toHaveBeenLastCalledWith({ categoria: 'GASTO' });
    fireEvent.change(screen.getByLabelText('Subcategoría'), { target: { value: 'AGUA' } });
    expect(screen.queryByText('TORNADO VAN 1')).toBeNull();

    fireEvent.change(categoria(), { target: { value: 'Activo Fijo' } });
    expect(await screen.findByText('HORNO NUEVO')).toBeInTheDocument();
    expect(screen.getByText('VITRINA')).toBeInTheDocument();       // el filtro AGUA no sobrevivió
    const sub = screen.getByLabelText('Subcategoría') as HTMLSelectElement;
    expect(sub.value).toBe('todas');
    expect(opciones(sub)).toEqual(['Todas (2)', 'MAQUINARIA (1)', 'MOBILIARIO (1)']);
  });

  it('🔴 una respuesta vieja que llega tarde no pisa la categoría elegida', async () => {
    let soltarTodas: (v: unknown) => void = () => {};
    getEgresos.mockImplementation(({ categoria }: { categoria?: string } = {}) =>
      !categoria
        ? new Promise(r => { soltarTodas = r; }) as never
        : Promise.resolve(POR_CATEGORIA[categoria] ?? []) as never);
    await montar();
    fireEvent.change(categoria(), { target: { value: 'Impuesto' } });
    expect(await screen.findByText('IMSS BIMESTRE')).toBeInTheDocument();

    await act(async () => { soltarTodas(Object.values(POR_CATEGORIA).flat()); });
    expect(screen.getByText('IMSS BIMESTRE')).toBeInTheDocument();
    expect(screen.queryByText('TORNADO VAN 1')).toBeNull();
  });

  it('Volver regresa a Consultas, no a los mosaicos', async () => {
    await montar();
    await screen.findByText('TORNADO VAN 1');
    fireEvent.click(screen.getByText('← Volver'));
    expect(screen.getByText('PANEL CONSULTAS')).toBeInTheDocument();
  });
});
