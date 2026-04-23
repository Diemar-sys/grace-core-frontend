const fmtVal = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

const FORMA_PAGO_LABEL = {
  'Bank Draft':    'Tarjeta',
  'Wire Transfer': 'Transferencia',
  'Cash':          'Efectivo',
};
const fmtFormaPago = (fp) =>
  (FORMA_PAGO_LABEL[fp] || fp).toUpperCase();

const fmtFecha = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

/**
 * Genera el HTML completo del ticket de corte de caja.
 * @param {object} datosCorte   - Datos del corte (num_transacciones, por_forma_pago, por_departamento, total_ventas)
 * @param {string} rangoInicio  - Fecha ISO inicio
 * @param {string} rangoFin     - Fecha ISO fin
 * @returns {string} HTML completo listo para imprimir
 */
export function generarHTMLCorte(datosCorte, rangoInicio, rangoFin) {
  const esRango = rangoInicio !== rangoFin;
  const periodoStr = esRango
    ? `${fmtFecha(rangoInicio)} al ${fmtFecha(rangoFin)}`
    : fmtFecha(rangoInicio);

  const filasPago = datosCorte.por_forma_pago
    .map(fp => `
      <tr>
        <td>${fmtFormaPago(fp.forma_pago)}</td>
        <td style="text-align:right">${fmtVal(fp.total)}</td>
      </tr>`)
    .join('') ||
    `<tr><td colspan="2" style="text-align:center;color:#888">Sin movimientos</td></tr>`;

  const filasDept = datosCorte.por_departamento
    .map(dep => `
      <tr>
        <td>${dep.departamento}</td>
        <td style="text-align:center">${dep.cantidad}</td>
        <td style="text-align:right">${fmtVal(dep.total)}</td>
      </tr>`)
    .join('') ||
    `<tr><td colspan="3" style="text-align:center;color:#888">Sin datos</td></tr>`;

  const ahora = new Date();
  const horaCorte = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fechaGenerado = `${ahora.toLocaleDateString('es-MX')} ${horaCorte}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Corte de Caja — ${periodoStr}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111;
           max-width: 380px; margin: 0 auto; padding: 24px 16px; }
    .center { text-align: center; }
    .empresa { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
    .subtitulo { font-size: 11px; color: #555; margin-top: 2px; }
    .div-eq { border-top: 2px solid #111; margin: 10px 0; }
    .div-dash { border-top: 1px dashed #aaa; margin: 8px 0; }
    .section-title { text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1px; }
    .info-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #333;
         padding: 3px 4px; text-align: left; }
    td { padding: 3px 4px; font-size: 11px; border-bottom: 1px dashed #e5e5e5; }
    .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #111;
                 padding-top: 6px; margin-top: 4px; display: flex;
                 justify-content: space-between; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #888; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="empresa">PANADERÍAS GRACE</div>
    <div class="subtitulo">Panadería &amp; Repostería</div>
  </div>
  <div class="div-eq"></div>
  <div class="info-row"><span>PERÍODO:</span><span>${periodoStr}</span></div>
  <div class="info-row"><span>HORA CORTE:</span><span>${horaCorte}</span></div>
  <div class="info-row"><span>No. VENTAS:</span><span>${datosCorte.num_transacciones}</span></div>
  <div class="div-eq"></div>
  <div class="section-title">** CORTE DE CAJA **</div>
  <div class="div-eq"></div>
  <div class="section-title" style="font-size:11px;margin-bottom:4px">FORMA DE PAGO</div>
  <div class="div-dash"></div>
  <table>
    <thead><tr><th>Método</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${filasPago}</tbody>
  </table>
  <div class="div-dash" style="margin-top:10px"></div>
  <div class="section-title" style="font-size:11px;margin-bottom:4px">VENTAS POR CATEGORÍA</div>
  <div class="div-dash"></div>
  <table>
    <thead><tr><th>Categoría</th><th style="text-align:center">Pzas</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${filasDept}</tbody>
  </table>
  <div class="div-eq" style="margin-top:10px"></div>
  <div class="total-row" role="row">
    <span>${esRango ? 'TOTAL DEL PERÍODO:' : 'TOTAL DEL DÍA:'}</span>
    <span>${fmtVal(datosCorte.total_ventas)}</span>
  </div>
  <div class="div-eq"></div>
  <div class="footer">Corte generado: ${fechaGenerado}</div>
</body>
</html>`;
}
