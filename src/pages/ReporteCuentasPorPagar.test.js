import { describe, it, expect } from 'vitest';
import {
  pendientePorFacturado, filasCxP, deudaTotal, consultaPendientes, deVista, docsDeVista,
} from './ReporteCuentasPorPagar';

const rows = [
  { proveedor: 'Bimbo', facturado_a: 'ALMA RODRIGUEZ', tipo: 'Compra', n: 2, total: 300, pagado: 100, pendiente: 200 },
  { proveedor: 'Bimbo', facturado_a: 'SIN FACTURA',    tipo: 'Compra', n: 1, total: 50,  pagado: 0,   pendiente: 50  },
  { proveedor: 'CEA',   facturado_a: 'LUIS TORRES',    tipo: 'Egreso', n: 1, total: 80,  pagado: 80,  pendiente: 0   },
];

// 🔴 El caso difícil: el backend manda un renglón por tipo, así que un proveedor con
// compras Y egresos bajo el MISMO facturado llega en dos renglones.
const ambos = [
  { proveedor: 'LA CATARINA', facturado_a: 'SIN FACTURA', tipo: 'Compra', n: 2, total: 120, pagado: 0,  pendiente: 120 },
  { proveedor: 'LA CATARINA', facturado_a: 'SIN FACTURA', tipo: 'Egreso', n: 3, total: 300, pagado: 20, pendiente: 280 },
];

describe('CxP por facturado_a', () => {
  it('strip: pendiente por bucket, siempre los 3', () => {
    const s = pendientePorFacturado(rows);
    expect(s).toEqual({ 'ALMA RODRIGUEZ': 200, 'LUIS TORRES': 0, 'SIN FACTURA': 50 });
  });
  it('strip vacío → 3 buckets en 0', () => {
    expect(pendientePorFacturado([])).toEqual({ 'ALMA RODRIGUEZ': 0, 'LUIS TORRES': 0, 'SIN FACTURA': 0 });
  });
  it('filtro por facturado_a → solo ese facturado', () => {
    expect(filasCxP(rows, 'ALMA RODRIGUEZ')).toEqual(
      [{ proveedor: 'Bimbo', n: 2, total: 300, pagado: 100, pendiente: 200 }]);
  });
  it('🔴 filtrado, compra + egreso del mismo proveedor salen en UN renglón sumado', () => {
    expect(filasCxP(ambos, 'SIN FACTURA')).toEqual(
      [{ proveedor: 'LA CATARINA', n: 5, total: 420, pagado: 20, pendiente: 400 }]);
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
    const datos = [
      { proveedor: 'EL TRIGAL', facturado_a: 'LUIS TORRES', tipo: 'Compra', pendiente: 1000 },
      ...ambos,
      { proveedor: 'CEA', facturado_a: 'SIN FACTURA', tipo: 'Egreso', pendiente: 80 },
    ];
    expect(deudaTotal(datos)).toEqual({ total: 1480, compras: 1120, egresos: 360 });
  });
  it('sin datos → todo en 0', () => {
    expect(deudaTotal([])).toEqual({ total: 0, compras: 0, egresos: 0 });
  });
});

describe('CxP — vistas General / Compras / Egresos', () => {
  it('General trae todo; Compras y Egresos solo su tipo', () => {
    expect(deVista(ambos, 'general')).toEqual(ambos);
    expect(deVista(ambos, 'Compra')).toEqual([ambos[0]]);
    expect(deVista(ambos, 'Egreso')).toEqual([ambos[1]]);
  });
  it('🔴 vista Egresos: la tabla y el total NO cargan la compra del mismo proveedor', () => {
    expect(filasCxP(deVista(ambos, 'Egreso'), 'todas')).toEqual(
      [{ proveedor: 'LA CATARINA', n: 3, total: 300, pagado: 20, pendiente: 280 }]);
    expect(deudaTotal(deVista(ambos, 'Egreso'))).toEqual({ total: 280, compras: 0, egresos: 280 });
  });
  it('🔴 el desglose se filtra por tipo y suma lo que dice el renglón de la vista', () => {
    const docs = [
      { name: 'MAT-PRE-1', tipo: 'Compra', monto: 120 },
      { name: 'EGR-1', tipo: 'Egreso', monto: 200 },
      { name: 'EGR-2', tipo: 'Egreso', monto: 80 },
    ];
    const egresos = docsDeVista(docs, 'Egreso');
    expect(egresos.map(d => d.name)).toEqual(['EGR-1', 'EGR-2']);
    expect(egresos.reduce((s, d) => s + d.monto, 0)).toBe(280);
    expect(docsDeVista(docs, 'general')).toHaveLength(3);
  });
  it('desglose cargando o con error pasa tal cual (no se vuelve "sin documentos")', () => {
    expect(docsDeVista('cargando', 'Compra')).toBe('cargando');
    const err = { error: 'sin red' };
    expect(docsDeVista(err, 'Egreso')).toBe(err);
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
