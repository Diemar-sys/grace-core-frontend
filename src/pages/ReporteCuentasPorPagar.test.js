import { describe, it, expect } from 'vitest';
import { pendientePorFacturado, filasCxP, deudaTotal, consultaPendientes } from './ReporteCuentasPorPagar';

const rows = [
  { proveedor: 'Bimbo', facturado_a: 'ALMA RODRIGUEZ', n: 2, total: 300, pagado: 100, pendiente: 200 },
  { proveedor: 'Bimbo', facturado_a: 'SIN FACTURA',    n: 1, total: 50,  pagado: 0,   pendiente: 50  },
  { proveedor: 'CEA',   facturado_a: 'LUIS TORRES',    n: 1, total: 80,  pagado: 80,  pendiente: 0   },
];

describe('CxP por facturado_a', () => {
  it('strip: pendiente por bucket, siempre los 3', () => {
    const s = pendientePorFacturado(rows);
    expect(s).toEqual({ 'ALMA RODRIGUEZ': 200, 'LUIS TORRES': 0, 'SIN FACTURA': 50 });
  });
  it('strip vacío → 3 buckets en 0', () => {
    expect(pendientePorFacturado([])).toEqual({ 'ALMA RODRIGUEZ': 0, 'LUIS TORRES': 0, 'SIN FACTURA': 0 });
  });
  it('filtro por facturado_a → solo esas filas', () => {
    expect(filasCxP(rows, 'ALMA RODRIGUEZ')).toEqual([rows[0]]);
  });
  it("'todas' re-agrega por proveedor (Bimbo suma sus 2 facturados)", () => {
    const f = filasCxP(rows, 'todas');
    expect(f).toHaveLength(2);
    const bimbo = f.find(r => r.proveedor === 'Bimbo');
    expect(bimbo).toEqual({ proveedor: 'Bimbo', n: 3, total: 350, pagado: 100, pendiente: 250 });
  });
  it("'todas' ordena por pendiente desc", () => {
    expect(filasCxP(rows, 'todas')[0].proveedor).toBe('Bimbo'); // 250 > 0
  });
});

describe('CxP — deuda total compras + egresos', () => {
  it('🔴 parte el total en compras y egresos sin perder ni duplicar un peso', () => {
    const conCompras = [
      { proveedor: 'EL TRIGAL', facturado_a: 'LUIS TORRES', pendiente: 1000, pendiente_compras: 1000 },
      { proveedor: 'LA CATARINA', facturado_a: 'SIN FACTURA', pendiente: 300, pendiente_compras: 120 },
      { proveedor: 'CEA', facturado_a: 'SIN FACTURA', pendiente: 80 },   // renglón sin compras
    ];
    expect(deudaTotal(conCompras)).toEqual({ total: 1380, compras: 1120, egresos: 260 });
  });
  it('sin datos → todo en 0', () => {
    expect(deudaTotal([])).toEqual({ total: 0, compras: 0, egresos: 0 });
  });
});

describe('CxP — qué se pide al desplegar un proveedor', () => {
  it('🔴 en "Todas" el desglose va sin filtro de facturado', () => {
    expect(consultaPendientes('EL TRIGAL', 'todas')).toEqual(
      { proveedor: 'EL TRIGAL', facturado_a: '', clave: 'EL TRIGAL|' });
  });
  it('🔴 filtrado, pide solo ese facturado y NO reusa el desglose de "Todas"', () => {
    const luis = consultaPendientes('EL TRIGAL', 'LUIS TORRES');
    expect(luis.facturado_a).toBe('LUIS TORRES');
    expect(luis.clave).not.toBe(consultaPendientes('EL TRIGAL', 'todas').clave);
    expect(luis.clave).not.toBe(consultaPendientes('EL TRIGAL', 'ALMA RODRIGUEZ').clave);
  });
});
