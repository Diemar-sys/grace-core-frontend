export const DEPT_COLORS = {
  'PAN BLANCO':  '#f59e0b',
  'PAN DULCE':   '#f97316',
  'PANQUELERIA': '#ec4899',
  'REPOSTERIA':  '#8b5cf6',
  'PIZZERIA':    '#ef4444',
};

export const deptColor = (dept = '') => {
  const key = Object.keys(DEPT_COLORS).find(k => dept.toUpperCase().includes(k));
  return DEPT_COLORS[key] || '#7a3f0a';
};

export const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

export const horaActual = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export const fechaActual = () =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/** Traduce el nombre interno de ERPNext al label en español para mostrar en UI */
export const MODOS_PAGO_DISPLAY = {
  'Cash':          'Efectivo',
  'Bank Draft':    'Tarjeta',
  'Wire Transfer': 'Transferencia',
};

export const fmtModoPago = (modo = '') =>
  MODOS_PAGO_DISPLAY[modo] || modo;

/**
 * Calcula los totales de un cobro de POS. Función pura — sin estado ni efectos.
 * @param {Array<{qty:number, precio:number}>} ticket - Líneas del ticket.
 * @param {Object<string,string|number>} pagos - Montos por método de pago.
 * @returns {{total:number, totalQty:number, totalPagado:number,
 *            pendiente:number, cambio:number, importeOk:boolean}}
 */
export const calcularCobro = (ticket = [], pagos = {}) => {
  const total       = ticket.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.precio) || 0), 0);
  const totalQty    = ticket.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalPagado = Object.values(pagos).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const pendiente   = Math.max(0, total - totalPagado);
  const cambio      = Math.max(0, totalPagado - total);
  const importeOk   = pendiente === 0 && totalPagado > 0;
  return { total, totalQty, totalPagado, pendiente, cambio, importeOk };
};

