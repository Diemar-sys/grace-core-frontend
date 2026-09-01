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

/*
 * passwordPrompt: lo usa el revertir-pago de Compras. Las formas conocidas de que
 * mienta sin fallar son (a) confirmar con la contraseña vacía, (b) no entregarle
 * la contraseña al callback —el backend la rechaza y parece "contraseña mala"—,
 * (c) dejar el modal sin botones tras un error, que con reintento de contraseña
 * es un callejón sin salida, y (d) filtrar el MouseEvent como si fuera el dato.
 */
describe('ConfirmModal — passwordPrompt', () => {
  const conPass = { ...defaults, passwordPrompt: 'Tu contraseña', confirmLabel: 'Revertir' };

  it('sin passwordPrompt no aparece ningún campo de contraseña', () => {
    const { container } = render(<ConfirmModal {...defaults} />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it('Confirmar está deshabilitado mientras la contraseña esté vacía', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...conPass} onConfirm={onConfirm} />);
    const btn = screen.getByText('Revertir');
    expect(btn).toBeDisabled();
    btn.click();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('entrega la contraseña tecleada a onConfirm', () => {
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmModal {...conPass} onConfirm={onConfirm} />);
    fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 's3cr3t' } });
    screen.getByText('Revertir').click();
    expect(onConfirm).toHaveBeenCalledWith('s3cr3t');
  });

  it('Enter confirma con la contraseña; vacía no hace nada', () => {
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmModal {...conPass} onConfirm={onConfirm} />);
    const input = container.querySelector('input[type="password"]');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('abc');
  });

  it('con error el modal SIGUE ofreciendo reintentar la contraseña', () => {
    const { container } = render(<ConfirmModal {...conPass} error="Contraseña incorrecta" />);
    expect(screen.getByText('Contraseña incorrecta')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(screen.getByText('Revertir')).toBeInTheDocument();
  });

  it('sin passwordPrompt, un error sigue ocultando los botones (comportamiento viejo)', () => {
    render(<ConfirmModal {...defaults} error="Tronó" confirmLabel="Sí, borrar" />);
    expect(screen.queryByText('Sí, borrar')).toBeNull();
  });

  it('onConfirm NO recibe el MouseEvent cuando no se pide contraseña', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaults} onConfirm={onConfirm} confirmLabel="Sí, borrar" />);
    screen.getByText('Sí, borrar').click();
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('loading deshabilita el campo y no confirma con Enter', () => {
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmModal {...conPass} onConfirm={onConfirm} loading={true} />);
    const input = container.querySelector('input[type="password"]');
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
