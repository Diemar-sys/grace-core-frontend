import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Cuentas, { ultimoAcceso } from './Cuentas';
import { cuentasService } from '../services/frappeCuentas';

vi.mock('../components/Layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('../services/frappeCuentas', () => ({
  cuentasService: {
    listarUsuarios: vi.fn(), listarNiveles: vi.fn(), listarPosProfiles: vi.fn(),
    cambiarNivel: vi.fn(), cambiarPosProfile: vi.fn(), setHabilitado: vi.fn(), editarUsuario: vi.fn(), crearUsuario: vi.fn(),
  },
}));
const s = vi.mocked(cuentasService);

const USUARIOS = [
  { name: 'admin.puertareal@grace.local', full_name: 'Admin Puerta Real', enabled: 1, nivel: 'Cliente', pos_profile: null,
    es_system_manager: false, last_login: '2026-04-30 10:21:56.412020',
    custom_cliente: 'ALEJANDRO TORRES', custom_cliente_almacen: 'PUERTA REAL - PG' },
  { name: 'hector.th@grace.mx', full_name: 'Hector Torres', enabled: 1, nivel: 'Operaciones', pos_profile: 'Grace POS',
    es_system_manager: false, last_login: null },
];

// 16-oct (Diemar): clic en el usuario abre su ficha en un modal
describe('Cuentas — ficha del usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.listarUsuarios.mockResolvedValue(USUARIOS);
    s.listarNiveles.mockResolvedValue(['Vendedor', 'Operaciones', 'Cliente']);
    s.listarPosProfiles.mockResolvedValue(['Grace POS']);
    s.setHabilitado.mockResolvedValue({});
  });

  it('último acceso legible, y «Nunca» sin acceso', () => {
    expect(ultimoAcceso('2026-04-30 10:21:56.412020')).toBe('30/04/2026 10:21');
    expect(ultimoAcceso(null)).toBe('Nunca');
  });

  it('la ficha del cliente dice de quién es la cuenta', async () => {
    render(<Cuentas />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver ficha de admin.puertareal@grace.local' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByLabelText('Cuenta de cliente')).toHaveTextContent('ALEJANDRO TORRES');
    expect(within(d).getByText('PUERTA REAL - PG')).toBeInTheDocument();
    expect(within(d).getByText('30/04/2026 10:21')).toBeInTheDocument();
  });

  it('otro nivel no enseña la cuenta de cliente; deshabilitar va al usuario de la ficha', async () => {
    render(<Cuentas />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver ficha de hector.th@grace.mx' }));
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByLabelText('Cuenta de cliente')).toBeNull();
    expect(within(d).getByText('Nunca')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'DESHABILITAR' }));
    expect(s.setHabilitado).toHaveBeenCalledWith('hector.th@grace.mx', false);
  });
});
