import { TENANT } from '../../config/tenant';

/**
 * Datos de la empresa leídos desde tenant.js → variables de entorno (.env).
 * No modificar aquí — cambiar el archivo .env para actualizar a otro negocio.
 */
const EMPRESA = {
  nombre:    TENANT.nombre.split(' ')[0].toUpperCase(), // "GRACE" → primera palabra en mayúsculas
  subtitulo: TENANT.subtitulo,
  linea1:    TENANT.nombreFull,
  linea2:    TENANT.direccion,
  telefono:  TENANT.telefono,
  web:       TENANT.web,
};


const fmtVal = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

/**
 * Genera HTML del ticket de COMPRA en formato térmico compacto.
 * Solo muestra: No Compra, No Factura, Proveedor, Subtotal, IVA, IEPS, Total.
 * @param {Object} datos
 * @param {string} datos.noCompra - Número interno de compra (autogen).
 * @param {string} datos.noFactura - Folio factura del proveedor.
 * @param {string} datos.proveedor - Nombre del proveedor.
 * @param {string} datos.fecha - Fecha (YYYY-MM-DD).
 * @param {string} datos.hora - Hora.
 * @param {Object} datos.totales - {subtotal, iva, ieps, total}.
 * @param {number} [datos.ajuste=0] - Ajuste por redondeo.
 * @param {boolean} [datos.esBorrador=false] - Si es precompra.
 */
export function generarHTMLTicketCompra({ noCompra, noFactura, proveedor, fecha, hora, totales, ajuste = 0, esBorrador = false }) {
  const numStr = noCompra != null ? String(noCompra).padStart(4, '0') : '----';
  const titulo = esBorrador ? '** PRECOMPRA **' : '** TICKET DE COMPRA **';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket de Compra #${numStr}</title>
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
    .base-row { font-size: 10px; color: #777; }
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
  <div class="section-title">${titulo}</div>
  <div class="div-dash"></div>
  <div class="info-row"><span>NO. COMPRA:</span><span>#${numStr}</span></div>
  <div class="info-row"><span>NO. FACTURA:</span><span>${noFactura || '—'}</span></div>
  <div class="info-row"><span>PROVEEDOR:</span><span>${proveedor || '—'}</span></div>
  <div class="info-row"><span>FECHA:</span><span>${fecha || fmtFecha()}</span></div>
  <div class="info-row"><span>HORA:</span><span>${hora || fmtHora()}</span></div>
  <div class="div-eq"></div>
  ${(totales.subtotalIva16 || 0) > 0 ? `<div class="info-row base-row"><span>SUBTOTAL IVA 16%:</span><span>${fmtVal(totales.subtotalIva16)}</span></div>` : ''}
  ${(totales.subtotalIeps || 0) > 0 ? `<div class="info-row base-row"><span>SUBTOTAL IEPS 8%:</span><span>${fmtVal(totales.subtotalIeps)}</span></div>` : ''}
  ${(totales.subtotalTasa0 || 0) > 0 ? `<div class="info-row base-row"><span>SUBTOTAL IVA 0%:</span><span>${fmtVal(totales.subtotalTasa0)}</span></div>` : ''}
  <div class="info-row"><span>SUBTOTAL:</span><span>${fmtVal(totales.subtotal)}</span></div>
  ${totales.iva > 0 ? `<div class="info-row"><span>IVA 16%:</span><span>${fmtVal(totales.iva)}</span></div>` : ''}
  ${totales.ieps > 0 ? `<div class="info-row"><span>IEPS 8%:</span><span>${fmtVal(totales.ieps)}</span></div>` : ''}
  ${Math.abs(ajuste) > 10 ? `<div class="info-row"><span>AJUSTE:</span><span>${fmtVal(ajuste)}</span></div>` : ''}
  <div class="total-row">
    <span>TOTAL:</span>
    <span>${fmtVal(totales.total)}</span>
  </div>
  <div class="div-dash"></div>
  <div class="footer">
    Documento generado el ${fecha || fmtFecha()} a las ${hora || fmtHora()}<br/>
    ${EMPRESA.web}
  </div>
</body>
</html>`;
}
