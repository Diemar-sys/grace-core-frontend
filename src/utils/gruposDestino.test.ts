import { describe, it, expect } from 'vitest';
import { agruparDestinos, enOrden } from './gruposDestino';

const GRUPOS = {
  'P.BOSQUE': 'SUCURSALES', SANTUARIO: 'SUCURSALES', 'P.REAL': 'SUCURSALES',
  DEli: 'CLIENTES', MILA: 'PUEBLOS', VEGIL: 'PUEBLOS',
  ISMA: 'CAMIONETAS', MARTIN: 'CAMIONETAS',
};
const ORDEN = ['SUCURSALES', 'CLIENTES', 'PUEBLOS', 'CAMIONETAS', 'OTROS'];

describe('agruparDestinos', () => {
  it('junta cada destino con los suyos y respeta el orden de los grupos', () => {
    // llegan revueltos, como salen de la hoja
    const t = agruparDestinos(['ISMA', 'DEli', 'P.BOSQUE', 'MILA', 'SANTUARIO'], GRUPOS, ORDEN);
    expect(t.map((x) => x.grupo)).toEqual(['SUCURSALES', 'CLIENTES', 'PUEBLOS', 'CAMIONETAS']);
    expect(enOrden(t)).toEqual(['P.BOSQUE', 'SANTUARIO', 'DEli', 'MILA', 'ISMA']);
  });

  it('no inventa grupos vacíos', () => {
    const t = agruparDestinos(['ISMA'], GRUPOS, ORDEN);
    expect(t).toEqual([{ grupo: 'CAMIONETAS', destinos: ['ISMA'] }]);
  });

  it('un destino desconocido cae en OTROS y no se pierde', () => {
    const t = agruparDestinos(['P.REAL', 'SUCURSAL NUEVA'], GRUPOS, ORDEN);
    expect(enOrden(t)).toContain('SUCURSAL NUEVA');
    expect(t.find((x) => x.grupo === 'OTROS')?.destinos).toEqual(['SUCURSAL NUEVA']);
  });

  it('no pierde ninguna columna', () => {
    const todos = Object.keys(GRUPOS);
    expect(enOrden(agruparDestinos(todos, GRUPOS, ORDEN)).sort()).toEqual([...todos].sort());
  });
});
