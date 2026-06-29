import { describe, it, expect } from 'vitest';
import { pendientePorFacturado, filasCxP } from './ReporteCuentasPorPagar';

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
