// El pie de la tabla del pedido es el número que se lee en voz alta —«el día
// fueron 13,890 piezas»— y un total mal sumado no se ve mal: se ve como un
// total. Estos casos son las formas conocidas de que mienta sin fallar.
import { describe, it, expect } from 'vitest';
import { totalesPedido } from './ConsultaPedido';
import type { RenglonGuardado } from '../services/frappePedido';

const r = (
  clave: string,
  depto: string,
  piezas: Record<string, number>,
): RenglonGuardado => ({
  clave,
  producto: `PAN ${clave}`,
  depto,
  piezas,
  total: Object.values(piezas).reduce((a, n) => a + n, 0),
  por_charola: 0,
  charolas_texto: '',
});

describe('totalesPedido — el pie de la tabla', () => {
  it('suma por departamento aunque los renglones NO vengan agrupados', () => {
    // La versión vieja filtraba todo el arreglo por depto, así que soportaba
    // esto; una que solo acumule mientras el depto no cambie lo perdería.
    const { porDepto } = totalesPedido([
      r('A', 'BLANCO', { MATRIZ: 10 }),
      r('B', 'DULCE', { MATRIZ: 5 }),
      r('C', 'BLANCO', { MATRIZ: 7 }),
    ]);
    expect(porDepto.get('BLANCO')).toBe(17);
    expect(porDepto.get('DULCE')).toBe(5);
  });

  it('un destino que solo aparece en UN renglón igual sale en el total', () => {
    // Si el acumulador se sembrara con las llaves del primer renglón, DELI
    // saldría en blanco y nadie lo notaría: la columna existe, el número no.
    const { porDestino } = totalesPedido([
      r('A', 'BLANCO', { MATRIZ: 10 }),
      r('B', 'BLANCO', { MATRIZ: 4, DELI: 6 }),
    ]);
    expect(porDestino.MATRIZ).toBe(14);
    expect(porDestino.DELI).toBe(6);
  });

  it('el cero explícito no borra al destino ni suma de más', () => {
    const { porDestino } = totalesPedido([
      r('A', 'BLANCO', { MATRIZ: 0, DELI: 3 }),
      r('B', 'BLANCO', { MATRIZ: 8, DELI: 0 }),
    ]);
    expect(porDestino.MATRIZ).toBe(8);
    expect(porDestino.DELI).toBe(3);
  });

  it('el total por depto usa `total` del renglón, no la suma de sus columnas', () => {
    // El backend manda `total` ya calculado. Si aquí se recalculara sumando
    // `piezas`, pantalla y PDF podrían discrepar en cuanto el backend cambie
    // qué destinos manda: dos verdades sobre el mismo dato.
    const renglon = r('A', 'BLANCO', { MATRIZ: 10 });
    renglon.total = 12;
    const { porDepto } = totalesPedido([renglon]);
    expect(porDepto.get('BLANCO')).toBe(12);
  });

  it('sin renglones no truena y no inventa totales', () => {
    const { porDepto, porDestino } = totalesPedido([]);
    expect(porDepto.size).toBe(0);
    expect(Object.keys(porDestino)).toEqual([]);
  });
});
