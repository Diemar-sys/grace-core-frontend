/**
 * Datos de la empresa — modificar aquí para reflejarse en todos los tickets.
 * @type {{ nombre: string, subtitulo: string, linea1: string, linea2: string, telefono: string, web: string }}
 */
const EMPRESA = {
  nombre:    'GRACE',
  subtitulo: 'Panadería & Repostería',
  linea1:    'PANADERÍAS GRACE',
  linea2:    'AV. SANTUARIO DEL MILAGRO',
  telefono:  '4425991147',
  web:       'www.panaderiasgrace.mx',
};

const fmtVal = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

const fmtFecha = () =>
  new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

const fmtHora = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

/**
 * Genera el HTML completo del ticket de venta individual.
 * @param {Array}  items     - Artículos [{item_name, qty, precio}]
 * @param {string} cliente   - Nombre del cliente
 * @param {Array}  pagos     - [{metodo: string, monto: number}]
 * @param {number} total     - Total de la venta
 * @param {number} [cambio]  - Cambio entregado (solo si hay efectivo)
 * @returns {string} HTML completo listo para imprimir
 */
export function generarHTMLTicket(items, cliente, pagos = [], total, cambio = 0) {
  const filasItems = items
    .map(i => {
      const subtotal = i.qty * i.precio;
      return `
      <tr>
        <td style="padding:3px 4px;font-size:11px;border-bottom:1px dashed #e5e5e5">
          ${i.item_name}<br/>
          <span style="color:#888;font-size:10px">${i.qty} × ${fmtVal(i.precio)}</span>
        </td>
        <td style="padding:3px 4px;font-size:11px;text-align:right;border-bottom:1px dashed #e5e5e5;white-space:nowrap">
          ${fmtVal(subtotal)}
        </td>
      </tr>`;
    })
    .join('');

  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  // Filas de pago — una por método usado
  const filasPago = pagos
    .filter(p => p.monto > 0)
    .map(p => `
      <div class="info-row">
        <span>${p.metodo.toUpperCase()}:</span>
        <span>${fmtVal(p.monto)}</span>
      </div>`)
    .join('');

  const filaCambio = cambio > 0
    ? `<div class="info-row"><span>CAMBIO:</span><span>${fmtVal(cambio)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket de Venta</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111;
           max-width: 380px; margin: 0 auto; padding: 24px 16px; }
    .center { text-align: center; }
    .empresa { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
    .subtitulo { font-size: 11px; color: #555; margin-top: 2px; }
    .dir { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.5; }
    .div-eq   { border-top: 2px solid #111; margin: 10px 0; }
    .div-dash { border-top: 1px dashed #aaa; margin: 8px 0; }
    .section-title { text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1px; }
    .info-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #333;
         padding: 3px 4px; text-align: left; }
    .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #111;
                 padding-top: 6px; margin-top: 4px; display: flex;
                 justify-content: space-between; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #888; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="empresa">${EMPRESA.nombre}</div>
    <div class="subtitulo">${EMPRESA.subtitulo}</div>
    <div class="dir">
      ${EMPRESA.linea1}<br/>
      ${EMPRESA.linea2}<br/>
      TEL. ${EMPRESA.telefono}
    </div>
  </div>
  <div class="div-eq"></div>
  <div class="info-row"><span>FECHA:</span><span>${fmtFecha()}</span></div>
  <div class="info-row"><span>HORA:</span><span>${fmtHora()}</span></div>
  <div class="info-row"><span>CLIENTE:</span><span>${cliente || 'Público en General'}</span></div>
  <div class="div-eq"></div>
  <div class="section-title">** TICKET DE VENTA **</div>
  <div class="div-dash"></div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:right">Importe</th>
      </tr>
    </thead>
    <tbody>${filasItems}</tbody>
  </table>
  <div class="div-dash"></div>
  <div class="info-row" style="font-size:11px">
    <span>ARTÍCULOS:</span><span>${totalQty}</span>
  </div>
  <div class="div-eq"></div>
  <div class="total-row">
    <span>TOTAL:</span>
    <span>${fmtVal(total)}</span>
  </div>
  <div class="div-eq"></div>
  ${filasPago}
  ${filaCambio}
  <div class="div-dash"></div>
  <div class="footer">
    GRACIAS POR SU COMPRA<br/>
    ${EMPRESA.web}
  </div>
</body>
</html>`;
}
