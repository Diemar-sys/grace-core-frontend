// Un tile sin su ruta en roles.ts se pinta pero el guard lo rebota al panel, y
// parece que el clic no hace nada. Ya pasó dos veces; que truene aquí en vez de
// descubrirlo en el navegador.
import { describe, it, expect } from 'vitest';
import { MODULOS } from '../config/modulos';
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
