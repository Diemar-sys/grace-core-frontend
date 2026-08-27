/**
 * Margen de un pan: lo que deja cada pieza sobre lo que cuesta producirla.
 *
 * Devuelve null cuando falta cualquiera de los dos números, porque un margen
 * inventado es peor que no tenerlo: «$0 de costo» se leería como 100% de
 * ganancia justo en los panes que todavía no tienen receta.
 *
 * `bajoCosto` es la alerta que importa: se está vendiendo en menos de lo que
 * cuesta.
 */
export function calcularMargen(precioVenta: any, costo: any) {
  const venta = parseFloat(precioVenta) || 0;
  const cost  = parseFloat(costo) || 0;
  if (venta <= 0 || cost <= 0) return null;
  const pesos = venta - cost;
  return { pesos, pct: (pesos / venta) * 100, bajoCosto: pesos < 0 };
}

/**
 * Categorías presentes en la lista, con cuántos panes tiene cada una.
 * Salen de los panes ya cargados y no de otra consulta, así el select nunca
 * ofrece una categoría que dejaría la pantalla vacía.
 */
export function categoriasDePanes(panes: any[]) {
  const conteo = new Map<string, number>();
  (panes || []).forEach(p => {
    if (p?.item_group) conteo.set(p.item_group, (conteo.get(p.item_group) || 0) + 1);
  });
  return [...conteo].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

/**
 * Filtra por categoría y texto (nombre o clave). Función aparte porque un filtro
 * mal hecho no truena: solo muestra la lista incompleta, y eso no se nota.
 */
export function filtrarPanes(panes: any[], grupo?: string, busca?: string) {
  const q = (busca || '').trim().toLowerCase();
  return (panes || []).filter(p =>
    (!grupo || p.item_group === grupo) &&
    (!q || p.item_name?.toLowerCase().includes(q) || p.item_code?.toLowerCase().includes(q))
  );
}
