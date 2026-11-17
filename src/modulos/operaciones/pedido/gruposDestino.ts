/**
 * Ordena los destinos por grupo y arma los tramos del encabezado.
 *
 * Ver «Paseos del Bosque» al lado de «Isma» no dice nada; verlos bajo SUCURSALES
 * y CAMIONETAS sí. Un destino sin grupo no se esconde: cae en OTROS.
 */
export interface TramoGrupo {
  grupo: string;
  destinos: string[];
}

export function agruparDestinos(
  destinos: string[],
  grupos: Record<string, string>,
  orden: string[],
): TramoGrupo[] {
  const porGrupo = new Map<string, string[]>();
  for (const d of destinos) {
    const g = grupos[d] ?? 'OTROS';
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), d]);
  }
  const conocidos = orden.filter((g) => porGrupo.has(g));
  const resto = [...porGrupo.keys()].filter((g) => !orden.includes(g)).sort();
  return [...conocidos, ...resto].map((grupo) => ({
    grupo,
    destinos: porGrupo.get(grupo) ?? [],
  }));
}

/** Los destinos en el orden en que se pintan las columnas. */
export const enOrden = (tramos: TramoGrupo[]): string[] => tramos.flatMap((t) => t.destinos);
