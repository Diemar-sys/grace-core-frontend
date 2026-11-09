import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Recuperar, { problemaConClave } from './Recuperar';
import { auth } from '../services/frappeAuth';

vi.mock('../services/frappeAuth', () => ({ auth: { pedirRecuperacion: vi.fn(), cambiarConLlave: vi.fn() } }));
const a = vi.mocked(auth);

function LoginFalso() {
  return <div>LOGIN {(useLocation().state as any)?.aviso}</div>;
}
const montar = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/update-password" element={<Recuperar />} />
      <Route path="/login" element={<LoginFalso />} />
    </Routes>
  </MemoryRouter>);

describe('Recuperar contraseña (09-nov)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('problemaConClave: mínimo 8, máximo 128, las dos iguales', () => {
    expect(problemaConClave('1234567', '1234567')).toMatch(/al menos 8/);
    expect(problemaConClave('x'.repeat(129), 'x'.repeat(129))).toMatch(/larga/);
    expect(problemaConClave('12345678', '12345679')).toMatch(/no coinciden/);
    expect(problemaConClave('12345678', '12345678')).toBeNull();
  });

  it('🔴 pedir: manda lo tecleado (sin espacios) y enseña la respuesta del servidor tal cual', async () => {
    a.pedirRecuperacion.mockResolvedValue('Si la cuenta existe, te llegó un enlace.');
    montar('/recuperar');
    fireEvent.change(screen.getByLabelText('Usuario o correo'), { target: { value: '  hector.th@grace.mx ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mandar enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si la cuenta existe, te llegó un enlace.');
    expect(a.pedirRecuperacion).toHaveBeenCalledWith('hector.th@grace.mx');
    expect(screen.queryByRole('button', { name: 'Mandar enlace' })).toBeNull();   // no se reenvía en bucle
  });

  it('🔴 enlace del correo: no manda una clave corta ni distinta; con la buena manda la LLAVE del enlace y regresa al Login', async () => {
    a.cambiarConLlave.mockResolvedValue();
    montar('/update-password?key=abc123');
    const nueva = screen.getByLabelText('Contraseña nueva');
    const otra = screen.getByLabelText('Otra vez');
    fireEvent.change(nueva, { target: { value: 'corta' } });
    fireEvent.change(otra, { target: { value: 'corta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos 8/);
    fireEvent.change(nueva, { target: { value: 'panGrace2026' } });
    fireEvent.change(otra, { target: { value: 'panGrace2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no coinciden/);
    expect(a.cambiarConLlave).not.toHaveBeenCalled();
    fireEvent.change(otra, { target: { value: 'panGrace2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(a.cambiarConLlave).toHaveBeenCalledWith('abc123', 'panGrace2026'));
    expect(await screen.findByText(/LOGIN Listo: entra con tu contraseña nueva/)).toBeInTheDocument();
  });

  it('🔴 enlace vencido: se queda y dice por qué', async () => {
    a.cambiarConLlave.mockRejectedValue(new Error('El enlace ya venció o ya se usó. Pide otro.'));
    montar('/update-password?key=viejo');
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'panGrace2026' } });
    fireEvent.change(screen.getByLabelText('Otra vez'), { target: { value: 'panGrace2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace ya venció');
    expect(screen.queryByText(/^LOGIN/)).toBeNull();
  });
});
