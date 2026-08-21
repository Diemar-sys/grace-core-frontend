// El modal de error no debe poder tumbar la app. Si le llega el objeto de
// parseErrorFrappe en vez de un string, React lanza el error #31 y el
// ErrorBoundary se lleva la pantalla — escondiendo justo el error que iba a
// mostrar. Pasó en producción el 2026-08-21 con el ajuste de inventario.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ModalError from './ModalError';

describe('ModalError — nunca truena por la forma del mensaje', () => {
  it('pinta un string normal', () => {
    render(<ModalError isOpen message="Contraseña incorrecta" onClose={() => {}} />);
    expect(screen.getByText('Contraseña incorrecta')).toBeInTheDocument();
  });

  it('acepta el objeto {title, message} de parseErrorFrappe', () => {
    render(<ModalError isOpen message={{ title: 'Error', message: 'Contraseña incorrecta' }}
                       onClose={() => {}} />);
    expect(screen.getByText('Contraseña incorrecta')).toBeInTheDocument();
  });

  it('no truena con un objeto raro', () => {
    expect(() =>
      render(<ModalError isOpen message={{ raro: 1 }} onClose={() => {}} />)
    ).not.toThrow();
  });
});
