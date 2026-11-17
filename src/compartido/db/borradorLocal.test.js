import { describe, it, expect, vi } from 'vitest';
import { guardarBorradorForm, cargarBorradorForm, borrarBorradorForm } from './borradorLocal';

/**
 * Reglas que se prueban:
 *  1. Se guarda bajo la clave del formulario, con marca de tiempo.
 *  2. `datos = null` borra el renglón en vez de guardar un borrador vacío
 *     (si no, al reabrir sale una "restauración" que no restaura nada).
 *  3. Sin borrador previo, cargar devuelve null (no truena, no inventa {}).
 */
const fakeDb = (guardado = null) => ({
  borradores: {
    put: vi.fn().mockResolvedValue('ok'),
    get: vi.fn().mockResolvedValue(guardado),
    delete: vi.fn().mockResolvedValue(1),
  },
});

describe('guardarBorradorForm', () => {
  it('guarda los datos bajo la clave del formulario', async () => {
    const db = fakeDb();
    await guardarBorradorForm('envio-sucursal', { notas: 'hola' }, { db });
    const row = db.borradores.put.mock.calls[0][0];
    expect(row.key).toBe('envio-sucursal');
    expect(row.datos).toEqual({ notas: 'hola' });
    expect(row.actualizado).toBeTruthy();
  });

  it('con datos null borra el renglón en vez de dejar basura', async () => {
    const db = fakeDb();
    await guardarBorradorForm('envio-sucursal', null, { db });
    expect(db.borradores.put).not.toHaveBeenCalled();
    expect(db.borradores.delete).toHaveBeenCalledWith('envio-sucursal');
  });
});

describe('cargarBorradorForm', () => {
  it('devuelve datos + fecha de guardado', async () => {
    const db = fakeDb({ key: 'envio-sucursal', datos: { notas: 'x' }, actualizado: '2026-08-05T10:00:00.000Z' });
    expect(await cargarBorradorForm('envio-sucursal', { db }))
      .toEqual({ datos: { notas: 'x' }, actualizado: '2026-08-05T10:00:00.000Z' });
  });

  it('sin borrador previo devuelve null', async () => {
    expect(await cargarBorradorForm('envio-sucursal', { db: fakeDb(undefined) })).toBeNull();
  });

  it('un renglón sin datos cuenta como sin borrador', async () => {
    const db = fakeDb({ key: 'envio-sucursal', datos: null, actualizado: 'x' });
    expect(await cargarBorradorForm('envio-sucursal', { db })).toBeNull();
  });
});

describe('borrarBorradorForm', () => {
  it('borra por la clave del formulario', async () => {
    const db = fakeDb();
    await borrarBorradorForm('envio-sucursal', { db });
    expect(db.borradores.delete).toHaveBeenCalledWith('envio-sucursal');
  });
});
