export const DEPT_COLORS: Record<string, string> = {
  'PAN BLANCO':  '#f59e0b',
  'PAN DULCE':   '#f97316',
  'PANQUELERIA': '#ec4899',
  'REPOSTERIA':  '#8b5cf6',
  'PIZZERIA':    '#ef4444',
};

export const deptColor = (dept = ''): string => {
  const key = Object.keys(DEPT_COLORS).find((k) => dept.toUpperCase().includes(k));
  return key ? DEPT_COLORS[key] : '#7a3f0a';
};

export const fmt = (n: number | string | null | undefined): string =>
  `$${parseFloat(String(n || 0)).toFixed(2)}`;

export const horaActual = (): string =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export const fechaActual = (): string =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/** Traduce el nombre interno de ERPNext al label en español para mostrar en UI */
export const MODOS_PAGO_DISPLAY: Record<string, string> = {
  'Cash':          'Efectivo',
  'Bank Draft':    'Tarjeta',
  'Wire Transfer': 'Transferencia',
};

export const fmtModoPago = (modo = ''): string =>
  MODOS_PAGO_DISPLAY[modo] || modo;

interface TicketLinea { qty: number | string; precio: number | string; }
type Pagos = Record<string, string | number>;
interface Cobro {
  total: number; totalQty: number; totalPagado: number;
  pendiente: number; cambio: number; importeOk: boolean;
}

/** Calcula los totales de un cobro de POS. Función pura — sin estado ni efectos. */
export const calcularCobro = (ticket: TicketLinea[] = [], pagos: Pagos = {}): Cobro => {
  const total       = ticket.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.precio) || 0), 0);
  const totalQty    = ticket.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalPagado = Object.values(pagos).reduce<number>((s, v) => s + (parseFloat(String(v)) || 0), 0);
  const pendiente   = Math.max(0, total - totalPagado);
  const cambio      = Math.max(0, totalPagado - total);
  const importeOk   = pendiente === 0 && totalPagado > 0;
  return { total, totalQty, totalPagado, pendiente, cambio, importeOk };
};
