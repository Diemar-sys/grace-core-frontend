import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useAutoUppercase } from './useAutoUppercase';

// El hook escucha en document con capture, así que basta montarlo una vez y
// escribir en inputs reales del DOM.
function Campos() {
  useAutoUppercase();
  return (
    <>
      <input data-testid="normal" defaultValue="" />
      {/* Contraseña con "ojito": ya está revelada, o sea type=text. */}
      <input data-testid="pwd-revelada" type="text" autoComplete="current-password" defaultValue="" />
      <input data-testid="pwd-nueva" type="text" autoComplete="new-password" defaultValue="" />
      <input data-testid="pwd-oculta" type="password" defaultValue="" />
      <input data-testid="opt-out" data-no-upper="true" defaultValue="" />
    </>
  );
}

afterEach(cleanup);

describe('useAutoUppercase', () => {
  const escribir = (el, texto) => fireEvent.input(el, { target: { value: texto } });

  it('sigue poniendo mayúsculas en un campo normal', () => {
    const { getByTestId } = render(<Campos />);
    const el = getByTestId('normal');
    escribir(el, 'harina blanca');
    expect(el.value).toBe('HARINA BLANCA');
  });

  it('NO toca una contraseña revelada con el ojito (type=text)', () => {
    // Este era el bug: al revelarla dejaba de ser type=password y la mayúscula
    // automática estropeaba la clave.
    const { getByTestId } = render(<Campos />);
    const el = getByTestId('pwd-revelada');
    escribir(el, 'Cl4ve-secreta');
    expect(el.value).toBe('Cl4ve-secreta');
  });

  it('NO toca una contraseña nueva revelada', () => {
    const { getByTestId } = render(<Campos />);
    const el = getByTestId('pwd-nueva');
    escribir(el, 'aBc123$xyz');
    expect(el.value).toBe('aBc123$xyz');
  });

  it('NO toca una contraseña oculta', () => {
    const { getByTestId } = render(<Campos />);
    const el = getByTestId('pwd-oculta');
    escribir(el, 'MiClave123');
    expect(el.value).toBe('MiClave123');
  });

  it('respeta el opt-out data-no-upper', () => {
    const { getByTestId } = render(<Campos />);
    const el = getByTestId('opt-out');
    escribir(el, 'sin cambios');
    expect(el.value).toBe('sin cambios');
  });
});
