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

/** Separador entre familia y subcategoría en la etiqueta de una fila. */
const SEP = ' · ';

/**
 * Bloque fiscal. El contador necesita leer aparte lo que tiene CFDI de lo que no:
 * una talacha o una refacción de la calle se registra igual (el dinero salió),
 * pero no es deducible y no puede sumarse con lo facturado en el mismo renglón.
 * CON FACTURA va primero: es el bloque que se declara.
 */
export const CON_FACTURA = 'CON FACTURA';
export const SIN_FACTURA = 'SIN FACTURA';
export const BLOQUES = [CON_FACTURA, SIN_FACTURA];

/**
 * ¿Este documento respalda con CFDI?
 *
 * Dos fuentes con campos distintos, un solo criterio:
 *   - `Egreso` trae `con_factura`, que el formulario deriva de `facturado_a`.
 *   - `Purchase Receipt` no lo tiene: vale como facturado si el comprobante ES
 *     una factura, o si es una nota **consolidada** con folio — esa nota terminó
 *     dentro de un CFDI aunque ella misma no lo sea (ver `agruparFacturas`).
 * El nombre en `facturado_a` es el último recurso, para documentos viejos.
 */
export function conFactura(doc: any): boolean {
  if (doc?.con_factura != null && doc.con_factura !== '') return Number(doc.con_factura) === 1;
  if (doc?.custom_tipo_comprobante === 'Factura') return true;
  if (doc?.custom_consolidado && doc?.supplier_delivery_note) return true;
  const a = String(doc?.custom_facturado_a ?? doc?.facturado_a ?? SIN_FACTURA).toUpperCase();
  return a !== SIN_FACTURA && a !== '';
}

/** Bloque fiscal de un documento, como etiqueta de fila. */
export const bloqueDe = (doc: any): string => (conFactura(doc) ? CON_FACTURA : SIN_FACTURA);

/**
 * Etiqueta de la fila del reporte.
 *
 * `Gasto` en el Egreso es un cajón: mete agua, gas, gasolina, mantenimiento y
 * papelería en el mismo renglón, y `Impuesto` hace lo mismo con IMSS e ISR. Lo
 * que el gerente necesita leer es la subcategoría; la familia se conserva como
 * prefijo para no perder de dónde viene ni de qué se suma con qué.
 */
export function etiquetaEgreso(egreso: any): string {
  const familia = String(egreso?.categoria || 'SIN CATEGORÍA').toUpperCase();
  const sub = String(egreso?.subcategoria || '').toUpperCase();
  return sub && sub !== familia ? familia + SEP + sub : familia;
}

/** Familia de una etiqueta. Es la unidad de color y la que apila la gráfica. */
export const familiaDe = (etiqueta: string): string => etiqueta.split(SEP)[0];

export interface FilaCategoria {
  categoria: string;
  /** Familia a la que pertenece; para las compras, ella misma. */
  familia: string;
  /** `CON FACTURA` | `SIN FACTURA`. Vacío en las filas ya agregadas. */
  fiscal: string;
  /** 12 posiciones, índice 0 = enero. */
  meses: number[];
  total: number;
}

export interface GastosAnuales {
  anio: number;
  /** Filas de detalle: una por subcategoría. */
  categorias: FilaCategoria[];
  /**
   * Las mismas cifras agregadas por familia. La gráfica apila por aquí: una
   * veintena de series repartidas en siete colores no se puede leer.
   */
  familias: FilaCategoria[];
  /**
   * Las mismas cifras agregadas por bloque fiscal, en orden `BLOQUES`. Es lo
   * que la tabla muestra plegado: dos renglones en vez de veinte.
   */
  bloques: FilaCategoria[];
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

const filaVacia = (categoria: string, fiscal = ''): FilaCategoria => ({
  categoria,
  familia: familiaDe(categoria),
  fiscal,
  meses: Array(12).fill(0),
  total: 0,
});

/** Suma filas en otra dimensión (detalle → familia) reusando la misma forma. */
function agrupar(filas: FilaCategoria[], clave: (f: FilaCategoria) => string): FilaCategoria[] {
  const mapa = new Map<string, FilaCategoria>();
  for (const f of filas) {
    const k = clave(f);
    if (!mapa.has(k)) mapa.set(k, filaVacia(k));
    const acc = mapa.get(k)!;
    f.meses.forEach((v, m) => { acc.meses[m] = round2(acc.meses[m] + v); });
    acc.total = round2(acc.total + f.total);
  }
  return [...mapa.values()];
}

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

  // La fila se identifica por bloque fiscal + categoría, no solo por categoría:
  // la misma gasolina puede venir facturada una vez y de la calle la siguiente,
  // y el contador necesita esos dos pesos en renglones distintos.
  const sumar = (categoria: string, fiscal: string, mes: number, monto: number) => {
    if (!(monto > 0)) return;
    const clave = fiscal + '|' + categoria;
    if (!porCategoria.has(clave)) porCategoria.set(clave, filaVacia(categoria, fiscal));
    const fila = porCategoria.get(clave)!;
    fila.meses[mes] = round2(fila.meses[mes] + monto);
  };

  for (const c of compras) {
    if (Number(c.docstatus) !== 1) continue;
    const mes = mesDe(c.posting_date, anio);
    if (mes == null) continue;
    sumar(CAT_COMPRAS, bloqueDe(c), mes, parseFloat(c.grand_total) || 0);
  }

  for (const e of egresos) {
    const mes = mesDe(e.fecha, anio);
    if (mes == null) continue;
    sumar(etiquetaEgreso(e), bloqueDe(e), mes, parseFloat(e.monto) || 0);
  }

  const filas = [...porCategoria.values()]
    .map(f => ({ ...f, total: round2(f.meses.reduce((s, n) => s + n, 0)) }));

  // Compras primero (suele ser la mayor), el resto por peso descendente: la
  // tabla se lee de arriba abajo en orden de importancia.
  const porPeso = (a: FilaCategoria, b: FilaCategoria) =>
    a.categoria === CAT_COMPRAS ? -1
    : b.categoria === CAT_COMPRAS ? 1
    : b.total - a.total;

  const familias = agrupar(filas, f => f.familia).sort(porPeso);

  // Bloques fiscales en orden fijo (CON FACTURA primero), no por peso: el
  // contador siempre busca lo deducible en el mismo lugar. Solo los que existen.
  const porBloque = agrupar(filas, f => f.fiscal).map(f => ({ ...f, fiscal: f.categoria }));
  const bloques = BLOQUES
    .map(b => porBloque.find(f => f.categoria === b))
    .filter(Boolean) as FilaCategoria[];

  // Las filas de detalle se ordenan por bloque fiscal primero y luego por el peso
  // de SU FAMILIA: así las subcategorías de un mismo cajón quedan juntas en vez
  // de desperdigarse entre familias ajenas, que es lo que hace ilegible la tabla.
  const pesoFamilia = new Map(familias.map(f => [f.categoria, f.total]));
  const categorias = filas.sort((a, b) =>
    a.fiscal !== b.fiscal
      ? BLOQUES.indexOf(a.fiscal) - BLOQUES.indexOf(b.fiscal)
    : a.familia === b.familia
      ? porPeso(a, b)
      : porPeso(
          { ...a, categoria: a.familia, total: pesoFamilia.get(a.familia) ?? 0 },
          { ...b, categoria: b.familia, total: pesoFamilia.get(b.familia) ?? 0 },
        ));

  const totalesMes = Array.from({ length: 12 }, (_, m) =>
    round2(familias.reduce((s, f) => s + f.meses[m], 0)));

  return {
    anio,
    categorias,
    familias,
    bloques,
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
 * Mapa familia → color, estable. El color pertenece a la familia, no a la
 * subcategoría: las siete familias caben en la paleta y las filas de detalle
 * heredan el tono de su cajón. Las desconocidas se acomodan
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
