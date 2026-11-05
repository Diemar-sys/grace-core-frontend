// 04-nov: escáner en cascada en Compras. Lo que puede mentir: que el campo suelte
// el foco tras escanear (se rompe la cascada), que dos bolsas iguales hagan dos
// renglones, o que un código desconocido entre callado.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import NuevaCompra from './NuevaCompra';
import { comprasService } from '../services/frappePurchase';
import { IMPUESTOS_LIST } from '../config/impuestos';

// El alta real tiene su propio test; aquí solo importa QUÉ código recibe y qué pasa al guardar.
let claveCreada = '';
vi.mock('./NuevoInsumo', () => ({
  default: ({ codigoInicial, codigoALigar, onSuccess }: { codigoInicial: string; codigoALigar?: string; onSuccess: (r: object) => void }) => (
    <div role="dialog" aria-label="Alta de insumo">clave [{codigoInicial}] liga [{codigoALigar}]
      <button onClick={() => onSuccess({ item_code: claveCreada || codigoInicial })}>Guardar alta</button></div>
  ),
}));
vi.mock('../hooks/useBorradorLocal', () => ({ default: () => ({ restaurado: null, descartar: vi.fn() }) }));
vi.mock('../services/frappePurchase', async (orig) => ({
  ...(await orig<typeof import('../services/frappePurchase')>()),
  comprasService: { buscarItems: vi.fn(), ligarCodigo: vi.fn(), getImpuestos: vi.fn(), buscarProveedores: vi.fn(async () => []) },
}));

const s = vi.mocked(comprasService);
const CATALOGO: Record<string, object> = {
  '7501553905567': { item_code: '7501553905567', item_name: 'AZUCAR ZULKA 1KG', stock_uom: 'Kg', custom_precio_de_compra: 30, custom_impuesto: 'tasa0' },
  '7500000000002': { item_code: '7500000000002', item_name: 'HARINA', stock_uom: 'Kg', custom_impuesto: 'tasa0' },
};

const REFINADA = { item_code: '7500000000003', item_name: 'AZUCAR REFINADA', stock_uom: 'Kg', 'custom_presentación': 'BULTO', 'custom_cantidad_por_presentación': 50, custom_impuesto: 'tasa0' };

const escanear = (campo: HTMLElement, codigo: string) => {
  fireEvent.change(campo, { target: { value: codigo } });
  fireEvent.keyDown(campo, { key: 'Enter' });
};
const productos = () => screen.getAllByPlaceholderText('Buscar producto...').map(i => (i as HTMLInputElement).value);

describe('Compras: escáner en cascada', () => {
  beforeEach(() => {
    s.buscarItems.mockReset();
    s.ligarCodigo.mockReset();
    s.buscarItems.mockImplementation(async (c = "") => (CATALOGO[c] ? [CATALOGO[c]] : c.startsWith('azu') ? [REFINADA] : []));
    s.getImpuestos.mockReturnValue(IMPUESTOS_LIST as never);
  });

  it('bolsa tras bolsa: un renglón por producto, la repetida suma, el foco no se va', async () => {
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    const campo = screen.getByLabelText('Escanear código de barras');
    campo.focus();
    escanear(campo, '7501553905567');
    escanear(campo, '7500000000002');
    escanear(campo, '7501553905567');
    await waitFor(() => expect(productos()).toEqual(['AZUCAR ZULKA 1KG', 'HARINA']));
    await waitFor(() => expect(screen.getAllByPlaceholderText('0')[0]).toHaveValue(2));
    expect(document.activeElement).toBe(campo);
    expect(campo).toHaveValue('');
  });

  // ── Ligar: código desconocido → elegir producto → CONFIRMAR presentación ──
  const abrirLigar = async (codigo: string) => {
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(screen.getByLabelText('Escanear código de barras'), codigo);
    fireEvent.click(await screen.findByText('Ya existe: ligarlo'));
    fireEvent.change(await screen.findByLabelText('Buscar producto para ligar'), { target: { value: 'azucar ref' } });
    fireEvent.click(await screen.findByText('AZUCAR REFINADA'));
  };

  it('código desconocido: se liga tras confirmar la presentación y entra a la compra', async () => {
    s.ligarCodigo.mockResolvedValue({ ok: true } as never);
    await abrirLigar('7501111111111');
    expect(screen.getByRole('dialog')).toHaveTextContent('BULTO de 50 Kg');
    expect(s.ligarCodigo).not.toHaveBeenCalled();
    expect(productos()).toEqual(['']);
    fireEvent.click(screen.getByText('Sí, ligar'));
    await waitFor(() => expect(productos()).toEqual(['AZUCAR REFINADA']));
    expect(s.ligarCodigo).toHaveBeenCalledWith('7500000000003', '7501111111111');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«No, es otro tamaño» no liga ni agrega', async () => {
    await abrirLigar('7501111111111');
    fireEvent.click(screen.getByText('No, es otro tamaño'));
    expect(screen.getByLabelText('Buscar producto para ligar')).toBeInTheDocument();
    expect(s.ligarCodigo).not.toHaveBeenCalled();
    expect(productos()).toEqual(['']);
  });

  it('si el servidor rechaza (código ya de otro), se ve el porqué y no entra renglón', async () => {
    s.ligarCodigo.mockRejectedValue(new Error('El código 7501111111111 ya es de 7500000000002'));
    await abrirLigar('7501111111111');
    fireEvent.click(screen.getByText('Sí, ligar'));
    expect(await screen.findByText(/ya es de 7500000000002/)).toBeInTheDocument();
    expect(productos()).toEqual(['']);
  });

  it('código desconocido «Es nuevo»: el alta nace con ese código y al guardar entra a la compra', async () => {
    const NUEVO = { item_code: '7501111111111', item_name: 'CHISPAS NUEVAS', stock_uom: 'Kg', custom_impuesto: 'tasa0' };
    let existe = false;
    s.buscarItems.mockImplementation(async (c = '') => (c === NUEVO.item_code && existe ? [NUEVO] : []));
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(screen.getByLabelText('Escanear código de barras'), NUEVO.item_code);
    fireEvent.click(await screen.findByText('Es nuevo: crear producto'));
    expect(screen.getByRole('dialog', { name: 'Alta de insumo' })).toHaveTextContent('clave [7501111111111] liga []');
    existe = true;
    fireEvent.click(screen.getByText('Guardar alta'));
    await waitFor(() => expect(productos()).toEqual(['CHISPAS NUEVAS']));
    expect(screen.queryByRole('dialog', { name: 'Alta de insumo' })).toBeNull();
    expect(s.ligarCodigo).not.toHaveBeenCalled();
  });

  // ── Variantes: Mi Alegría usa el MISMO código para azul y rosa del mismo número ──
  const AZUL6 = { item_code: '7501553905567', item_name: 'VELAS No. 6 AZUL', stock_uom: 'PZA', custom_impuesto: 'tasa0' };
  const ROSA6 = { item_code: '7500000000145', item_name: 'VELAS No. 6 ROSA', stock_uom: 'PZA', custom_impuesto: 'tasa0' };

  it('código con dos variantes: pregunta cuál y entra la elegida, no la primera', async () => {
    s.buscarItems.mockResolvedValue([AZUL6, ROSA6] as never);
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(screen.getByLabelText('Escanear código de barras'), AZUL6.item_code);
    const dialogo = await screen.findByRole('dialog', { name: 'Elegir variante' });
    expect(productos()).toEqual(['']);
    fireEvent.click(within(dialogo).getByText('VELAS No. 6 ROSA'));
    await waitFor(() => expect(productos()).toEqual(['VELAS No. 6 ROSA']));
    expect(screen.queryByRole('dialog', { name: 'Elegir variante' })).toBeNull();
  });

  it('«Ninguno: es otra variante» abre ligar/crear como variante', async () => {
    s.buscarItems.mockResolvedValue([AZUL6, ROSA6] as never);
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(screen.getByLabelText('Escanear código de barras'), AZUL6.item_code);
    fireEvent.click(await screen.findByText('Ninguno: es otra variante'));
    expect(await screen.findByText('Otra variante de este código')).toBeInTheDocument();
    expect(productos()).toEqual(['']);
  });

  it('«No es este»: quita la bolsa que entró y deja ligar la variante', async () => {
    s.buscarItems.mockImplementation(async (c = '') => (c === AZUL6.item_code ? [AZUL6] : c.startsWith('velas') ? [ROSA6] : []) as never);
    s.ligarCodigo.mockResolvedValue({ ok: true } as never);
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(screen.getByLabelText('Escanear código de barras'), AZUL6.item_code);
    await waitFor(() => expect(productos()).toEqual(['VELAS No. 6 AZUL']));
    fireEvent.click(screen.getByText('No es este'));
    await waitFor(() => expect(productos()).toEqual(['']));
    expect(screen.getByText('Otra variante de este código')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ya existe: ligarlo'));
    fireEvent.change(screen.getByLabelText('Buscar producto para ligar'), { target: { value: 'velas 6 rosa' } });
    fireEvent.click(await screen.findByText('VELAS No. 6 ROSA'));
    fireEvent.click(screen.getByText('Sí, ligar'));
    await waitFor(() => expect(productos()).toEqual(['VELAS No. 6 ROSA']));
    expect(s.ligarCodigo).toHaveBeenCalledWith(ROSA6.item_code, AZUL6.item_code);
  });

  it('alta de una variante: NO usa el código como clave (ya es de otra) y lo liga al guardar', async () => {
    const NUEVA = { item_code: 'ABR_VELAS_6_VERDE', item_name: 'VELAS No. 6 VERDE', stock_uom: 'PZA', custom_impuesto: 'tasa0' };
    let ligada = false;
    s.buscarItems.mockImplementation(async (c = '') => (c === AZUL6.item_code ? (ligada ? [AZUL6, NUEVA] : [AZUL6]) : []) as never);
    s.ligarCodigo.mockImplementation(async () => { ligada = true; return { ok: true }; });
    claveCreada = NUEVA.item_code;
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    escanear(screen.getByLabelText('Escanear código de barras'), AZUL6.item_code);
    fireEvent.click(await screen.findByText('No es este'));
    fireEvent.click(await screen.findByText('Es nuevo: crear producto'));
    expect(screen.getByRole('dialog', { name: 'Alta de insumo' })).toHaveTextContent(`clave [] liga [${AZUL6.item_code}]`);
    fireEvent.click(screen.getByText('Guardar alta'));
    await waitFor(() => expect(productos()).toEqual(['VELAS No. 6 VERDE']));
    expect(s.ligarCodigo).toHaveBeenCalledWith(NUEVA.item_code, AZUL6.item_code);
    claveCreada = '';
  });

  it('un dígito tecleado fuera de los campos va al escáner', () => {
    render(<NuevaCompra onSuccess={vi.fn()} onCancel={vi.fn()} />);
    const campo = screen.getByLabelText('Escanear código de barras');
    (document.activeElement as HTMLElement)?.blur();
    fireEvent.keyDown(document.body, { key: '7' });
    expect(document.activeElement).toBe(campo);
  });
});
