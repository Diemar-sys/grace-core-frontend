/**
 * Kilos (o litros, o piezas) COMPRADOS por insumo y mes, para el contador.
 * Lo suma la base (`reportes_api.kilos_comprados_mensual`); aquí solo se
 * filtra por cuenta fiscal y se acomoda en categoría → insumo. Una pasada con
 * Map: O(n) sobre los renglones que manda el servidor.
 *
 * 🔴 Las unidades no se mezclan: la categoría suma por unidad (Kg con Kg, L con
 * L). Los gramos ya llegan convertidos a Kg desde el servidor.
 */
import { MESES } from './gastosAnuales';

export type Cuenta = 'todas' | 'luis' | 'alma' | 'sinFactura';

export const CUENTAS: { key: Cuenta; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'luis', label: 'Luis Torres' },
  { key: 'alma', label: 'Alma Rodriguez' },
  { key: 'sinFactura', label: 'Sin factura' },
];

export interface FilaKilos {
  mes: string;            // 'AAAA-MM'
  cuenta: Exclude<Cuenta, 'todas'>;
  item_code: string;
  item_name: string;
  item_group: string;
  uom: string;
  cantidad: number;
}

export interface InsumoKilos {
  item_code: string;
  item_name: string;
  uom: string;
  meses: number[];        // 12
  total: number;
}

export interface CategoriaKilos {
  categoria: string;
  /** Por unidad: { Kg: [12 meses], L: [...] }. */
  totales: Record<string, number[]>;
  items: InsumoKilos[];
}

const doce = () => Array(12).fill(0) as number[];

export function armarKilos(filas: FilaKilos[], cuenta: Cuenta): CategoriaKilos[] {
  const categorias = new Map<string, CategoriaKilos>();
  const insumos = new Map<string, InsumoKilos>();
  for (const f of filas) {
    if (cuenta !== 'todas' && f.cuenta !== cuenta) continue;
    const m = Number(f.mes.slice(5, 7)) - 1;
    if (!(m >= 0 && m < 12)) continue;
    const cant = Number(f.cantidad) || 0;
    let cat = categorias.get(f.item_group);
    if (!cat) { cat = { categoria: f.item_group, totales: {}, items: [] }; categorias.set(f.item_group, cat); }
    const clave = `${f.item_code}\u0000${f.uom}`;
    let ins = insumos.get(clave);
    if (!ins) {
      ins = { item_code: f.item_code, item_name: f.item_name, uom: f.uom, meses: doce(), total: 0 };
      insumos.set(clave, ins);
      cat.items.push(ins);
    }
    ins.meses[m] += cant;
    ins.total += cant;
    (cat.totales[f.uom] ??= doce())[m] += cant;
  }
  const lista = [...categorias.values()];
  for (const c of lista) c.items.sort((a, b) => a.item_name.localeCompare(b.item_name, 'es'));
  return lista.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
}

const celdaCsv = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV para Excel: un renglón por insumo. Números sin separador de miles. */
export function csvKilos(categorias: CategoriaKilos[]): string {
  const redondo = (n: number) => (Math.round(n * 1000) / 1000).toString();
  const filas = [['Categoría', 'Insumo', 'Clave', 'Unidad', ...MESES, 'Total']];
  for (const c of categorias) {
    for (const i of c.items) {
      filas.push([c.categoria, i.item_name, i.item_code, i.uom, ...i.meses.map(redondo), redondo(i.total)]);
    }
  }
  // BOM: sin él, Excel abre los acentos como «CategorÃ­a».
  return '﻿' + filas.map(r => r.map(celdaCsv).join(',')).join('\r\n');
}
