// Lógica pura de la Entrada de Pan (sale de components/modals/ModalEntradaPan.jsx el 07-oct, sin cambios de lógica).
type Fila = Record<string, any>;
type Catalogo = Record<string, Record<string, any>>;

/**
 * Texto del costo por pieza para el input.
 *
 * `precio × 0.35` (el costo provisional) produce ruido de coma flotante:
 * 8.70 × 0.35 = 3.0449999999999995. Sin esto, el panadero ve 16 decimales en
 * un campo de dinero. Se corta a 4 y se quitan los ceros de cola, que es la
 * misma precisión con la que ya se pinta el costo de receta.
 */
export function costoTexto(n: unknown): string {
  const v = parseFloat(String(n));
  if (!(v > 0)) return '';
  return String(Math.round(v * 10000) / 10000);
}

/**
 * Renglones precargados con el pedido del día: qué panes y cuántos se pidieron.
 *
 * La hoja es la verdad del PEDIDO, no de la producción — se escribe antes de que
 * el pan exista. Por eso la cantidad se precarga pero `pedido` se guarda aparte:
 * la pantalla enseña los dos y un número corregido se ve distinto del pedido.
 * Sin esto hay que teclear 77 renglones de memoria cada mañana.
 *
 * ponytail: no se pregunta la receta de cada pan (serían 77 peticiones). El
 * servidor ignora el costo tecleado cuando el pan tiene receta (`_resolver_costo`),
 * así que preguntarlo no cambiaría el resultado.
 */
export function filasDesdePedido(renglones: Fila[] | null | undefined, catalogo: Catalogo,
                                 entrado: Record<string, number> = {}): Fila[] {
  // 🔴 21-sep: precarga `pedido − lo que YA entró hoy`. Antes la 2a entrada del día
  // volvía a traer el pedido completo y guardar sin mirar duplicaba la hornada
  // (250 conchas → 500). El pan cuyo pedido ya entró completo no se precarga; si
  // salió de más del horno, se captura a mano como siempre.
  return (renglones || [])
    .filter(r => catalogo[r.clave])
    .map(r => {
      const yaEntro = entrado[r.clave] || 0;
      return {
        _id: `ped-${r.clave}`,
        item_code: r.clave,
        qty: String((r.total ?? 0) - yaEntro),   // ≤ 0 lo descarta el filtro de abajo
        costo: costoTexto(catalogo[r.clave]?.custom_costo_estimado),
        pedido: r.total ?? null,
        yaEntro,
      };
    })
    .filter(f => parseFloat(f.qty) > 0);
}

/**
 * El panadero teclea el NOMBRE del pan; el backend quiere el item_code.
 * ponytail: nombre primero, código después — así un código pegado o escaneado
 * sigue sirviendo. Nombre repetido en el catálogo = gana el primero.
 */
export function resolverItemCode(texto: string | null | undefined, productos: Fila[]): string {
  const t = (texto || '').trim().toUpperCase();
  if (!t) return '';
  const prod = productos.find(p => p.item_name?.toUpperCase() === t)
    || productos.find(p => p.item_code?.toUpperCase() === t);
  return prod?.item_code || '';
}

/** Renglones listos para el backend. Exportado: es lo que se prueba. */
export function itemsPayload(filas: Fila[]): { item_code: string; qty: number; costo?: number }[] {
  return filas
    .filter(f => f.item_code && parseFloat(f.qty) > 0)
    .map(f => ({
      item_code: f.item_code,
      qty: parseFloat(f.qty),
      ...(parseFloat(f.costo) > 0 ? { costo: parseFloat(f.costo) } : {}),
    }));
}

/** Valor total de la hornada. El costo tecleado manda; si no, el del catálogo. */
export function calcularValor(filas: Fila[], catalogo: Catalogo): number {
  return filas.reduce((acc, f) => {
    const qty = parseFloat(f.qty) || 0;
    if (!f.item_code || qty <= 0) return acc;
    const costo = parseFloat(f.costo) > 0
      ? parseFloat(f.costo)
      : parseFloat(catalogo[f.item_code]?.custom_costo_estimado) || 0;
    return acc + qty * costo;
  }, 0);
}

/**
 * ¿Se puede teclear el costo de este renglón? Solo el Gerente, y solo si el pan
 * no tiene receta (con receta el costo sale de los ingredientes). Candado del
 * costo, 10-sep: a los demás el servidor les ignora lo tecleado, así que dejarlos
 * escribir sería prometerles algo que no pasa.
 */
export const costoEditable = (fila: Fila, esGerente: boolean): boolean => esGerente && !fila.conReceta;
