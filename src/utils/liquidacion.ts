/**
 * Liquidación de ruta en camioneta.
 *
 * La cadena es: se hornea en matriz → sale a la camioneta → se vende en la ruta
 * → lo que sobra regresa a una sucursal (pan dulce, vive un día más) o se merma
 * (bolillo, no se revende).
 *
 * Nadie captura la venta: se DEDUCE del inventario, porque la camioneta es un
 * almacén de verdad y todo lo que salió de ella tiene documento.
 *
 *     vendido = salió − regresó − mermado
 *
 * De ahí sale gratis un control que no existía: al cerrar el día el stock de la
 * camioneta debe quedar en 0. Si no, algo no se capturó — no hay que cuadrarlo
 * a mano, el almacén lo delata (ver `sobranteSinCapturar`).
 */

/** Comisión del repartidor: 10% de la venta más una cuota fija. */
export const COMISION_PCT  = 0.10;
export const COMISION_FIJA = 200;

/**
 * Redondeo a centavos half-up "como la calculadora".
 *
 * `Math.round(n * 100)` no basta: 3 × 3.335 da 10.004999999999999 en binario,
 * así que un importe que a mano es 10.005 caía a 10.00. El `toPrecision(12)`
 * limpia esa basura antes de redondear — 12 dígitos significativos son de sobra
 * para pesos y no alcanzan a tocar el error del flotante.
 */
const round2 = (n: number) => Math.round(Number((n * 100).toPrecision(12))) / 100;

export interface MovimientoItem {
  item_code: string;
  item_name?: string;
  uom?: string;
  qty: number;
  /** Precio congelado al salir (por unidad base). Solo viene en las salidas. */
  precio?: number;
}

export interface RenglonLiquidacion {
  item_code: string;
  item_name: string;
  uom: string;
  salio: number;
  regreso: number;
  merma: number;
  vendido: number;
  precio: number;
  importe: number;
}

export interface Liquidacion {
  renglones: RenglonLiquidacion[];
  totalVenta: number;
  comision: number;
  neto: number;
  /** Renglones con vendido negativo: regresó/mermó más de lo que salió. */
  inconsistentes: RenglonLiquidacion[];
}

/** Suma cantidades por item_code y se queda con el primer precio que vea. */
function acumular(movs: MovimientoItem[]): Map<string, MovimientoItem> {
  const mapa = new Map<string, MovimientoItem>();
  for (const m of movs || []) {
    const prev = mapa.get(m.item_code);
    if (prev) {
      prev.qty += Number(m.qty) || 0;
      if (!(prev.precio! > 0) && Number(m.precio) > 0) prev.precio = Number(m.precio);
    } else {
      mapa.set(m.item_code, {
        ...m,
        qty: Number(m.qty) || 0,
        precio: Number(m.precio) || 0,
      });
    }
  }
  return mapa;
}

/**
 * Arma la liquidación del día. `salidas` manda: un producto que nunca salió no
 * puede haberse vendido, así que los renglones se recorren desde ahí.
 */
export function calcularLiquidacion(
  salidas: MovimientoItem[],
  regresos: MovimientoItem[] = [],
  mermas: MovimientoItem[] = [],
  { pct = COMISION_PCT, fija = COMISION_FIJA } = {},
): Liquidacion {
  const salio    = acumular(salidas);
  const volvio   = acumular(regresos);
  const mermado  = acumular(mermas);

  const renglones: RenglonLiquidacion[] = [...salio.values()].map(s => {
    const regreso = volvio.get(s.item_code)?.qty  || 0;
    const merma   = mermado.get(s.item_code)?.qty || 0;
    const vendido = round2(s.qty - regreso - merma);
    const precio  = Number(s.precio) || 0;
    return {
      item_code: s.item_code,
      item_name: s.item_name || s.item_code,
      uom:       s.uom || '',
      salio:     s.qty,
      regreso,
      merma,
      vendido,
      precio,
      importe:   round2(vendido * precio),
    };
  });

  // Un vendido negativo no es una venta chica: es captura equivocada (se regresó
  // pan que salió otro día, o se tecleó de más). Se marca en vez de restar del
  // total, donde se escondería dentro de otro producto.
  const inconsistentes = renglones.filter(r => r.vendido < 0);

  const totalVenta = round2(renglones.reduce((s, r) => s + Math.max(r.importe, 0), 0));
  // La comisión se cobra sobre lo vendido; sin venta no hay cuota fija que pagar.
  const comision = totalVenta > 0 ? round2(totalVenta * pct + fija) : 0;

  return {
    renglones,
    totalVenta,
    comision,
    neto: round2(totalVenta - comision),
    inconsistentes,
  };
}

/**
 * Renglones que se vendieron pero salieron sin precio congelado: no hay con qué
 * cobrarlos y entrarían al total como $0, bajando la comisión sin que se note.
 * Se avisa antes de liquidar, no después.
 */
export function vendidoSinPrecio(liq: Liquidacion): RenglonLiquidacion[] {
  return liq.renglones.filter(r => r.vendido > 0 && !(r.precio > 0));
}
