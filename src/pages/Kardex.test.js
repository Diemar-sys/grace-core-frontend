import { describe, it, expect } from 'vitest';
import { consumoEntreConteos } from './Kardex';

// Filas tal como las devuelve kardex_api (cantidades en unidad BASE, Kg).
const f = (fecha, voucher_type, entrada, salida, resultado) =>
  ({ fecha, voucher_type, entrada, salida, resultado });

const AJUSTE = 'Stock Reconciliation';

describe('Kardex — consumoEntreConteos', () => {
  it('el caso del jefe: había 100, compró 200, quedó 50 → usó 250', () => {
    const r = consumoEntreConteos([
      f('2026-06-01', AJUSTE, 100, 0, 100),
      f('2026-06-10', 'Purchase Receipt', 200, 0, 300),
      f('2026-06-30', AJUSTE, 0, 250, 50),
    ]);
    expect(r.usado).toBe(250);
    expect(r.habia).toBe(100);
    expect(r.quedo).toBe(50);
  });

  it('HARINA BLANCA ALTA PROTEINA: 400 + 540 comprados − 175 = 765 bultos', () => {
    // Kg reales de Bodega Central; 1 BULTO = 25 Kg.
    const r = consumoEntreConteos([
      f('2026-06-15', AJUSTE, 9600, 0, 10000),
      f('2026-07-07', 'Purchase Receipt', 2700, 0, 12700),
      f('2026-07-07', 'Purchase Receipt', 10800, 0, 23500),
      f('2026-07-30', AJUSTE, 0, 19125, 4375),
    ]);
    expect(r.usado).toBe(19125);        // 765 BULTO
    expect(r.usado / 25).toBe(765);
  });

  it('descuenta lo que salió con documento: ALTEÑA gastó 511, no 518 bultos', () => {
    const r = consumoEntreConteos([
      f('2026-06-15', AJUSTE, 8817, 0, 8950),
      f('2026-06-30', 'Sales Invoice', 0, 25, 8925),
      f('2026-07-07', 'Sales Invoice', 0, 25, 8900),
      f('2026-07-07', 'Purchase Receipt', 1050, 0, 9950),
      f('2026-07-07', 'Purchase Receipt', 4200, 0, 14150),
      f('2026-07-21', 'Stock Entry', 0, 125, 14025),
      f('2026-07-30', AJUSTE, 0, 12775, 1250),
    ]);
    expect(r.salidas).toBe(175);        // 2 ventas B2B + 1 traslado = 7 BULTO
    expect(r.usado / 25).toBe(511);
  });

  it('usa los DOS ÚLTIMOS conteos, no el primero del rango', () => {
    const r = consumoEntreConteos([
      f('2026-05-01', AJUSTE, 0, 0, 1000),
      f('2026-06-01', AJUSTE, 0, 0, 100),
      f('2026-06-10', 'Purchase Receipt', 200, 0, 300),
      f('2026-06-30', AJUSTE, 0, 250, 50),
    ]);
    expect(r.desde).toBe('2026-06-01');
    expect(r.usado).toBe(250);
  });

  it('el conteo de cierre puede encontrar de MÁS: usado sale negativo', () => {
    const r = consumoEntreConteos([
      f('2026-06-01', AJUSTE, 0, 0, 100),
      f('2026-06-30', AJUSTE, 20, 0, 120),
    ]);
    expect(r.usado).toBe(-20);
  });

  it('sin conteo de apertura no inventa el número', () => {
    expect(consumoEntreConteos([])).toBeNull();
    expect(consumoEntreConteos([
      f('2026-06-10', 'Purchase Receipt', 200, 0, 200),
      f('2026-06-30', AJUSTE, 0, 150, 50),
    ])).toBeNull();
  });
});
