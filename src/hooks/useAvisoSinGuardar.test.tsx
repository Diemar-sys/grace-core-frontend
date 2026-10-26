// 26-oct: churros de P.REAL del 22-oct — tecleado en la tablet, nunca guardado. Salir pregunta.
import { readFileSync } from 'node:fs';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useAvisoSinGuardar, { haySinGuardar, MENSAJE_SIN_GUARDAR } from './useAvisoSinGuardar';

const cerrar = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

// Un link del menú (o el botón Salir) con un listener «de React Router» abajo: si navega, lo anota.
const clic = (html: string) => {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild as HTMLElement;
  const navego = vi.fn();
  el.addEventListener('click', navego);
  const e = new MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return { cortado: e.defaultPrevented, navego: navego.mock.calls.length > 0 };
};

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('haySinGuardar', () => {
  it('solo cuenta lo tecleado de la fecha que se ve', () => {
    const b = { '2026-10-22': { 'P.REAL': { enviado: { '1034': 410 } } } } as any;
    expect(haySinGuardar(b, '2026-10-22')).toBe(true);
    expect(haySinGuardar(b, '2026-10-23')).toBe(false);
    expect(haySinGuardar({}, '2026-10-22')).toBe(false);
  });
});

describe('useAvisoSinGuardar', () => {
  it('con algo sin guardar, cerrar/recargar pide confirmación', () => {
    renderHook(() => useAvisoSinGuardar(true));
    expect(cerrar()).toBe(true);
  });

  it('sin nada pendiente no estorba', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    renderHook(() => useAvisoSinGuardar(false));
    expect(cerrar()).toBe(false);
    expect(clic('<a href="/panel">Operaciones</a>')).toEqual({ cortado: false, navego: true });
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('menú: «no» se queda en la Hoja, «sí» deja salir', () => {
    renderHook(() => useAvisoSinGuardar(true));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(clic('<a href="/panel">Operaciones</a>')).toEqual({ cortado: true, navego: false });
    expect(confirmar).toHaveBeenCalledWith(MENSAJE_SIN_GUARDAR);
    confirmar.mockReturnValue(true);
    expect(clic('<a href="/panel">Operaciones</a>')).toEqual({ cortado: false, navego: true });
  });

  it('el botón Salir (data-sale) también pregunta; un botón cualquiera no', () => {
    renderHook(() => useAvisoSinGuardar(true));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(clic('<button data-sale>Salir</button>').navego).toBe(false);
    confirmar.mockClear();
    expect(clic('<button>Guardar</button>').navego).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('ya guardado (o fuera de la Hoja) se quita el aviso', () => {
    const { rerender, unmount } = renderHook(({ s }) => useAvisoSinGuardar(s), { initialProps: { s: true } });
    rerender({ s: false });
    expect(cerrar()).toBe(false);
    rerender({ s: true });
    unmount();
    expect(cerrar()).toBe(false);
  });

  it('cableado: la Hoja lo usa con su borrador y la fecha, y Salir trae data-sale', () => {
    const hoja = readFileSync('src/pages/HojaDelDia.tsx', 'utf8');
    expect(hoja).toContain('useAvisoSinGuardar(haySinGuardar(borrador, fecha))');
    expect(readFileSync('src/components/Layout.jsx', 'utf8')).toMatch(/panel-logout-btn"[^>]*data-sale/);
  });
});
