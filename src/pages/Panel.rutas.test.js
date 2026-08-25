// Un tile sin su ruta en roles.ts se pinta pero el guard lo rebota al panel, y
// parece que el clic no hace nada. Ya pasó dos veces; que truene aquí en vez de
// descubrirlo en el navegador.
import { describe, it, expect } from 'vitest';
import { MODULOS, MODULOS_CONSULTAS, MODULOS_REPORTES } from '../config/modulos';
import { ROLES } from '../config/roles';

describe('tiles de Operaciones contra el guard de rutas', () => {
  const rutasDeAlgunNivel = new Set(Object.values(ROLES).flatMap((r) => r.rutas));
  const modulosDeAlgunNivel = new Set(Object.values(ROLES).flatMap((r) => r.modulosPanel));

  it.each(MODULOS.map((m) => [m.key, m.path]))(
    'el tile "%s" apunta a %s y algún nivel puede entrar',
    (key, path) => {
      expect(modulosDeAlgunNivel.has(key)).toBe(true);
      expect(rutasDeAlgunNivel.has(path)).toBe(true);
    },
  );

  it('ningún nivel lista un módulo que no exista como tile', () => {
    const tiles = new Set(MODULOS.map((m) => m.key));
    // nomina vive en Egresos, no tiene tile propio en Operaciones
    const sinTile = [...modulosDeAlgunNivel].filter((k) => !tiles.has(k) && k !== 'nomina');
    expect(sinTile).toEqual([]);
  });
});

// Los tiles de Consultas rebotan igual: la ruta base (sin ?modo=consulta) tiene
// que estar dada de alta en roles.ts, y el módulo tiene que existir en algún nivel.
describe('tiles de Consultas contra el guard de rutas', () => {
  const rutasDeAlgunNivel = new Set(Object.values(ROLES).flatMap((r) => r.rutas));
  const modulosDeAlgunNivel = new Set(Object.values(ROLES).flatMap((r) => r.modulosPanel));

  it.each(MODULOS_CONSULTAS.map((m) => [m.nombre, m.path]))(
    'el tile de consulta "%s" apunta a %s y algún nivel puede entrar',
    (_nombre, path) => {
      expect(rutasDeAlgunNivel.has(path.split('?')[0])).toBe(true);
    },
  );

  it('ningún tile de Consultas usa un módulo que ningún nivel tenga', () => {
    const huerfanos = MODULOS_CONSULTAS
      .map((m) => m.key)
      .filter((k) => !modulosDeAlgunNivel.has(k));
    expect(huerfanos).toEqual([]);
  });
});

// Los tiles de Reportes NO estaban cubiertos, y son los que más fácil se
// desincronizan: su ruta no sale de ROUTE[key] sino de una lista aparte
// (RUTAS_REPORTES), así que agregar el tile y olvidar la lista no rompe nada
// visible — el tile se pinta y el clic rebota al panel.
describe('tiles de Reportes contra el guard de rutas', () => {
  const rutasDeAlgunNivel = new Set(Object.values(ROLES).flatMap((r) => r.rutas));

  it.each(MODULOS_REPORTES.map((m) => [m.nombre, m.path]))(
    'el tile de reporte "%s" apunta a %s y algún nivel puede entrar',
    (_nombre, path) => {
      expect(rutasDeAlgunNivel.has(path.split('?')[0])).toBe(true);
    },
  );

  it('ninguna ruta de reporte quedó permitida sin su tile (permiso muerto)', () => {
    const conTile = new Set(MODULOS_REPORTES.map((m) => m.path.split('?')[0]));
    const huerfanas = [...rutasDeAlgunNivel]
      .filter((r) => r.startsWith('/reportes/') && !conTile.has(r));
    expect(huerfanas).toEqual([]);
  });

  it('ningún tile de Reportes repite ruta (dos tiles al mismo lado)', () => {
    const rutas = MODULOS_REPORTES.map((m) => m.path);
    expect(rutas.length).toBe(new Set(rutas).size);
  });
});
