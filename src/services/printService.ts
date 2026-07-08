// Ruta relativa: el nginx del frontend proxya /print → print-server del host (torre).
// Mismo origen → sin CORS, sin IP hardcodeada. En dev, vite.config proxya /print a localhost:6789.
import { escHTML } from '../utils/print/escHTML';

const PRINT_SERVER = '/print';

// Payloads de impresión = frontera de serialización al print-server. Los shapes
// (items, pagos, desgloses) varían por flujo → tipos laxos a propósito; el print
// server valida su propio contrato. Ponytail: tipar cada campo aquí es low-value.
interface TicketData { items: any[]; cliente: any; pagos: any; total: number; cambio?: number; }
interface CorteData {
  rango_inicio: any; rango_fin: any; num_transacciones: any;
  por_forma_pago: any; por_departamento: any; total_ventas: any;
}
type EgresoRow = Record<string, any>;

export async function imprimirTicketTermico({ items, cliente, pagos, total, cambio = 0 }: TicketData) {
  const res = await fetch(`${PRINT_SERVER}/imprimir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, cliente, pagos, total, cambio }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir');
  return data;
}

export async function imprimirCorteTermico({ rango_inicio, rango_fin, num_transacciones, por_forma_pago, por_departamento, total_ventas }: CorteData) {
  const res = await fetch(`${PRINT_SERVER}/imprimir-corte`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rango_inicio, rango_fin, num_transacciones, por_forma_pago, por_departamento, total_ventas }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir corte');
  return data;
}

interface TraspasoData {
  sucursalLabel?: string; warehouseDestino?: string; docName?: string;
  fecha?: string; hora?: string; origen?: string; filas: any[];
}

/** Ticket térmico de traspaso a sucursal (misma impresora SICAR que ventas). */
export async function imprimirTraspasoTermico({ sucursalLabel, warehouseDestino, docName, fecha, hora, origen, filas }: TraspasoData) {
  const items = (filas || []).map(f => ({
    item_name: f.item_name || f.item_code || '',
    qty: f.qty,
    uom: f.uom || '',
    cantidad_por_presentacion: f.cantidad_por_presentacion,
    presentacion: f.presentacion || '',
  }));
  const res = await fetch(`${PRINT_SERVER}/imprimir-traspaso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sucursal: sucursalLabel, warehouse_destino: warehouseDestino,
      no_envio: docName, fecha, hora, origen, items,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir traspaso');
  return data;
}

interface VentaB2BData {
  noVenta?: any; cliente?: string; fecha?: string; hora?: string;
  filas: any[]; totales?: any; ajuste?: number; esBorrador?: boolean;
}

/** Ticket térmico de venta B2B (mismo formato que el PDF de ventas, en chico). */
export async function imprimirVentaB2BTermico({ noVenta, cliente, fecha, hora, filas, totales, ajuste = 0, esBorrador = false }: VentaB2BData) {
  const items = (filas || []).map(f => ({
    item_name: f.item_name || f.item_code || '',
    qty: f.qty, uom: f.uom || '', rate: f.rate,
    impuesto_rate: f.impuesto_rate || 0,
    impuesto_label: f.impuesto_label || '',
    cantidad_por_presentacion: f.cantidad_por_presentacion,
    presentacion: f.presentacion || '',
  }));
  const t = totales || {};
  const res = await fetch(`${PRINT_SERVER}/imprimir-venta-b2b`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      no_venta: noVenta, cliente, fecha, hora, items,
      subtotal: t.subtotal || 0,
      subtotal_iva16: t.subtotalIva16 || 0,
      subtotal_ieps: t.subtotalIeps || 0,
      subtotal_tasa0: t.subtotalTasa0 || 0,
      iva: t.iva || 0, ieps: t.ieps || 0,
      ajuste, total: t.total || 0,
      es_borrador: esBorrador ? 1 : 0,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir venta B2B');
  return data;
}

const _fmt2 = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Imprime un ticket térmico de Egreso (mismo flujo que compras).
 * @param {Object} egreso - Fila de la lista de egresos (campos del DocType Egreso).
 *   Para subcategoría GAS, `descripcion` es un JSON con el desglose (litros, aditivo, IVA…).
 * Intenta la térmica en :6789; si no responde, cae a window.print().
 */
export async function imprimirEgresoTicket(egreso: EgresoRow) {
  let gas = null;
  if ((egreso.subcategoria || '').toUpperCase() === 'GAS' && egreso.descripcion) {
    try {
      const d = JSON.parse(egreso.descripcion);
      gas = {
        litros: d.gas_litros, precio: d.gas_precio, subtotal_gas: d.gas_subtotal,
        aditivo_litros: d.aditivo_litros, aditivo_precio: d.aditivo_precio, aditivo_subtotal: d.aditivo_subtotal,
        subtotal: d.subtotal, descuento: d.descuento, base: d.base_gravable, iva: d.iva,
      };
    } catch { /* descripcion no es JSON (egreso no-gas con texto libre) */ }
  }

  const payload = {
    no_egreso: egreso.name || '',
    no_de_compra: egreso.no_de_compra || null,
    fecha: egreso.fecha || '',
    categoria: egreso.categoria || '',
    subcategoria: egreso.subcategoria || '',
    concepto: egreso.concepto || '',
    facturado_a: egreso.facturado_a || '',
    con_factura: egreso.con_factura ? 1 : 0,
    no_factura: egreso.no_factura || '',
    monto: egreso.monto || 0,
    impuesto_tipo: egreso.impuesto_tipo || '',
    monto_impuesto: egreso.monto_impuesto || 0,
    gas,
  };

  try {
    const res = await fetch(`${PRINT_SERVER}/imprimir-egreso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Print server respondió ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error térmica');
    return;
  } catch (err) {
    console.warn('Térmica no disponible, fallback navegador:', (err as Error).message);
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return; // popup bloqueado → no hay dónde imprimir
    win.document.write(_htmlEgreso(payload, gas) + '<script>window.onload=function(){window.print();}</script>');
    win.document.close();
  }
}

function _htmlEgreso(p: Record<string, any>, gas: Record<string, any> | null) {
  const total = Number(p.monto || 0);
  const desglose = gas
    ? `
      <tr><td>GAS — ${_fmt2(gas.litros)} L × $${_fmt2(gas.precio)}</td><td class="r">$${_fmt2(gas.subtotal_gas)}</td></tr>
      ${Number(gas.aditivo_litros) > 0 ? `<tr><td>ADITIVO — ${_fmt2(gas.aditivo_litros)} L × $${_fmt2(gas.aditivo_precio)}</td><td class="r">$${_fmt2(gas.aditivo_subtotal)}</td></tr>` : ''}
      <tr><td>Subtotal</td><td class="r">$${_fmt2(gas.subtotal)}</td></tr>
      ${Number(gas.descuento) > 0 ? `<tr><td>Descuento</td><td class="r">-$${_fmt2(gas.descuento)}</td></tr>` : ''}
      <tr><td>Base gravable</td><td class="r">$${_fmt2(gas.base)}</td></tr>
      <tr><td>IVA 16%</td><td class="r">$${_fmt2(gas.iva)}</td></tr>`
    : (() => {
        const imp  = Number(p.monto_impuesto || 0);
        const base = total - imp;
        const tasa = p.impuesto_tipo === 'IVA' ? 'IVA 16%'
                   : p.impuesto_tipo === 'IEPS' ? 'IEPS 8%' : 'IVA 0%';
        return `
      <tr><td>SUBTOTAL ${tasa}</td><td class="r">$${_fmt2(base)}</td></tr>
      <tr><td>SUBTOTAL</td><td class="r">$${_fmt2(base)}</td></tr>
      ${imp > 0 ? `<tr><td>${tasa}</td><td class="r">$${_fmt2(imp)}</td></tr>` : ''}`;
      })();

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Egreso ${p.no_egreso}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;color:#000;width:280px;padding:12px}
  .c{text-align:center}.r{text-align:right}.b{font-weight:bold}
  h1{font-size:20px;letter-spacing:1px}
  hr{border:none;border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}
  .tot{font-size:16px;font-weight:bold;border-top:1px solid #000;padding-top:4px}
</style></head><body>
  <div class="c"><h1 class="b">GRACE</h1>Panaderia &amp; Reposteria</div>
  <hr/><div class="c b">** COMPROBANTE DE EGRESO **</div><hr/>
  ${p.no_de_compra
    ? `<div class="c b" style="font-size:15px">COMPRA #${p.no_de_compra}</div><div>NO. EGRESO : ${p.no_egreso}</div>`
    : `<div>NO. EGRESO : ${p.no_egreso}</div>`}
  ${p.no_factura ? `<div>NO. FACTURA: ${escHTML(p.no_factura)}</div>` : ''}
  <div>Fecha      : ${p.fecha}</div>
  <div>Categoria  : ${p.categoria}</div>
  ${p.subcategoria ? `<div>Subcat.    : ${escHTML(p.subcategoria)}</div>` : ''}
  ${p.concepto ? `<div>Concepto   : ${escHTML(p.concepto)}</div>` : ''}
  <div>Facturado  : ${escHTML(p.facturado_a)}</div>
  <div>Con factura: ${p.con_factura ? 'SI' : 'NO'}</div>
  <hr/>
  <table>${desglose}</table>
  <hr/>
  <table><tr class="tot"><td>TOTAL</td><td class="r">$${_fmt2(total)}</td></tr></table>
  <hr/>
  <div class="c">Generado ${p.fecha}<br/>www.panaderiasgrace.mx</div>
</body></html>`;
}
