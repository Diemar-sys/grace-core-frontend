/**
 * Consolidado anual de TODO lo que sale de la caja.
 *
 * Dos fuentes, porque el gasto vive en dos lados:
 *   - `Purchase Receipt` confirmadas → compra de insumos (con IVA, es lo que se pagó).
 *   - `Egreso` → renta, gasolina, luz, impuestos, activo fijo, préstamos… y NÓMINA,
 *     que la genera la Corrida de Nómina al confirmarse. Por eso no hay que leer
 *     `Corrida de Nomina` aparte: se contaría dos veces la misma quincena.
 *
 * Criterio de fecha: la del HECHO, nunca la de captura. `posting_date` en la
 * compra (la que teclea quien recibe, no la de creación del documento) y `fecha`
 * en el egreso. La nómina hereda la fecha de pago de su corrida:
 * `corrida_de_nomina.py` la crea con `"fecha": self.fecha_pago`. Así una corrida
 * de julio capturada en agosto sigue pesando en julio.
 *
 * Lo que esto NO hace: repartir una corrida a caballo entre dos meses. Si la
 * semana va del 27-jul al 2-ago y se paga el 3-ago, el costo entero cae en
 * agosto. Partirlo exigiría prorratear por día trabajado.
 *
 * Todo cuenta como salida de dinero, incluidos Activo Fijo y Préstamo. No son
 * gasto contable (uno es inversión, el otro baja una deuda) pero el dinero sí
 * salió; van como categoría propia para que el desglose lo distinga sin que el
 * total mienta.
 */

export const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Categoría con la que entran las compras de insumos al consolidado. */
export const CAT_COMPRAS = 'COMPRAS (INSUMOS)';

export interface FilaCategoria {
  categoria: string;
  /** 12 posiciones, índice 0 = enero. */
  meses: number[];
  total: number;
}

export interface GastosAnuales {
  anio: number;
  categorias: FilaCategoria[];
  /** 12 posiciones con el total de cada mes. */
  totalesMes: number[];
  total: number;
}

const round2 = (n: number) => Math.round(Number((n * 100).toPrecision(12))) / 100;

/**
 * Mes (0-11) de una fecha de Frappe (`"2026-07-30"` o con hora).
 * Se parte la cadena en vez de usar `new Date`: `new Date('2026-07-30')` es UTC
 * y en México se corre al día 29, que en un cambio de mes cae en el mes anterior.
 */
export function mesDe(fecha?: string | null, anio?: number): number | null {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})/.exec(String(fecha));
  if (!m) return null;
  if (anio != null && Number(m[1]) !== anio) return null;
  const mes = Number(m[2]) - 1;
  return mes >= 0 && mes <= 11 ? mes : null;
}

const filaVacia = (categoria: string): FilaCategoria => ({
  categoria,
  meses: Array(12).fill(0),
  total: 0,
});

/**
 * Arma la matriz categoría × mes.
 *
 * `compras`: Purchase Receipt tal como las devuelve `getCompras`. Solo cuentan
 * las confirmadas (docstatus 1): un borrador no es dinero salido y una cancelada
 * ya no lo es.
 */
export function consolidarGastos(
  anio: number,
  compras: any[] = [],
  egresos: any[] = [],
): GastosAnuales {
  const porCategoria = new Map<string, FilaCategoria>();

  const sumar = (categoria: string, mes: number, monto: number) => {
    if (!(monto > 0)) return;
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, filaVacia(categoria));
    const fila = porCategoria.get(categoria)!;
    fila.meses[mes] = round2(fila.meses[mes] + monto);
  };

  for (const c of compras) {
    if (Number(c.docstatus) !== 1) continue;
    const mes = mesDe(c.posting_date, anio);
    if (mes == null) continue;
    sumar(CAT_COMPRAS, mes, parseFloat(c.grand_total) || 0);
  }

  for (const e of egresos) {
    const mes = mesDe(e.fecha, anio);
    if (mes == null) continue;
    sumar((e.categoria || 'SIN CATEGORÍA').toUpperCase(), mes, parseFloat(e.monto) || 0);
  }

  // Compras primero (suele ser la mayor), el resto por peso descendente: la
  // tabla se lee de arriba abajo en orden de importancia.
  const categorias = [...porCategoria.values()]
    .map(f => ({ ...f, total: round2(f.meses.reduce((s, n) => s + n, 0)) }))
    .sort((a, b) =>
      a.categoria === CAT_COMPRAS ? -1
      : b.categoria === CAT_COMPRAS ? 1
      : b.total - a.total);

  const totalesMes = Array.from({ length: 12 }, (_, m) =>
    round2(categorias.reduce((s, f) => s + f.meses[m], 0)));

  return {
    anio,
    categorias,
    totalesMes,
    total: round2(totalesMes.reduce((s, n) => s + n, 0)),
  };
}

/** Meses con movimiento. Sirve para no pintar 12 columnas cuando solo hay 3. */
export const mesesConDatos = (g: GastosAnuales): number[] =>
  g.totalesMes.map((t, m) => (t > 0 ? m : -1)).filter(m => m >= 0);

// ── Color ───────────────────────────────────────────────────────────────────
// Paleta categórica validada para daltonismo y contraste (ver skill dataviz).
// El ORDEN es el mecanismo de seguridad, no decoración: se asignan en secuencia,
// nunca se recicla un tono.
const PALETA = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
];

/**
 * Orden fijo de categorías conocidas. Existe para que el color siga a la
 * CATEGORÍA y no a su lugar en la tabla: si un mes la renta pesa más que la
 * nómina, la tabla se reordena pero los colores NO se mueven. Un color que
 * cambia de dueño entre dos consultas hace desconfiar del reporte entero.
 */
export const ORDEN_CATEGORIAS = [
  CAT_COMPRAS,
  'NÓMINA',
  'GASTO',
  'RENTA',
  'IMPUESTO',
  'ACTIVO FIJO',
  'PRÉSTAMO',
];

/**
 * Mapa categoría → color, estable. Las categorías desconocidas se acomodan
 * alfabéticamente después de las conocidas (no por peso, misma razón), y si se
 * acaban los tonos se repiten en vez de inventar colores nuevos: un tono
 * generado no está validado y puede volverse indistinguible.
 */
export function asignarColores(categorias: string[]): Record<string, string> {
  const conocidas = ORDEN_CATEGORIAS.filter(c => categorias.includes(c));
  const resto = categorias.filter(c => !ORDEN_CATEGORIAS.includes(c)).sort();
  const mapa: Record<string, string> = {};
  [...conocidas, ...resto].forEach((cat, i) => { mapa[cat] = PALETA[i % PALETA.length]; });
  return mapa;
}
