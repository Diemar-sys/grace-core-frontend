import { describe, it, expect } from 'vitest';
import { consolidarGastos, mesDe, mesesConDatos, asignarColores, CAT_COMPRAS } from './gastosAnuales';

/**
 * Este reporte va a manos del gerente y del contador. Un peso mal sumado aquí
 * es una decisión mal tomada allá, así que la aritmética se prueba sola, sin
 * pantalla de por medio.
 */
const compra = (posting_date, grand_total, docstatus = 1) => ({ posting_date, grand_total, docstatus });
const egreso = (fecha, monto, categoria) => ({ fecha, monto, categoria });

describe('mesDe', () => {
  it('saca el mes sin pasar por UTC', () => {
    // new Date('2026-07-01') es UTC: en México se corre al 30 de junio y el
    // gasto se contaría en el mes anterior.
    expect(mesDe('2026-07-01', 2026)).toBe(6);
    expect(mesDe('2026-01-01', 2026)).toBe(0);
    expect(mesDe('2026-12-31', 2026)).toBe(11);
  });

  it('descarta lo que no es del año pedido', () => {
    expect(mesDe('2025-07-30', 2026)).toBeNull();
  });

  it('tolera fecha con hora, vacía o basura', () => {
    expect(mesDe('2026-03-15 14:22:01', 2026)).toBe(2);
    expect(mesDe('', 2026)).toBeNull();
    expect(mesDe(null, 2026)).toBeNull();
    expect(mesDe('basura', 2026)).toBeNull();
  });
});

describe('consolidarGastos', () => {
  it('separa compras de egresos y suma por mes', () => {
    const g = consolidarGastos(
      2026,
      [compra('2026-07-10', 1000), compra('2026-07-20', 500), compra('2026-08-01', 300)],
      [egreso('2026-07-06', 34007.56, 'RENTA')],
    );
    const compras = g.categorias.find(c => c.categoria === CAT_COMPRAS);
    const renta   = g.categorias.find(c => c.categoria === 'RENTA');
    expect(compras.meses[6]).toBe(1500);   // julio
    expect(compras.meses[7]).toBe(300);    // agosto
    expect(renta.meses[6]).toBe(34007.56);
    expect(g.totalesMes[6]).toBe(35507.56);
    expect(g.total).toBe(35807.56);
  });

  it('ignora compras en borrador y canceladas: no es dinero salido', () => {
    const g = consolidarGastos(2026, [
      compra('2026-07-10', 1000, 1),
      compra('2026-07-11', 9999, 0),   // borrador
      compra('2026-07-12', 8888, 2),   // cancelada
    ]);
    expect(g.total).toBe(1000);
  });

  it('deja fuera lo que no es del año', () => {
    const g = consolidarGastos(2026, [compra('2025-12-31', 5000)], [egreso('2027-01-02', 100, 'GASTO')]);
    expect(g.total).toBe(0);
    expect(g.categorias).toEqual([]);
  });

  it('normaliza la categoría a mayúsculas para no partir el renglón en dos', () => {
    const g = consolidarGastos(2026, [], [egreso('2026-05-01', 100, 'Renta'), egreso('2026-05-02', 50, 'RENTA')]);
    expect(g.categorias).toHaveLength(1);
    expect(g.categorias[0].total).toBe(150);
  });

  it('el egreso sin categoría no se pierde, se agrupa aparte', () => {
    const g = consolidarGastos(2026, [], [egreso('2026-05-01', 700, null)]);
    expect(g.categorias[0].categoria).toBe('SIN CATEGORÍA');
    expect(g.total).toBe(700);
  });

  it('activo fijo y préstamos cuentan: el dinero salió', () => {
    const g = consolidarGastos(2026, [], [
      egreso('2026-04-01', 12000, 'ACTIVO FIJO'),
      egreso('2026-04-01', 8000,  'PRÉSTAMO'),
      egreso('2026-04-01', 5000,  'GASTO'),
    ]);
    expect(g.total).toBe(25000);
    expect(g.categorias.map(c => c.categoria).sort())
      .toEqual(['ACTIVO FIJO', 'GASTO', 'PRÉSTAMO']);
  });

  it('compras va primero y el resto por peso descendente', () => {
    const g = consolidarGastos(
      2026,
      [compra('2026-02-01', 10)],          // la más chica, pero va primero
      [egreso('2026-02-01', 900, 'RENTA'), egreso('2026-02-01', 5000, 'NÓMINA')],
    );
    expect(g.categorias.map(c => c.categoria)).toEqual([CAT_COMPRAS, 'NÓMINA', 'RENTA']);
  });

  it('los totales por mes cuadran con la suma de categorías', () => {
    const g = consolidarGastos(
      2026,
      [compra('2026-09-05', 1234.56)],
      [egreso('2026-09-09', 765.44, 'GASTO'), egreso('2026-09-09', 1000, 'IMPUESTO')],
    );
    expect(g.totalesMes[8]).toBe(3000);
    expect(g.total).toBe(g.categorias.reduce((s, c) => s + c.total, 0));
  });
});

describe('asignarColores', () => {
  it('el color sigue a la categoría, no a su lugar en la tabla', () => {
    // Mismo conjunto, distinto orden de llegada: cada categoría conserva su tono.
    const a = asignarColores([CAT_COMPRAS, 'NÓMINA', 'RENTA']);
    const b = asignarColores(['RENTA', CAT_COMPRAS, 'NÓMINA']);
    expect(a).toEqual(b);
  });

  it('quitar una categoría no repinta a las que quedan', () => {
    const conTodas = asignarColores([CAT_COMPRAS, 'NÓMINA', 'RENTA']);
    const sinNomina = asignarColores([CAT_COMPRAS, 'RENTA']);
    expect(sinNomina[CAT_COMPRAS]).toBe(conTodas[CAT_COMPRAS]);
    // RENTA sí sube de slot al desaparecer NÓMINA — pero nunca toma el color
    // de otra categoría presente, que es lo que confundiría al leer.
    expect(sinNomina['RENTA']).not.toBe(sinNomina[CAT_COMPRAS]);
  });

  it('las categorías desconocidas van al final, alfabéticas', () => {
    const m = asignarColores(['ZETA', 'ALFA', CAT_COMPRAS]);
    expect(Object.keys(m)).toEqual([CAT_COMPRAS, 'ALFA', 'ZETA']);
  });

  it('con más categorías que tonos repite en vez de inventar colores', () => {
    const muchas = Array.from({ length: 10 }, (_, i) => `CAT${i}`);
    const m = asignarColores(muchas);
    expect(new Set(Object.values(m)).size).toBe(7);   // los 7 validados, ni uno más
  });
});

describe('mesesConDatos', () => {
  it('solo devuelve los meses con movimiento', () => {
    const g = consolidarGastos(2026, [compra('2026-03-01', 100), compra('2026-11-01', 200)]);
    expect(mesesConDatos(g)).toEqual([2, 10]);
  });
});
