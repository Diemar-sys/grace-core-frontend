// Ruta relativa: el nginx del frontend proxya /print → print-server del host (torre).
// Mismo origen → sin CORS, sin IP hardcodeada. En dev, vite.config proxya /print a localhost:6789.
const PRINT_SERVER = '/print';

export async function imprimirTicketTermico({ items, cliente, pagos, total, cambio = 0 }) {
  const res = await fetch(`${PRINT_SERVER}/imprimir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, cliente, pagos, total, cambio }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir');
  return data;
}

export async function imprimirCorteTermico({ rango_inicio, rango_fin, num_transacciones, por_forma_pago, por_departamento, total_ventas }) {
  const res = await fetch(`${PRINT_SERVER}/imprimir-corte`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rango_inicio, rango_fin, num_transacciones, por_forma_pago, por_departamento, total_ventas }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir corte');
  return data;
}

const _fmt2 = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Imprime un ticket térmico de Egreso (mismo flujo que compras).
 * @param {Object} egreso - Fila de la lista de egresos (campos del DocType Egreso).
 *   Para subcategoría GAS, `descripcion` es un JSON con el desglose (litros, aditivo, IVA…).
 * Intenta la térmica en :6789; si no responde, cae a window.print().
 */
export async function imprimirEgresoTicket(egreso) {
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
    console.warn('Térmica no disponible, fallback navegador:', err.message);
    const win = window.open('', '_blank', 'width=420,height=700');
    win.document.write(_htmlEgreso(payload, gas) + '<script>window.onload=function(){window.print();}</script>');
    win.document.close();
  }
}

function _htmlEgreso(p, gas) {
  const total = Number(p.monto || 0);
  const desglose = gas
    ? `
      <tr><td>GAS — ${_fmt2(gas.litros)} L × $${_fmt2(gas.precio)}</td><td class="r">$${_fmt2(gas.subtotal_gas)}</td></tr>
      ${Number(gas.aditivo_litros) > 0 ? `<tr><td>ADITIVO — ${_fmt2(gas.aditivo_litros)} L × $${_fmt2(gas.aditivo_precio)}</td><td class="r">$${_fmt2(gas.aditivo_subtotal)}</td></tr>` : ''}
      <tr><td>Subtotal</td><td class="r">$${_fmt2(gas.subtotal)}</td></tr>
      ${Number(gas.descuento) > 0 ? `<tr><td>Descuento</td><td class="r">-$${_fmt2(gas.descuento)}</td></tr>` : ''}
      <tr><td>Base gravable</td><td class="r">$${_fmt2(gas.base)}</td></tr>
      <tr><td>IVA 16%</td><td class="r">$${_fmt2(gas.iva)}</td></tr>`
    : `
      <tr><td>Base</td><td class="r">$${_fmt2(total - Number(p.monto_impuesto || 0))}</td></tr>
      ${Number(p.monto_impuesto) > 0 ? `<tr><td>${p.impuesto_tipo}</td><td class="r">$${_fmt2(p.monto_impuesto)}</td></tr>` : ''}`;

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
  <div>No. Egreso : ${p.no_egreso}</div>
  ${p.no_de_compra ? `<div>No. Compra : ${p.no_de_compra}</div>` : ''}
  <div>Fecha      : ${p.fecha}</div>
  <div>Categoria  : ${p.categoria}</div>
  ${p.subcategoria ? `<div>Subcat.    : ${p.subcategoria}</div>` : ''}
  ${p.concepto ? `<div>Concepto   : ${p.concepto}</div>` : ''}
  <div>Facturado  : ${p.facturado_a}</div>
  <div>Con factura: ${p.con_factura ? 'SI' : 'NO'}</div>
  <hr/>
  <table>${desglose}</table>
  <hr/>
  <table><tr class="tot"><td>TOTAL</td><td class="r">$${_fmt2(total)}</td></tr></table>
  <hr/>
  <div class="c">Generado ${p.fecha}<br/>www.panaderiasgrace.mx</div>
</body></html>`;
}
