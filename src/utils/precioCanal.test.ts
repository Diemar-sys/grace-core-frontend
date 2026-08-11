import { describe, it, expect } from 'vitest';
import { resolverPrecioVenta, tipoPrecioPorAlmacen } from './precioCanal';

describe('precioCanal — tipoPrecioPorAlmacen', () => {
  it('CAMIONETA → camioneta, PUNTO DE VENTA → pueblos', () => {
    expect(tipoPrecioPorAlmacen('CAMIONETA')).toBe('camioneta');
    expect(tipoPrecioPorAlmacen('PUNTO DE VENTA')).toBe('pueblos');
  });
  it('sucursal/bodega/tipo desconocido → normal', () => {
    expect(tipoPrecioPorAlmacen('SUCURSAL')).toBe('normal');
    expect(tipoPrecioPorAlmacen('BODEGA')).toBe('normal');
    expect(tipoPrecioPorAlmacen('LO_QUE_SEA')).toBe('normal');
  });
  it('almacén SIN tipo → normal (el caso que congela sucursal sin avisar)', () => {
    expect(tipoPrecioPorAlmacen('')).toBe('normal');
    expect(tipoPrecioPorAlmacen(null)).toBe('normal');
    expect(tipoPrecioPorAlmacen(undefined)).toBe('normal');
  });
});

describe('precioCanal — resolverPrecioVenta (congela el precio del envío)', () => {
  it('usa el precio del canal cuando existe, dividido por presentación', () => {
    // pueblos $50 el bulto, 25 kg por bulto → $2/kg
    const item = { custom_precio_de_venta_pueblos: 50, custom_cantidad_por_presentación: 25 };
    expect(resolverPrecioVenta(item, 'pueblos')).toBe(2);
  });
  it('canal camioneta con su propio precio', () => {
    const item = { custom_precio_de_venta_camioneta: 30, custom_cantidad_por_presentación: 10 };
    expect(resolverPrecioVenta(item, 'camioneta')).toBe(3);
  });
  it('canal SIN precio propio → cae al normal, NUNCA a 0 (o la ruta no cobra)', () => {
    // camioneta sin precio, pero hay precio_por_kg
    const item = { custom_precio_de_venta_camioneta: 0, custom_precio_por_kg: 7 };
    expect(resolverPrecioVenta(item, 'camioneta')).toBe(7);
  });
  it('precio_por_kg gana sobre precio_de_venta (ya viene por unidad base)', () => {
    const item = { custom_precio_por_kg: 8, custom_precio_de_venta: 200, custom_cantidad_por_presentación: 25 };
    expect(resolverPrecioVenta(item, 'normal')).toBe(8);
  });
  it('sin precio_por_kg usa precio_de_venta / presentación', () => {
    const item = { custom_precio_de_venta: 200, custom_cantidad_por_presentación: 25 };
    expect(resolverPrecioVenta(item, 'normal')).toBe(8);
  });
  it('presentación ausente → factor 1 (pieza, no se divide)', () => {
    const item = { custom_precio_de_venta: 15 };
    expect(resolverPrecioVenta(item, 'normal')).toBe(15);
  });
  it('cae a standard_rate antes que a 0', () => {
    const item = { standard_rate: 12 };
    expect(resolverPrecioVenta(item, 'normal')).toBe(12);
  });
  it('sin ningún dato → 0', () => {
    expect(resolverPrecioVenta({}, 'normal')).toBe(0);
  });
  it('canal normal ignora los campos de canal aunque existan', () => {
    const item = { custom_precio_de_venta_pueblos: 99, custom_precio_de_venta: 100, custom_cantidad_por_presentación: 1 };
    expect(resolverPrecioVenta(item, 'normal')).toBe(100);
  });
});
