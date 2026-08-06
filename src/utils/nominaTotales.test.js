import { describe, it, expect } from 'vitest';
import { calcRenglon, sumarTotales, payloadTicketNomina } from './nominaTotales';

/**
 * El caso real de un recibo CONTPAQi, el mismo que protege el `_self_check` del
 * backend. Si estos números y los de allá dejan de coincidir, el ticket miente.
 */
const RECIBO = {
  sueldo: 3318.00, septimo_dia: 553.00, prima_dominical: 138.25,
  vacaciones: 2433.20, prima_vacacional: 608.30,
  isr_mes: 401.51, isr_art174: 229.71, imss: 103.69, ajuste_neto: 0.04,
};

describe('calcRenglon', () => {
  it('cuadra con el validate() del backend', () => {
    const c = calcRenglon(RECIBO);
    expect(c.bruto).toBeCloseTo(7050.75, 2);
    expect(c.deducc).toBeCloseTo(734.95, 2);
    expect(c.neto).toBeCloseTo(6315.80, 2);
  });

  it('los campos de captura son strings y suman igual', () => {
    const comoTexto = Object.fromEntries(Object.entries(RECIBO).map(([k, v]) => [k, String(v)]));
    expect(calcRenglon(comoTexto).bruto).toBeCloseTo(calcRenglon(RECIBO).bruto, 2);
  });

  it('un campo vacío vale 0, no NaN', () => {
    expect(calcRenglon({ sueldo: '', septimo_dia: null }).bruto).toBe(0);
  });
});

describe('sumarTotales', () => {
  it('el efectivo no se reparte entre renglones', () => {
    const t = sumarTotales([RECIBO, RECIBO], 20000);
    expect(t.bruto).toBeCloseTo(14101.50, 2);
    expect(t.efectivo).toBe(20000);
    // El neto de los renglones sigue siendo solo lo suyo.
    expect(t.neto).toBeCloseTo(12631.60, 2);
  });

  it('impuestos = ISR ordinario + Art. 174 + IMSS + ajuste', () => {
    expect(sumarTotales([RECIBO]).impuestos).toBeCloseTo(734.95, 2);
  });

  it('deducciones lleva el Infonavit; impuestos no', () => {
    // Corrida real del 05-ago (14 empleados): el recibo dice Total Deducciones
    // 5,674.20 y la pantalla mostraba 4,849.32 de "impuestos". La diferencia son
    // los 824.88 del Infonavit, que no es impuesto sino crédito de vivienda.
    const t = sumarTotales([{
      sueldo: 32472, septimo_dia: 6452, prima_dominical: 818,
      vacaciones: 6240, prima_vacacional: 1600,
      isr_mes: 3665.02, imss: 1184.14, infonavit_cf_corresp: 824.88, ajuste_neto: 0.16,
    }]);
    expect(t.deducc).toBeCloseTo(5674.20, 2);     // cuadra con el recibo
    expect(t.impuestos).toBeCloseTo(4849.32, 2);  // sin Infonavit
    expect(t.deducc - t.impuestos).toBeCloseTo(824.88, 2);
    // Y con las vacaciones capturadas, el neto es el del recibo.
    expect(t.bruto).toBeCloseTo(47582.00, 2);
    expect(t.neto).toBeCloseTo(41907.80, 2);
  });
});

describe('payloadTicketNomina', () => {
  const meta = { folio: 'NOM-2026-0031', fecha_pago: '2026-08-05', nomina_de: 'ALMA RODRIGUEZ' };

  it('el neto y el costo del ticket llevan el efectivo sumado', () => {
    const t = sumarTotales([RECIBO, RECIBO], 20000);
    const p = payloadTicketNomina(meta, t, 2);
    expect(p.total_neto).toBeCloseTo(32631.60, 2);
    expect(p.total_costo).toBeCloseTo(34101.50, 2);
    expect(p.total_efectivo).toBe(20000);
  });

  it('lleva los informativos que la Lista de Raya imprime', () => {
    // No mueven un peso, pero sin ellos el ticket no se puede cotejar contra
    // CONTPAQi: el contador los busca renglón por renglón.
    const t = sumarTotales([{
      ...RECIBO, prestamo_infonavit_cf: 824.88,
      subsidio_empleo: -493.36, isr_antes_subsidio: 4158.38,
    }]);
    const p = payloadTicketNomina(meta, t, 14);
    expect(p.total_prestamo_infonavit).toBeCloseTo(824.88, 2);
    expect(p.total_subsidio_empleo).toBeCloseTo(-493.36, 2);
    expect(p.total_isr_antes_subsidio).toBeCloseTo(4158.38, 2);
    // Y ninguno tocó el neto: el subsidio ya viene dentro del ISR (mes).
    expect(t.neto).toBeCloseTo(6315.80, 2);
  });

  it('separa vacaciones de su prima: es lo que dispara el Art. 174', () => {
    const p = payloadTicketNomina(meta, sumarTotales([RECIBO]), 1);
    expect(p.total_vacaciones).toBeCloseTo(2433.20, 2);
    expect(p.total_prima_vacacional).toBeCloseTo(608.30, 2);
    expect(p.total_isr_art174).toBeCloseTo(229.71, 2);
  });
});
