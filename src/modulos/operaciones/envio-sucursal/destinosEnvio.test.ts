import { gruposDestinoEnvio } from './destinosEnvio';

// Forma real de dev el 21-oct: las camionetas vienen en la lista del servidor Y antes se
// pintaban otra vez aparte; los pueblos son PUNTO DE VENTA.
const d = (w: string) => ({ warehouse: w, label: w.replace(/ - PG$/, '') });
const a = (w: string, warehouse_type: string) => ({ name: w, label: d(w).label, warehouse_type });
const ALMACENES = [
  a('TIENDA - PIRAMIDES - PG', 'SUCURSAL'),
  a('CAMIONETA - ISMA - PG', 'CAMIONETA'),
  a('PUNTO VENTA - MILAGRO - PG', 'PUNTO DE VENTA'),
  a('ALMACEN - PAN BLANCO - PG', 'DEPARTAMENTO'),
];

describe('gruposDestinoEnvio', () => {
  it('cada destino sale UNA vez, en el grupo de su tipo', () => {
    const grupos = gruposDestinoEnvio(
      [d('CAMIONETA - ISMA - PG'), d('PUNTO VENTA - MILAGRO - PG'), d('TIENDA - PIRAMIDES - PG')], ALMACENES);
    expect(grupos.map(g => [g.titulo, g.destinos.map(x => x.warehouse)])).toEqual([
      ['Sucursales', ['TIENDA - PIRAMIDES - PG']],
      ['Camionetas (precio de camioneta)', ['CAMIONETA - ISMA - PG']],
      ['Pueblos (precio de pueblos)', ['PUNTO VENTA - MILAGRO - PG']],
    ]);
  });

  it('camionetas y pueblos salen por TIPO aunque el servidor no los marque (prod/dev difieren); departamentos no', () => {
    const grupos = gruposDestinoEnvio([d('TIENDA - PIRAMIDES - PG')], ALMACENES);
    expect(grupos.flatMap(g => g.destinos.map(x => x.warehouse))).toEqual(
      ['TIENDA - PIRAMIDES - PG', 'CAMIONETA - ISMA - PG', 'PUNTO VENTA - MILAGRO - PG']);
  });

  it('un destino de tipo desconocido no se esconde: va a Sucursales', () => {
    expect(gruposDestinoEnvio([d('OTRO - PG')], ALMACENES)[0].destinos).toEqual([d('OTRO - PG')]);
  });
});
