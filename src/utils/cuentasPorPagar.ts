// Agrupaciones del reporte de Cuentas por Pagar (salen de pages/ReporteCuentasPorPagar.jsx el 07-oct,
// sin cambios de lógica).
type Fila = Record<string, any>;

export const FACTURADOS = ['ALMA RODRIGUEZ', 'LUIS TORRES', 'SIN FACTURA'];

// Saldo pendiente por facturado_a — siempre los 3 buckets (aunque vengan en 0).
export function pendientePorFacturado(rows: Fila[] | null | undefined): Record<string, number> {
  const acc: Record<string, number> = Object.fromEntries(FACTURADOS.map(f => [f, 0]));
  for (const r of rows || []) {
    const k = FACTURADOS.includes(r.facturado_a) ? r.facturado_a : 'SIN FACTURA';
    acc[k] += parseFloat(r.pendiente) || 0;
  }
  return acc;
}

// Vistas: el backend manda un renglón por (proveedor, facturado_a, tipo).
export const VISTAS = [
  { key: 'general', label: 'General' },
  { key: 'Compra',  label: 'Compras' },
  { key: 'Egreso',  label: 'Egresos' },
];

// Renglones (o documentos del desglose) de la vista elegida. General = todo.
export function deVista(rows: Fila[] | null | undefined, vista: string): Fila[] {
  const todos = rows || [];
  return vista === 'general' ? todos : todos.filter(r => r.tipo === vista);
}

// Filas por proveedor para la tabla. Siempre agrupa por proveedor: un mismo
// proveedor trae un renglón por tipo (compras y egresos) y por facturado_a.
export function filasCxP(rows: Fila[] | null | undefined, facturadoFiltro: string) {
  let filas = rows || [];
  if (facturadoFiltro !== 'todas') filas = filas.filter(r => r.facturado_a === facturadoFiltro);
  const map = new Map<string, { proveedor: string; n: number; total: number; pagado: number; pendiente: number }>();
  for (const r of filas) {
    const cur = map.get(r.proveedor) || { proveedor: r.proveedor, n: 0, total: 0, pagado: 0, pendiente: 0 };
    cur.n        += r.n || 0;
    cur.total    += parseFloat(r.total) || 0;
    cur.pagado   += parseFloat(r.pagado) || 0;
    cur.pendiente += parseFloat(r.pendiente) || 0;
    map.set(r.proveedor, cur);
  }
  return [...map.values()].sort((a, b) => b.pendiente - a.pendiente);
}

// Deuda total, partida en lo que viene de compras y lo que viene de egresos.
// Cada parte se suma por su tipo, no por resta: un renglón sin tipo no se cuela.
export function deudaTotal(rows: Fila[] | null | undefined) {
  const d = { total: 0, compras: 0, egresos: 0 };
  for (const r of rows || []) {
    const p = parseFloat(r.pendiente) || 0;
    d.total += p;
    if (r.tipo === 'Compra') d.compras += p;
    else if (r.tipo === 'Egreso') d.egresos += p;
  }
  return d;
}

// Qué se pide al desplegar un renglón: en "Todas" el renglón junta los tres
// facturados, así que su desglose va sin filtro; filtrado, solo el de ese facturado.
// La clave del caché lleva el filtro: el mismo proveedor debe distinto por facturado.
export function consultaPendientes(proveedor: string, facturado: string) {
  const facturado_a = facturado === 'todas' ? '' : facturado;
  return { proveedor, facturado_a, clave: `${proveedor}|${facturado_a}` };
}

// El desglose se pide completo (compras y egresos) y se filtra al pintar: cambiar
// de vista no vuelve a pedir. 'cargando' y {error} pasan tal cual.
export function docsDeVista<T>(docs: Fila[] | T, vista: string): Fila[] | T {
  return Array.isArray(docs) ? deVista(docs, vista) : docs;
}
