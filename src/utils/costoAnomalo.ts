/**
 * Detecta el renglón de compra cuyo costo no se parece a la historia del item.
 *
 * 🔴 Por qué existe habiendo ya una alerta de margen: la que existe compara
 * `rate` contra `custom_precio_de_compra`, los dos en la unidad de la
 * PRESENTACIÓN. Eso no ve el error que más caro ha salido, que es la UOM.
 *
 * `MAT-PRE-2026-00095` (02-jul): alguien capturó `200 CAJA` a `rate 52.90`
 * cuando la caja son 20 Kg a $1,035.19 — llenó el renglón entero pensando en
 * kilos. Entraron 4,000 Kg en vez de 200 a $2.645/Kg, el promedio de la bodega
 * se desplomó de $51.76 a $9.96, y los traspasos de julio se llevaron el precio
 * roto a PUERTA, PIRAMIDES y SANTUARIOS, donde siguió congelado hasta que se
 * reparó el 03-sep: $8,846.23.
 *
 * 🔴 Y esa compra SÍ tenía con qué compararse: el catálogo traía $1,035.185185
 * desde el 08-jun, la diferencia contra el margen de $10 era de $982, y salió de
 * la app (`custom_no_de_compra: 106`). La alerta gritó y se confirmó de todos
 * modos. Por eso lo absurdo aquí NO es un aviso más: es un `bloqueo`.
 *
 * La comparación va SIEMPRE en unidad base (`rate / conversion_factor`) contra
 * la mediana histórica del propio item. En esa escala el error de UOM aparece
 * como lo que es: un factor de 20.
 */

/** Arriba de esto el renglón se marca, pero se puede confirmar. */
export const FACTOR_AVISO = 3;

/**
 * Arriba de esto no se deja confirmar. Un item no cambia de precio 10× de una
 * compra a otra; eso es un dedo, no el mercado.
 */
export const FACTOR_BLOQUEO = 10;

/**
 * 🔴 Compras mínimas para atreverse a BLOQUEAR. Una mediana necesita mayoría.
 *
 * CAPACILLO #74 tiene dos compras y una está podrida (`1 PZA` a $1,559.88, que
 * es una CAJA capturada como pieza): la mediana de dos es el promedio de los
 * dos, $780.03, cuando el capacillo vale $0.1729. Con ese "histórico" se
 * bloquearía la captura CORRECTA. Con menos de tres compras se avisa nomás.
 */
export const MUESTRAS_MINIMAS = 3;

export type NivelCosto = 'ok' | 'aviso' | 'bloqueo';

export interface RevisionCosto {
  nivel: NivelCosto;
  /** Cuántas veces se aleja del histórico, siempre ≥ 1. */
  factor: number;
  /** `true` si el capturado es MENOR que el histórico. */
  barato: boolean;
  historico: number;
  /** `false` cuando hay muy pocas compras para fiarse: avisa, no bloquea. */
  confiable: boolean;
}

/**
 * `null` cuando no hay nada que comparar — un item sin compras previas no es
 * sospechoso, es nuevo. Inventar una alerta ahí entrena a la gente a ignorarlas.
 */
export function revisarCostoUnitario(
  costoUnitario: unknown,
  costoHistorico: unknown,
  muestras: unknown = 0,
): RevisionCosto | null {
  const actual = Number(costoUnitario);
  const historico = Number(costoHistorico);
  if (!Number.isFinite(actual) || actual <= 0) return null;
  if (!Number.isFinite(historico) || historico <= 0) return null;

  const barato = actual < historico;
  const factor = barato ? historico / actual : actual / historico;

  const confiable = Number(muestras) >= MUESTRAS_MINIMAS;

  let nivel: NivelCosto = 'ok';
  if (factor >= FACTOR_BLOQUEO) nivel = confiable ? 'bloqueo' : 'aviso';
  else if (factor >= FACTOR_AVISO) nivel = 'aviso';

  return { nivel, factor, barato, historico, confiable };
}

/**
 * Costo por unidad base del renglón que se está capturando.
 *
 * `cantPres` es los kilos/piezas que trae la presentación. Sin presentación el
 * rate ya está en unidad base y se devuelve tal cual.
 */
export function costoPorUnidadBase(rate: unknown, cantPres: unknown): number {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  const factor = Number(cantPres);
  if (!Number.isFinite(factor) || factor <= 0) return r;
  return r / factor;
}
