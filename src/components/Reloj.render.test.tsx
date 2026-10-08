import { render, screen, act } from '@testing-library/react';
import Reloj from './Reloj';

describe('Reloj', () => {
  afterEach(() => vi.useRealTimers());

  it('cambia justo al cambiar el minuto, y sigue cambiando', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 11, 42, 30));
    render(<Reloj />);
    expect(screen.getByText('11:42 a.m.')).toBeInTheDocument();
    expect(screen.getByText('jue 08 oct')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(29_000); });
    expect(screen.getByText('11:42 a.m.')).toBeInTheDocument();   // a.m. 11:42:59 todavía
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText('11:43 a.m.')).toBeInTheDocument();   // 11:43:00 en punto
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('11:44 a.m.')).toBeInTheDocument();   // se volvió a programar
  });

  it('sin segundos: un solo temporizador vivo, no uno por segundo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 11, 42, 30));
    const { unmount } = render(<Reloj />);
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);                           // al salir no deja nada corriendo
  });
});
