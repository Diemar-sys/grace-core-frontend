/**
 * precioCanal — resolución PURA del precio de venta por canal.
 *
 * El mismo pan vale distinto según a dónde va: sucursal (urbano, el más alto),
 * pueblos (puntos fijos) y camioneta (rutas a ranchos). Esta lógica congela el
 * precio en el envío a sucursal; vive aparte de frappeStock para testearla sin
 * red, porque un precio mal congelado es dinero mal cobrado en la ruta.
 */

export type TipoPrecio = 'normal' | 'pueblos' | 'camioneta';

/** Campo del catálogo donde vive el precio de cada canal ('normal' usa el base). */
const CAMPO_PRECIO: Record<TipoPrecio, string | null> = {
  normal: null,
  pueblos: 'custom_precio_de_venta_pueblos',
  camioneta: 'custom_precio_de_venta_camioneta',
};

/** Tipo de almacén → canal de precio. Lo que no está aquí cobra precio normal. */
const PRECIO_POR_TIPO: Record<string, TipoPrecio> = {
  CAMIONETA: 'camioneta',
  'PUNTO DE VENTA': 'pueblos',
};

/**
 * Qué canal de precio le toca a un almacén según su TIPO (no una lista de
 * nombres: un almacén nuevo entra solo con marcarle su tipo). Ojo — un almacén
 * SIN tipo cae a 'normal' y congelaría precio de sucursal sin que nadie lo note.
 */
export function tipoPrecioPorAlmacen(warehouseType: string | null | undefined): TipoPrecio {
  return PRECIO_POR_TIPO[warehouseType || ''] || 'normal';
}

/**
 * Precio de venta congelado desde el catálogo, por stock_uom (peso real, ej.
 * por Kg). Prioridad espejo de NuevaVentaB2B. Si el producto no tiene capturado
 * el precio de su canal, cae al normal — congelar 0 dejaría la liquidación de
 * la ruta sin con qué cobrar. Devuelve 0 solo si no hay ningún dato.
 */
export function resolverPrecioVenta(item: any, tipoPrecio: TipoPrecio = 'normal'): number {
  const cantPres = parseFloat(item.custom_cantidad_por_presentación) || 1;
  const campoCanal = CAMPO_PRECIO[tipoPrecio];
  if (campoCanal && parseFloat(item[campoCanal]) > 0) {
    return parseFloat(item[campoCanal]) / cantPres;
  }
  if (item.custom_precio_por_kg) return parseFloat(item.custom_precio_por_kg);
  if (item.custom_precio_de_venta) return parseFloat(item.custom_precio_de_venta) / cantPres;
  if (item.standard_rate) return parseFloat(item.standard_rate) / cantPres;
  return 0;
}
