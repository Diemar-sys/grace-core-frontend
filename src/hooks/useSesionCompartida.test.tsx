import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { queCambio, useSesionCompartida } from './useSesionCompartida';
import AvisoSesion from '../components/AvisoSesion';

const u = (email: string, role = 'Operaciones') => JSON.stringify({ email, role });
const aviso = (key: string | null, oldValue: string | null, newValue: string | null) =>
  window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue }));

describe('queCambio', () => {
  it('🔴 otro usuario en otra pestaña → «otro», con su correo', () => {
    expect(queCambio('frappe_user', u('hector@grace'), u('martin@grace'))).toEqual({ tipo: 'otro', correo: 'martin@grace' });
  });
  it('🔴 cierre de sesión en otra pestaña → «salio»', () => {
    expect(queCambio('frappe_user', u('hector@grace'), null)).toEqual({ tipo: 'salio' });
  });
  it('🔴 el mismo usuario otra vez (o sus datos de rol) → nada: no bloquear sin razón', () => {
    expect(queCambio('frappe_user', u('hector@grace'), u('hector@grace', 'Gerente'))).toBeNull();
  });
  it('otra clave de localStorage → nada; localStorage.clear() → «salio»', () => {
    expect(queCambio('borrador', 'a', 'b')).toBeNull();
    expect(queCambio(null, null, null)).toEqual({ tipo: 'salio' });
  });
});

describe('useSesionCompartida', () => {
  it('🔴 avisa al llegar el evento de otra pestaña y deja de escuchar al desmontar', () => {
    const { result, unmount } = renderHook(() => useSesionCompartida());
    expect(result.current).toBeNull();
    act(() => aviso('frappe_user', u('hector@grace'), u('martin@grace')));
    expect(result.current).toEqual({ tipo: 'otro', correo: 'martin@grace' });
    const add = vi.spyOn(window, 'removeEventListener');
    unmount();
    expect(add).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});

describe('AvisoSesion', () => {
  it('sin cambio no pinta nada', () => {
    const { container } = render(<AvisoSesion cambio={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('🔴 bloquea: diálogo modal con un solo botón, que recarga; Escape no lo cierra', () => {
    const recargar = vi.fn();
    render(<AvisoSesion cambio={{ tipo: 'otro', correo: 'martin@grace' }} recargar={recargar} />);
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/entró martin@grace/)).toBeInTheDocument();
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(recargar).toHaveBeenCalledTimes(1);
  });
  it('salida: pide iniciar sesión', () => {
    render(<AvisoSesion cambio={{ tipo: 'salio' }} recargar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});

// ponytail: revisa el texto de App.jsx en vez de montar la app entera (router,
// providers, servicios). Tope: no prueba que corra, solo que siga enchufado.
describe('App monta el aviso entre pestañas', () => {
  it('🔴 App.jsx usa el hook y pinta <AvisoSesion>', async () => {
    const fs = await import('node:fs');
    const app = fs.readFileSync(`${process.cwd()}/src/App.jsx`, 'utf8');   // vitest corre desde la raíz
    expect(app).toMatch(/const cambioSesion = useSesionCompartida\(\);/);
    expect(app).toMatch(/<AvisoSesion cambio=\{cambioSesion\} \/>/);
  });
});
