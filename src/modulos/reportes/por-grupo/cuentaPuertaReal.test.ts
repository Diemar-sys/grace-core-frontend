import { describe, expect, it } from 'vitest';
import { capturasPorGuardar, claveCaptura, cuentaDia, leerMonto, previsualizar } from './cuentaPuertaReal';

// Formas de mentir: mandar lo que no cambió (pisa lo que otro guardó), perder un día, dejar pasar basura,
// o confundir «borrado» (null → 0) con «inválido».
describe('cuentaPuertaReal', () => {
  it('leerMonto: vacío = null, número ≥ 0 con 2 decimales (comas de miles ok), lo demás inválido', () => {
    expect(leerMonto('  ')).toBeNull();
    expect(leerMonto('5,829')).toBe(5829);
    expect(leerMonto('8677.75')).toBe(8677.75);
    for (const malo of ['-1', 'abc', '1.234', '1e3', 'NaN', '.5']) expect(leerMonto(malo), malo).toBeUndefined();
  });

  it('agrupa por día solo lo que cambió; lo inválido no viaja y se marca', () => {
    const guardado = (f: string, c: string) => (f === '2026-11-19' && c === 'nomina' ? 5829 : 0);
    const { capturas, invalidas } = capturasPorGuardar({
      [claveCaptura('2026-11-19', 'nomina')]: '5829',        // igual a lo guardado: no viaja
      [claveCaptura('2026-11-19', 'otro')]: '19710.90',
      [claveCaptura('2026-11-19', 'deposito')]: '14,812',
      [claveCaptura('2026-11-16', 'nomina')]: '',            // vacío y ya era 0: no viaja
      [claveCaptura('2026-11-23', 'seguro')]: 'x',
    }, guardado);
    expect(capturas).toEqual([{ fecha: '2026-11-19', otro: 19710.9, deposito: 14812 }]);
    expect([...invalidas]).toEqual([claveCaptura('2026-11-23', 'seguro')]);
    // borrar lo guardado sí viaja, como null
    expect(capturasPorGuardar({ [claveCaptura('2026-11-19', 'nomina')]: '' }, guardado).capturas)
      .toEqual([{ fecha: '2026-11-19', nomina: null }]);
  });

  // 🔴 ESPEJO de hoja_calculo.cuenta_preal con los MISMOS días que test_hoja_calculo.py (#12): si uno cambia, truena
  it('cuentaDia = cuenta_preal del servidor (16 y 19-nov del jefe, a centavos)', () => {
    const k = (f: string, c: string) => claveCaptura(f, c);
    const d16 = cuentaDia({ fecha: '2026-11-16', nota: '', monto: 22608, descuento: 3843.36, abarrote: 480 }, {
      [k('2026-11-16', 's_tarjeta')]: '8933', [k('2026-11-16', 'banco')]: '8933',
      [k('2026-11-16', 'c_tarjeta')]: '8677.75', [k('2026-11-16', 'deposito')]: '16132' });
    expect([d16.diferencia, d16.tarjeta_banco, d16.dif_efectivo, d16.dif_deposito]).toEqual([18764.64, 0, 10086.89, -6045.11]);
    expect([d16.deuda_mas, d16.deuda_menos, d16.final, d16.final_mas, d16.final_menos]).toEqual([0, 6045.11, -5565.11, 0, -5565.11]);
    // el 19: lo guardado (nómina) + lo tecleado (lo demás); un tecleo inválido deja lo guardado
    const d19 = cuentaDia({ fecha: '2026-11-19', nota: '', monto: 22810, descuento: 3877.7, abarrote: 1803.2, nomina: 5829, seguro: 0 }, {
      [k('2026-11-19', 's_tarjeta')]: '6174', [k('2026-11-19', 'banco')]: '6174', [k('2026-11-19', 'c_tarjeta')]: '5999.64',
      [k('2026-11-19', 'deposito')]: '14812', [k('2026-11-19', 'otro')]: '19710.9', [k('2026-11-19', 'seguro')]: 'x' });
    expect([d19.diferencia, d19.dif_efectivo, d19.dif_deposito, d19.deuda_menos]).toEqual([18932.3, 12932.66, -1879.34, 1879.34]);
    expect([d19.final, d19.final_mas, d19.final_menos, d19.seguro]).toEqual([25463.76, 25463.76, 0, 0]);
    // vacío = 0; SEGURO suma; S/T − BANCO
    const s = cuentaDia({ fecha: 'f', nota: '', monto: 1000 }, { [k('f', 's_tarjeta')]: '500', [k('f', 'banco')]: '450', [k('f', 'seguro')]: '10.01' });
    expect([s.tarjeta_banco, s.deuda_mas, s.final]).toEqual([50, 1000, 1010.01]);
  });

  it('previsualizar: sin tecleo regresa lo del servidor; con tecleo recalcula días y TOTAL', () => {
    const dias = [{ fecha: 'a', nota: '', monto: 100, final: 100 }, { fecha: 'b', nota: '', monto: 50.1, final: 50.1 }];
    const total = { monto: 150.1, final: 150.1 };
    expect(previsualizar(dias, total, {})).toEqual({ dias, total });
    const v = previsualizar(dias, total, { [claveCaptura('a', 'deposito')]: '30.2' });
    expect(v.dias[0].final).toBe(69.8);
    expect(v.total).toEqual({ monto: 150.1, final: 119.9 });
  });
});
