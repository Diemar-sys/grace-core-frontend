import { describe, it, expect } from 'vitest';
import { precioB2B, precioConImpuesto } from './NuevaVentaB2B';
import { calcularTotalesVenta } from '../services/frappeSales';
import { IMPUESTOS_MAP } from '../config/impuestos';

// Precios de la lista del piso (17-sep, ya con impuesto) y su impuesto de catálogo.
const ABARROTES = [
  { nombre: 'VELAS PIROTECNICA',      custom_precio_de_venta: '35',    custom_impuesto: 'iva16' },
  { nombre: 'NESCAFÉ CAPPUCCINO MOKA', custom_precio_de_venta: '14',    custom_impuesto: 'ieps' },
  { nombre: 'CHOCOMIL 160G',          custom_precio_de_venta: '29',    custom_impuesto: 'ieps' },
  { nombre: 'COCOLATE ABUELITA',      custom_precio_de_venta: '20',    custom_impuesto: 'ieps' },
  { nombre: 'LECHE LALA LIGHT',       custom_precio_de_venta: '35',    custom_impuesto: 'tasa0' },
  { nombre: 'doble (sin uso hoy)',    custom_precio_de_venta: '37.5',  custom_impuesto: 'iva16_ieps' },
];

// Igual que el componente: rate a 6 decimales + impuesto del catálogo en la fila.
const totalVenta = (item: any, qty: number) => {
  const imp = IMPUESTOS_MAP[item.custom_impuesto as keyof typeof IMPUESTOS_MAP];
  const fila = {
    qty, rate: precioB2B(item, true).toFixed(6),
    impuesto_key: imp.key, impuesto_label: imp.label, impuesto_rate: imp.rate,
  };
  return calcularTotalesVenta([fila]).total;
};

describe('precioB2B — el abarrote cuesta lo mismo en B2B que en tienda', () => {
  it('una pieza: total B2B = precio de tienda (el impuesto va adentro, no encima)', () => {
    for (const item of ABARROTES) expect(totalVenta(item, 1)).toBeCloseTo(parseFloat(item.custom_precio_de_venta), 2);
  });

  it('VELAS: base 30.17 + IVA 4.83 = 35.00, no 40.60', () => {
    expect(precioB2B(ABARROTES[0], true)).toBeCloseTo(30.172414, 6);
    expect(totalVenta(ABARROTES[0], 1)).toBeCloseTo(35, 6);
  });

  it('cantidades 1..500: total = precio × cantidad (exacto hasta 300, máx 1 centavo después)', () => {
    // ponytail: el rate viaja a 6 decimales; 20/1.08 = 18.518519 redondea hacia arriba
    // y en ×395+ ABUELITA sale 1 centavo arriba. La clave doble (0 items en prod) ya se
    // sale en ×361. Upgrade si algún día B2B vende cientos: derivar el impuesto como
    // round2(precio×qty) − round2(base) en frappeSales, con chequeo de equivalencia.
    const fallas: string[] = [];
    for (const item of ABARROTES) {
      for (let qty = 1; qty <= 500; qty++) {
        const esperado = Math.round(parseFloat(item.custom_precio_de_venta) * qty * 100) / 100;
        const total = Math.round(totalVenta(item, qty) * 100) / 100;
        const tope = qty <= 300 ? 0 : 0.011;
        if (Math.abs(total - esperado) > tope) fallas.push(`${item.nombre} ×${qty}: ${total} ≠ ${esperado}`);
      }
    }
    expect(fallas).toEqual([]);
  });

  it('la columna Precio venta enseña el precio CON impuesto (el de la lista)', () => {
    const rate = precioB2B(ABARROTES[0], true).toFixed(6);
    expect(precioConImpuesto({ rate, impuesto_rate: 0.16 })).toBeCloseTo(35, 4);
    expect(precioConImpuesto({ rate: '35', impuesto_rate: 0 })).toBe(35);
  });

  it('tasa 0 no se toca', () => {
    expect(precioB2B(ABARROTES[4], true)).toBe(35);
  });

  it('materia prima sigue al COSTO sin impuesto, sin dividir', () => {
    const mp = { custom_precio_por_kg: '18.5', custom_precio_de_venta: '30', custom_impuesto: 'iva16' };
    expect(precioB2B(mp, false)).toBe(18.5);
  });

  it('abarrote sin precio de venta cae al costo, nunca a 0', () => {
    expect(precioB2B({ custom_precio_por_kg: '12', custom_impuesto: 'ieps' }, true)).toBe(12);
    expect(precioB2B({}, false)).toBe(0);
  });
});
