import { describe, it, expect } from 'vitest';
import { calcularCobro, deptColor, fmtModoPago, fmt } from './posUtils';

describe('posUtils — calcularCobro (dinero POS)', () => {
  const ticket = [
    { qty: 2, precio: 15 },   // 30
    { qty: 3, precio: 10 },   // 30
  ];

  it('total y totalQty correctos', () => {
    const r = calcularCobro(ticket, {});
    expect(r.total).toBe(60);
    expect(r.totalQty).toBe(5);
  });

  it('pago exacto → pendiente 0, sin cambio, importeOk', () => {
    const r = calcularCobro(ticket, { Efectivo: '60' });
    expect(r.pendiente).toBe(0);
    expect(r.cambio).toBe(0);
    expect(r.importeOk).toBe(true);
  });

  it('pago parcial → pendiente positivo, importe NO ok', () => {
    const r = calcularCobro(ticket, { Efectivo: '40' });
    expect(r.pendiente).toBe(20);
    expect(r.importeOk).toBe(false);
  });

  it('pago de más → cambio positivo, importeOk', () => {
    const r = calcularCobro(ticket, { Efectivo: '100' });
    expect(r.cambio).toBe(40);
    expect(r.pendiente).toBe(0);
    expect(r.importeOk).toBe(true);
  });

  it('split de pago (efectivo + tarjeta) suma correcto', () => {
    const r = calcularCobro(ticket, { Efectivo: '20', Tarjeta: '40' });
    expect(r.totalPagado).toBe(60);
    expect(r.importeOk).toBe(true);
  });

  it('ticket vacío → todo 0, importe NO ok (no se cobra $0)', () => {
    const r = calcularCobro([], {});
    expect(r.total).toBe(0);
    expect(r.importeOk).toBe(false);
  });

  it('valores no numéricos en pagos no rompen (NaN→0)', () => {
    const r = calcularCobro(ticket, { Efectivo: '', Tarjeta: 'abc' });
    expect(r.totalPagado).toBe(0);
    expect(r.pendiente).toBe(60);
  });

  it('defensivo: args ausentes no lanzan', () => {
    expect(() => calcularCobro()).not.toThrow();
    expect(calcularCobro().total).toBe(0);
  });
});

describe('posUtils — helpers de UI', () => {
  it('deptColor matchea por substring case-insensitive', () => {
    expect(deptColor('pan dulce especial')).toBe('#f97316');
    expect(deptColor('REPOSTERIA')).toBe('#8b5cf6');
  });
  it('deptColor default si no matchea', () => {
    expect(deptColor('desconocido')).toBe('#7a3f0a');
    expect(deptColor()).toBe('#7a3f0a');
  });
  it('fmtModoPago traduce ERPNext→ES', () => {
    expect(fmtModoPago('Cash')).toBe('Efectivo');
    expect(fmtModoPago('Bank Draft')).toBe('Tarjeta');
    expect(fmtModoPago('Otro')).toBe('Otro');
  });
  it('fmt formatea moneda', () => {
    expect(fmt(1234.5)).toBe('$1234.50');
    expect(fmt()).toBe('$0.00');
  });
});
