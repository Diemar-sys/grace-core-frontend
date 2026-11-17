// 21-oct: el dropdown Destino de Envío a Sucursal, agrupado por TIPO de almacén.
// Sucursales = la lista del servidor (custom_es_sucursal_extendida); camionetas y pueblos
// se agregan por TIPO, sin depender de esa marca (dev la tiene en las camionetas y no en
// los pueblos). Cada almacén sale una vez. Antes: la lista como «Sucursales» y encima
// las camionetas otra vez (duplicadas), y los pueblos (PUNTO DE VENTA) no salían.

interface Destino { warehouse: string; label: string }
interface Almacen { name: string; label: string; warehouse_type: string }
export interface GrupoDestino { titulo: string; destinos: Destino[] }

const GRUPOS: Array<[string, string]> = [
  ['CAMIONETA', 'Camionetas (precio de camioneta)'],
  ['PUNTO DE VENTA', 'Pueblos (precio de pueblos)'],
];

/** Destinos del servidor + camionetas y pueblos por tipo, sin repetir, agrupados. O(n + m). */
export function gruposDestinoEnvio(destinos: Destino[], almacenes: Almacen[]): GrupoDestino[] {
  const tituloDe = new Map(GRUPOS);
  const tipoDe = new Map(almacenes.map(a => [a.name, a.warehouse_type]));
  const porTipo = almacenes.filter(a => tituloDe.has(a.warehouse_type)).map(a => ({ warehouse: a.name, label: a.label }));
  const porTitulo = new Map<string, Destino[]>([['Sucursales', []], ...GRUPOS.map(([, t]) => [t, []] as [string, Destino[]])]);
  const vistos = new Set<string>();
  for (const d of [...destinos, ...porTipo]) {
    if (vistos.has(d.warehouse)) continue;
    vistos.add(d.warehouse);
    porTitulo.get(tituloDe.get(tipoDe.get(d.warehouse) ?? '') ?? 'Sucursales')!.push(d);
  }
  return [...porTitulo].filter(([, ds]) => ds.length).map(([titulo, ds]) => ({ titulo, destinos: ds }));
}
