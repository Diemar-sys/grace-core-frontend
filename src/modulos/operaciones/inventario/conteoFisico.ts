// Lógica pura del conteo físico (sale de components/ConteoFisico.jsx el 07-oct, sin cambios de lógica).
type Item = Record<string, any>;
type Conteo = Record<string, string>;

// Factor presentación→base (Bulto de 25kg → 25; Caja de 0.86kg → 0.86).
// 1 solo si no hay presentación o factor inválido: ese ya está en base, no se multiplica.
export const presFactor = (it?: Item | null): number => {
  const f = parseFloat(it?.custom_cantidad_por_presentación);
  return f > 0 && f !== 1 ? f : 1;
};
// Unidad en la que se captura/muestra: presentación si la tiene, si no la base.
export const presUnit = (it?: Item | null): string =>
  presFactor(it) !== 1 && it?.custom_presentación ? it.custom_presentación : (it?.stock_uom || 'Kg');

// Universo a contar según el filtro de tipo. Sin tipo devuelve la MISMA
// referencia, no una copia: así el useMemo del componente no se invalida de gratis.
export const filtrarPorTipo = (items: Item[], tipo?: string): Item[] =>
  tipo ? items.filter(i => i.custom_tipo_item === tipo) : items;

/**
 * Cuántos del universo ya tienen conteo capturado.
 *
 * Cruza por Set en vez de buscar cada código dentro del arreglo: O(n+m) contra
 * el O(n·m) de un `find` por renglón. Con 487 items y 200 capturados eso es la
 * diferencia entre 687 pasos y 97,400 en cada tecla.
 *
 * `conteo` conserva lo capturado en OTROS tipos: cambiar el filtro no borra
 * nada, solo cambia contra qué se compara.
 */
export function contarPendientes(conteo: Conteo | null | undefined, universo: Item[] | null | undefined): number {
  const contados = new Set(
    Object.entries(conteo || {}).filter(([, v]) => v !== '').map(([code]) => code)
  );
  return (universo || []).reduce((n, i) => n + (contados.has(i.item_code) ? 1 : 0), 0);
}

// Líneas del ajuste = conteos en BASE que DIFIEREN del stock del sistema.
// ponytail: ERPNext borra los ítems sin cambio en el Stock Reconciliation; si TODOS coinciden
// truena EmptyStockReconciliationItemsError. Filtramos aquí los que ya cuadran (solo compara qty;
// el conteo no toca valuation_rate). Epsilon 0.001 = el step del input.
// ponytail: `find` por conteo es O(n·m) (~487 items, solo al guardar); Map por item_code si estorba.
export function lineasAjuste(conteo: Conteo, items: Item[]): { item_code: string; qty: number }[] {
  const out: { item_code: string; qty: number }[] = [];
  for (const [item_code, v] of Object.entries(conteo)) {
    if (v === '') continue;
    const it = items.find(i => i.item_code === item_code);
    const qty = parseFloat(v) * presFactor(it);
    const actual = parseFloat(it?.actual_qty) || 0;
    if (Math.abs(qty - actual) > 0.001) out.push({ item_code, qty });
  }
  return out;
}
