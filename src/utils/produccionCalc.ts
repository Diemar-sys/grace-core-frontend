/**
 * produccionCalc — la aritmética PURA de recetas y producción.
 *
 * Vive aparte de frappeProduccion (que solo habla con la API) para poder
 * testearla sin red. Aquí es donde vivió el bug del −$1M: escalar mal el
 * consumo de ingredientes al registrar producción. Por eso lleva tests.
 */

/**
 * Factor de escala de una receta: cuántas veces el BOM base se produce.
 * El BOM define "produzco N unidades con estos ingredientes"; si hoy se
 * producen M, cada ingrediente se multiplica por M/N.
 * - bomQuantity 0 o inválido → 1 (el BOM produce una tanda).
 * - cantidadProducida inválida → 0 (no se produce nada → factor 0 → el guard
 *   qtyNum de frappeStock truena aguas abajo en vez de mover qty basura).
 */
export function factorProduccion(
  cantidadProducida: number | string,
  bomQuantity: number | string,
): number {
  const cant = parseFloat(String(cantidadProducida)) || 0;
  const base = parseFloat(String(bomQuantity)) || 1;
  return cant / base;
}

/** Escala la cantidad base de un ingrediente por el factor de producción. */
export function escalarIngrediente(qtyBase: number | string, factor: number): number {
  return (parseFloat(String(qtyBase)) || 0) * factor;
}

export interface LineaCosteo {
  qty: number | string;
  precio_final: number | string;
}

export interface DetalleCosteo {
  qty: number;
  precio_final: number;
  costo: number;
}

/**
 * Costea líneas {qty, precio_final}: costo por línea, total y costo unitario.
 * Único origen del cálculo que antes estaba duplicado en calcularCostoBOM y
 * calcularCostoEnVivo. cantidadProducida cae a 1 si es 0/inválida (nunca se
 * divide entre cero — el BOM siempre produce al menos una unidad).
 */
export function costearLineas(
  lineas: LineaCosteo[],
  cantidadProducida: number | string,
): { costoTotal: number; costoPorUnidad: number; detalle: DetalleCosteo[] } {
  let costoTotal = 0;
  const detalle = lineas.map((l) => {
    const qty = parseFloat(String(l.qty)) || 0;
    const precio_final = parseFloat(String(l.precio_final)) || 0;
    const costo = precio_final * qty;
    costoTotal += costo;
    return { qty, precio_final, costo };
  });
  const cant = parseFloat(String(cantidadProducida)) || 1;
  return { costoTotal, costoPorUnidad: costoTotal / cant, detalle };
}
