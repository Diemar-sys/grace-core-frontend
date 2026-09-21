import { describe, it, expect } from 'vitest';
import { almacenDeSalida, almacenProduccionDe, esPan } from './almacenSalida';

const BODEGA = 'BODEGA CENTRAL - INSUMOS - PG';
const pan = (dep: string, excepcion?: string) =>
  ({ custom_tipo_item: 'PRODUCTO TERMINADO', custom_departamento: dep, custom_almacen_produccion: excepcion });

describe('almacenDeSalida — espejo de sales_invoice.almacen_de_salida', () => {
  it('🔴 el pan sale del almacén de su departamento, NO de Bodega Central', () => {
    expect(almacenDeSalida(pan('PAN DULCE'), BODEGA)).toBe('ALMACEN - PAN DULCE - PG');
    expect(almacenDeSalida(pan(' panqueleria '), BODEGA)).toBe('ALMACEN - PANQUELERIA - PG');
  });
  it('la excepción por item le gana al departamento (como en la entrada de pan)', () => {
    expect(almacenDeSalida(pan('PANQUELERIA', 'ALMACEN - PAN DULCE - PG'), BODEGA)).toBe('ALMACEN - PAN DULCE - PG');
  });
  it('abarrote y materia prima salen de Bodega Central', () => {
    expect(almacenDeSalida({ custom_tipo_item: 'MATERIA PRIMA', custom_departamento: 'PAN DULCE' }, BODEGA)).toBe(BODEGA);
    expect(almacenDeSalida({}, BODEGA)).toBe(BODEGA);
    expect(almacenDeSalida(null, BODEGA)).toBe(BODEGA);
  });
  it('pan sin departamento: null, no un almacén inventado', () => {
    expect(almacenDeSalida(pan(''), BODEGA)).toBeNull();
  });
  it('misma convención que constants.almacen_produccion_de', () => {
    expect(almacenProduccionDe('PAN BLANCO')).toBe('ALMACEN - PAN BLANCO - PG');
    expect(almacenProduccionDe('')).toBeNull();
    expect(esPan({ custom_tipo_item: ' producto terminado ' })).toBe(true);
  });
});
