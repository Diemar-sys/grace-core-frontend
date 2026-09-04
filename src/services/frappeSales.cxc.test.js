import { describe, it, expect } from 'vitest';
import { saldoCobrable } from './frappeSales';

// La agregacion por cliente se mudo a SQL (reportes_api.cuentas_por_cobrar) y su
// equivalencia con esta regla se verifico contra los datos reales de la torre.
// `saldoCobrable` sigue vivo: la lista de facturas por cliente lo usa por factura.

describe('saldoCobrable', () => {
  it('lo que redondea a cero es cero', () => {
    expect(saldoCobrable(0.004)).toBe(0);
    expect(saldoCobrable(0.000271)).toBe(0);
    expect(saldoCobrable(0)).toBe(0);
  });
  it('desde medio centavo ya es cobrable, y conserva el valor EXACTO', () => {
    // exacto = Frappe rechaza allocated > outstanding si se redondea hacia arriba
    expect(saldoCobrable(0.005)).toBe(0.005);
    expect(saldoCobrable(786.055904)).toBe(786.055904);
  });
  it('tolera basura', () => {
    expect(saldoCobrable(null)).toBe(0);
    expect(saldoCobrable(undefined)).toBe(0);
    expect(saldoCobrable('12.5')).toBe(12.5);
  });
});
