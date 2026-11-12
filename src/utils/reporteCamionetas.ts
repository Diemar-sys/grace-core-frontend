// Reportes → Camionetas (Diemar 10-nov, su Excel). Los números de cada día vienen del
// servidor (`hoja_api.rentabilidad_camionetas`); aquí solo se suman y se exportan.
// 11-nov: la merma ya no la calcula el servidor (no es un 35 % parejo: 20 % del dulce, 100 %
// del blanco). Se escribe a mano: borrador en Dexie (`useBorradorLocal`) → «Guardar» la sube a
// `Merma Camioneta` → «Cerrar» la fija (reabre solo Luis/Administrator). El servidor ya la suma
// a gastos; aquí solo se sobrepone lo TECLEADO y aún no guardado.

export interface DiaCamioneta {
  fecha: string;
  enviado: number;
  /** MONTO: lo vendido (enviado − merma), la misma cuenta que la Liquidación */
  venta: number;
  /** a precio de venta; null = sin liquidar (no se capturó la merma) */
  merma: number | null;
  materia: number;
  panadero: number;
  camioneta: number;
  chofer: number;
  ayudante: number;
  /** la merma GUARDADA (pesos); null = nadie la ha guardado */
  merma_mano: number | null;
  merma_cerrada: boolean;
  /** con la merma guardada ya sumada (lo calcula el servidor) */
  gastos: number;
  diferencia: number;
  liquidado: boolean;
  /** lo vendido por categoría grande (PAN BLANCO, PAN DULCE…); Σ = venta (lo exige el verificador) */
  categorias: Record<string, number>;
}
export interface Camioneta { destino: string; dias: DiaCamioneta[] }
export interface ReporteCamionetas {
  desde: string; hasta: string; categorias: string[]; camionetas: Camioneta[];
  /** solo Administrator y luis.th: lo decide el servidor */
  puede_reabrir: boolean;
}

/** Un día con lo tecleado sobrepuesto: `pendiente` = difiere de lo guardado. */
export type FilaCamioneta = DiaCamioneta & { pendiente: boolean; invalida: boolean };

export const COLUMNAS = ['venta', 'materia', 'merma_mano', 'panadero', 'camioneta', 'chofer',
  'ayudante', 'gastos', 'diferencia'] as const;
export type Columna = typeof COLUMNAS[number];
export type Totales = Record<Columna, number>;

const cent = (n: number) => Math.round(n * 100);

/** Clave de la merma escrita: una por camioneta y día. */
export const claveMerma = (destino: string, fecha: string) => `${destino}|${fecha}`;

/** «12.5» → 12.5; vacío → null (= borrar la guardada); negativo o basura → undefined (inválida). */
export function leerMerma(texto: string | undefined): number | null | undefined {
  if (!texto?.trim()) return null;
  const n = Number(texto.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

/** Sobrepone lo tecleado a lo guardado: gastos/diferencia se ajustan por la DIFERENCIA, en
 *  centavos enteros. Cerrada o inválida → se queda lo del servidor. O(n). */
export function conMerma(destino: string, dias: DiaCamioneta[], escritas: Record<string, string>): FilaCamioneta[] {
  return dias.map((d) => {
    const texto = escritas[claveMerma(destino, d.fecha)];
    if (texto === undefined || d.merma_cerrada) return { ...d, pendiente: false, invalida: false };
    const m = leerMerma(texto);
    if (m === undefined) return { ...d, pendiente: false, invalida: true };
    if (m === d.merma_mano) return { ...d, pendiente: false, invalida: false };
    const delta = cent(m ?? 0) - cent(d.merma_mano ?? 0);
    return { ...d, merma_mano: m, pendiente: true, invalida: false,
      gastos: (cent(d.gastos) + delta) / 100, diferencia: (cent(d.diferencia) - delta) / 100 };
  });
}

/** Lo que «Guardar» manda: solo lo que difiere de lo guardado (monto null = borrar). O(n). */
export function mermasPorGuardar(filas: { destino: string; dias: FilaCamioneta[] }[]) {
  return filas.flatMap((c) => c.dias.filter((d) => d.pendiente)
    .map((d) => ({ fecha: d.fecha, destino: c.destino, monto: d.merma_mano })));
}

/** Σ por columna, en centavos enteros (sumar floats de pesos arrastra 0.000001). null = 0. O(n). */
export function totales(dias: FilaCamioneta[]): Totales {
  const c = Object.fromEntries(COLUMNAS.map((k) => [k, 0])) as Totales;
  for (const d of dias) for (const k of COLUMNAS) c[k] += cent(d[k] ?? 0);
  for (const k of COLUMNAS) c[k] /= 100;
  return c;
}

/** Σ por categoría en centavos enteros. O(n × categorías). */
export function totalesCategoria(dias: DiaCamioneta[], categorias: string[]): Record<string, number> {
  const c: Record<string, number> = Object.fromEntries(categorias.map((k) => [k, 0]));
  for (const d of dias) for (const k of categorias) c[k] += cent(d.categorias[k] ?? 0);
  for (const k of categorias) c[k] /= 100;
  return c;
}

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** «2026-09-01» → «01-SEP MARTES», como el Excel. Por partes, sin `new Date(iso)` (lo lee en UTC). */
export function fechaConDia(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}-${MESES[m - 1]} ${DIAS[new Date(a, m - 1, d).getDay()]}`;
}

const celda = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV para Excel: un renglón por camioneta y día, sin separador de miles. Merma en blanco si
 *  nadie la escribió. Al final, lo vendido por categoría. */
export function csvCamionetas(filas: { destino: string; dias: FilaCamioneta[] }[], categorias: string[]): string {
  const salida: (string | number | null)[][] = [['Camioneta', 'Fecha', 'Monto', '35%', 'Merma',
    'Panadero', 'Gasto camioneta', 'Chofer', 'Ayudante', 'Total gastos', 'Diferencia', 'Liquidado',
    ...categorias]];
  for (const c of filas) {
    for (const d of c.dias) {
      salida.push([c.destino, d.fecha, ...COLUMNAS.map((k) => d[k]), d.liquidado ? 'SI' : 'NO',
        ...categorias.map((k) => d.categorias[k] ?? 0)]);
    }
  }
  // BOM: sin él, Excel abre los acentos como «MIÃ‰RCOLES»
  return '﻿' + salida.map((r) => r.map(celda).join(',')).join('\r\n');
}
