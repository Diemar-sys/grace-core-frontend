import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConexion } from './useConexion';

/** `navigator.onLine` es de solo lectura: se sobreescribe la propiedad. */
function fingirRed(hayRed) {
  Object.defineProperty(navigator, 'onLine', { value: hayRed, configurable: true });
  act(() => { window.dispatchEvent(new Event(hayRed ? 'online' : 'offline')); });
}

describe('useConexion', () => {
  afterEach(() => fingirRed(true));

  it('arranca en ok con red', () => {
    const { result } = renderHook(() => useConexion());
    expect(result.current).toBe('ok');
  });

  it('avisa cuando se cae la red, y ofrece recargar cuando vuelve', () => {
    const { result } = renderHook(() => useConexion());
    fingirRed(false);
    expect(result.current).toBe('sin-conexion');
    fingirRed(true);
    expect(result.current).toBe('volvio');
  });

  it('un evento online sin caída previa no molesta', () => {
    const { result } = renderHook(() => useConexion());
    fingirRed(true);
    expect(result.current).toBe('ok');
  });
});
