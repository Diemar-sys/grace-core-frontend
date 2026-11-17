/**
 * Buckets de categorías (Item Group) por rama del árbol.
 *
 * El catálogo tiene tres familias que NO se pueden mezclar en un mismo select:
 * producto terminado, insumo general y materia prima. Antes se separaban
 * comparando `parent_item_group` con el nombre de la raíz, lo que solo funciona
 * mientras el árbol sea de un nivel. Al colgar las categorías de pan de su
 * departamento (PAN MANTECA → PANQUELERIA → PRODUCTOS TERMINADOS) esa
 * comparación dejó de encontrarlas, y peor: las mandaba al bucket de materia
 * prima, porque ese bucket era «todo lo que no es hijo directo de PT ni de IG».
 *
 * Aquí se usa el nested set que ERPNext ya mantiene (`lft`/`rgt`): un grupo está
 * dentro de una rama si su intervalo cae dentro del intervalo de la raíz. Es una
 * comparación, no un recorrido, y aguanta cualquier profundidad futura sin
 * volver a tocarse.
 */

export interface GrupoArbol {
  name: string;
  parent_item_group?: string | null;
  is_group?: number | boolean | null;
  lft?: number | null;
  rgt?: number | null;
}

/** Las hojas (donde SÍ se pueden colgar items) que cuelgan de `raiz`, a cualquier profundidad. */
export function hojasDe(grupos: GrupoArbol[], raiz: string): GrupoArbol[] {
  const nodo = (grupos || []).find(g => g.name === raiz);
  // Sin lft/rgt no hay árbol que consultar: mejor lista vacía que una lista
  // equivocada — un select vacío se nota, uno con las categorías de otra familia no.
  if (!nodo || nodo.lft == null || nodo.rgt == null) return [];
  return (grupos || []).filter(
    g => !g.is_group && g.lft != null && g.lft > nodo.lft! && g.rgt! < nodo.rgt!,
  );
}

/**
 * Reparte las hojas en los tres buckets del formulario de alta.
 * `resto` es materia prima: lo que no cuelga de ninguna de las dos raíces.
 */
export function bucketsCategorias(
  grupos: GrupoArbol[], raizPT: string, raizIG: string,
): { pt: GrupoArbol[]; ig: GrupoArbol[]; resto: GrupoArbol[] } {
  const pt = hojasDe(grupos, raizPT);
  const ig = hojasDe(grupos, raizIG);
  const clasificadas = new Set([...pt, ...ig].map(g => g.name));
  const resto = (grupos || []).filter(g => !g.is_group && !clasificadas.has(g.name));
  return { pt, ig, resto };
}
