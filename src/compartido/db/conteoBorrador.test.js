import { describe, it, expect, vi } from 'vitest';
import { claveBorrador, guardarBorrador, cargarBorrador, borrarBorrador } from './conteoBorrador';

/**
 * Reglas que se prueban:
 *  1. El borrador es por almacén Y por día (el conteo de mañana no pisa el de hoy).
 *  2. Solo se guarda lo capturado; los renglones vacíos no viajan.
 *  3. Si no queda nada capturado, el borrador se borra en vez de guardar {}.
 *  4. Sin borrador previo, cargar devuelve null (no truena, no inventa {}).
 */
const fakeDb = (guardado = null) => ({
  conteo: {
    put: vi.fn().mockResolvedValue('ok'),
    get: vi.fn().mockResolvedValue(guardado),
    delete: vi.fn().mockResolvedValue(1),
  },
});

const BC = 'BODEGA CENTRAL - INSUMOS - PG';

describe('claveBorrador', () => {
  it('separa por día y por almacén', () => {
    expect(claveBorrador(BC, '2026-07-30')).toBe(`2026-07-30|${BC}`);
    expect(claveBorrador(BC, '2026-07-31')).not.toBe(claveBorrador(BC, '2026-07-30'));
    expect(claveBorrador('TIENDA - SANTUARIOS - PG', '2026-07-30'))
      .not.toBe(claveBorrador(BC, '2026-07-30'));
  });
});

describe('guardarBorrador', () => {
  it('guarda solo los renglones capturados', async () => {
    const db = fakeDb();
    await guardarBorrador(BC, { MP_A: '10', MP_B: '', MP_C: '0' }, { db, fecha: '2026-07-30' });
    const guardado = db.conteo.put.mock.calls[0][0];
    expect(guardado.valores).toEqual({ MP_A: '10', MP_C: '0' });  // el 0 SÍ es un conteo
    expect(guardado.key).toBe(`2026-07-30|${BC}`);
  });

  it('sin nada capturado borra el borrador en vez de dejar {}', async () => {
    const db = fakeDb();
    await guardarBorrador(BC, { MP_A: '', MP_B: '' }, { db, fecha: '2026-07-30' });
    expect(db.conteo.put).not.toHaveBeenCalled();
    expect(db.conteo.delete).toHaveBeenCalledWith(`2026-07-30|${BC}`);
  });
});

describe('cargarBorrador', () => {
  it('devuelve lo capturado', async () => {
    const db = fakeDb({ key: 'x', valores: { MP_A: '10' } });
    expect(await cargarBorrador(BC, { db, fecha: '2026-07-30' })).toEqual({ MP_A: '10' });
  });

  it('sin borrador previo devuelve null', async () => {
    const db = fakeDb(undefined);
    expect(await cargarBorrador(BC, { db, fecha: '2026-07-30' })).toBeNull();
  });
});

describe('borrarBorrador', () => {
  it('borra por la clave del día', async () => {
    const db = fakeDb();
    await borrarBorrador(BC, { db, fecha: '2026-07-30' });
    expect(db.conteo.delete).toHaveBeenCalledWith(`2026-07-30|${BC}`);
  });
});
