import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

afterEach(cleanup);

const defaults = {
  title: 'Confirmar acción',
  description: '¿Estás seguro?',
  onConfirm: () => {},
  onCancel: () => {},
};

describe('ConfirmModal — ESC y botones', () => {
  it('renderiza título y descripción', () => {
    render(<ConfirmModal {...defaults} />);
    expect(screen.getByText('Confirmar acción')).toBeInTheDocument();
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument();
  });

  it('ESC llama onCancel cuando no está cargando', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaults} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('ESC NO llama onCancel cuando loading=true', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaults} onCancel={onCancel} loading={true} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('otras teclas no disparan onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaults} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('botón Cancelar llama onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaults} onCancel={onCancel} />);
    screen.getByText('Cancelar').click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('botón Confirmar llama onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaults} onConfirm={onConfirm} confirmLabel="Sí, borrar" />);
    screen.getByText('Sí, borrar').click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('loading=true muestra loadingLabel y deshabilita botones', () => {
    render(<ConfirmModal {...defaults} loading={true} loadingLabel="Eliminando..." />);
    expect(screen.getByText('Eliminando...')).toBeInTheDocument();
    const btns = screen.getAllByRole('button');
    btns.forEach(b => expect(b).toBeDisabled());
  });

  it('muestra mensaje de error cuando error prop tiene valor', () => {
    render(<ConfirmModal {...defaults} error="Algo salió mal" />);
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });
});
