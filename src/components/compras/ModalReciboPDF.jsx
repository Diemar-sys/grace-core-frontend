import { fmtUom } from '../../utils/uom';
import { TENANT } from '../../config/tenant';
import { generarHTMLTicketCompra } from '../../utils/print/ticketTemplate';
import { escHTML, fmt } from './compraUtils';

function ModalReciboPDF({ datos, onClose }) {
  const { noCompra, noFactura, fecha, hora, proveedor, filas, totales, ajuste, esBorrador } = datos;

  const numStr = noCompra != null ? String(noCompra).padStart(4, '0') : '----';

  const imprimir = () => {
    const win = window.open('', '_blank', 'width=750,height=700');
    const rows = filas.map(f => {
      const sub = parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);
      const impMonto = sub * parseFloat(f.impuesto_rate || 0);
      const totalLinea = sub + impMonto;
      const impLabel = (f.impuesto_label || 'Tasa 0') + (impMonto > 0 ? ` — $${fmt(impMonto)}` : '');
      const bultos = parseFloat(f.bultos || 0);
      const kgPorBulto = parseFloat(f.kg_por_bulto || 0);
      const uom = fmtUom(f.uom || '');
      const totalNatural = kgPorBulto > 0 ? bultos * kgPorBulto : bultos;
      const cantCell = kgPorBulto > 0
        ? `${totalNatural.toFixed(2)} ${uom}<br/><small style="color:#666;font-size:10px">${bultos.toFixed(2)} emp.</small>`
        : `${bultos.toFixed(2)}${uom ? ' ' + uom : ''}`;
      return `
        <tr>
          <td>${escHTML(f.item_name || f.item_code)}</td>
          <td style="text-align:center">${cantCell}</td>
          <td style="text-align:right">$${fmt(f.rate)}</td>
          <td style="text-align:right">${escHTML(impLabel)}</td>
          <td style="text-align:right">$${fmt(totalLinea)}</td>
        </tr>`;
    }).join('');

    const impuestosRows = [
      totales.iva > 0 ? `<tr><td>IVA 16%</td><td style="text-align:right">$${fmt(totales.iva)}</td></tr>` : '',
      totales.ieps > 0 ? `<tr><td>IEPS 8%</td><td style="text-align:right">$${fmt(totales.ieps)}</td></tr>` : '',
      ajuste !== 0 ? `<tr><td>Ajuste</td><td style="text-align:right">$${fmt(ajuste)}</td></tr>` : '',
    ].join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${esBorrador ? 'Precompra' : 'Compra'} #${escHTML(numStr)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 15px; font-weight: normal; margin-top: 4px; color: #555; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 20px; }
    .info-grid span { font-size: 12px; }
    .info-grid strong { font-size: 12px; }
    .divider { border: none; border-top: 1.5px solid #111; margin: 12px 0; }
    .divider-thin { border: none; border-top: 1px dashed #aaa; margin: 8px 0; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.items th { font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #333; padding: 4px 6px; }
    table.items td { padding: 4px 6px; font-size: 12px; border-bottom: 1px dashed #ddd; }
    table.totales { width: 280px; margin-left: auto; border-collapse: collapse; }
    table.totales td { padding: 3px 6px; font-size: 13px; }
    table.totales .base-row td { font-size: 11px; color: #666; }
    table.totales .total-row td { font-weight: bold; font-size: 15px; border-top: 1.5px solid #111; padding-top: 6px; }
    .footer { margin-top: 28px; text-align: center; font-size: 11px; color: #888; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHTML(TENANT.nombreFull)}</h1>
    <h2>${esBorrador ? 'PRECOMPRA — PENDIENTE DE CONFIRMAR' : 'COMPROBANTE DE COMPRA'}</h2>
  </div>
  <hr class="divider"/>
  <div class="info-grid">
    <span><strong>No. Compra:</strong> #${escHTML(numStr)}</span>
    <span><strong>No. Factura:</strong> ${escHTML(noFactura || '—')}</span>
    <span><strong>Fecha:</strong> ${escHTML(fecha)}</span>
    <span><strong>Hora:</strong> ${escHTML(hora)}</span>
    <span><strong>Proveedor:</strong> ${escHTML(proveedor)}</span>
  </div>
  <hr class="divider"/>
  <table class="items">
    <thead>
      <tr>
        <th style="text-align:left">Producto</th>
        <th style="text-align:center">Cant.</th>
        <th style="text-align:right">Precio</th>
        <th style="text-align:right">Impuesto</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <hr class="divider-thin"/>
  <table class="totales">
    <tbody>
      <tr class="base-row"><td>Subtotal IVA 16%</td><td style="text-align:right">$${fmt(totales.subtotalIva16 || 0)}</td></tr>
      <tr class="base-row"><td>Subtotal IEPS 8%</td><td style="text-align:right">$${fmt(totales.subtotalIeps || 0)}</td></tr>
      <tr class="base-row"><td>Subtotal IVA 0%</td><td style="text-align:right">$${fmt(totales.subtotalTasa0 || 0)}</td></tr>
      ${(() => { const d = (totales.subtotal||0) - ((totales.subtotalIva16||0)+(totales.subtotalIeps||0)+(totales.subtotalTasa0||0)); return d !== 0 ? `<tr class="base-row"><td>Ajuste</td><td style="text-align:right">$${fmt(d)}</td></tr>` : ''; })()}
      <tr><td>Subtotal</td><td style="text-align:right">$${fmt(totales.subtotal)}</td></tr>
      ${impuestosRows}
      <tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${fmt(totales.total)}</td></tr>
    </tbody>
  </table>
  <div class="footer">Documento generado el ${escHTML(fecha)} a las ${escHTML(hora)}</div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
  };

  const imprimirTicket = () => {
    const win = window.open('', '_blank', 'width=420,height=700');
    const html = generarHTMLTicketCompra({
      noCompra, noFactura, proveedor, fecha, hora, totales, ajuste, esBorrador,
    });
    win.document.write(html + '<script>window.onload=function(){window.print();}</script>');
    win.document.close();
  };

  return (
    <div className="nc-modal-overlay">
      <div className="nc-pdf-preview-modal">
        <div className="nc-pdf-modal-header">
          <span>🧾 Vista previa — {esBorrador ? 'Precompra' : 'Compra'} #{numStr}</span>
          <button className="nc-btn-close" onClick={onClose}>×</button>
        </div>

        <div className="nc-pdf-scroll">
          <div className="nc-recibo">
            <div className="nc-recibo-head">
              <div className="nc-recibo-empresa">{TENANT.nombreFull}</div>
              <div className="nc-recibo-titulo">
                {esBorrador ? 'PRECOMPRA — PENDIENTE DE CONFIRMAR' : 'COMPROBANTE DE COMPRA'}
              </div>
            </div>
            <hr className="nc-recibo-div" />
            <div className="nc-recibo-info">
              <span><strong>No. Compra:</strong> #{numStr}</span>
              <span><strong>No. Factura:</strong> {noFactura || '—'}</span>
              <span><strong>Fecha:</strong> {fecha}</span>
              <span><strong>Hora:</strong> {hora}</span>
              <span><strong>Proveedor:</strong> {proveedor}</span>
            </div>
            <hr className="nc-recibo-div" />
            <table className="nc-recibo-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th style={{ textAlign: 'right' }}>Impuesto</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const sub = parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);
                  const impMonto = sub * parseFloat(f.impuesto_rate || 0);
                  const totalLinea = sub + impMonto;
                  const bultos = parseFloat(f.bultos || 0);
                  const kgPorBulto = parseFloat(f.kg_por_bulto || 0);
                  const uom = fmtUom(f.uom || '');
                  const totalNatural = kgPorBulto > 0 ? bultos * kgPorBulto : bultos;
                  return (
                    <tr key={`${f.item_code || ''}-${i}`}>
                      <td>{f.item_name || f.item_code}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600 }}>
                          {kgPorBulto > 0
                            ? `${totalNatural.toFixed(2)} ${uom}`
                            : `${bultos.toFixed(2)}${uom ? ' ' + uom : ''}`}
                        </div>
                        {kgPorBulto > 0 && (
                          <div style={{ fontSize: '11px', color: '#666' }}>{bultos.toFixed(2)} emp.</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>${fmt(f.rate)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {f.impuesto_label || 'Tasa 0'}
                        {impMonto > 0 && ` — $${fmt(impMonto)}`}
                      </td>
                      <td style={{ textAlign: 'right' }}>${fmt(totalLinea)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <hr className="nc-recibo-div-thin" />
            <div className="nc-recibo-totales">
              <div className="nc-recibo-total-fila nc-recibo-base">
                <span>Subtotal IVA 16%</span><span>${fmt(totales.subtotalIva16 || 0)}</span>
              </div>
              <div className="nc-recibo-total-fila nc-recibo-base">
                <span>Subtotal IEPS 8%</span><span>${fmt(totales.subtotalIeps || 0)}</span>
              </div>
              <div className="nc-recibo-total-fila nc-recibo-base">
                <span>Subtotal IVA 0%</span><span>${fmt(totales.subtotalTasa0 || 0)}</span>
              </div>
              {(() => { const d = (totales.subtotal||0) - ((totales.subtotalIva16||0)+(totales.subtotalIeps||0)+(totales.subtotalTasa0||0)); return d !== 0 ? (<div className="nc-recibo-total-fila nc-recibo-base"><span>Ajuste</span><span>${fmt(d)}</span></div>) : null; })()}
              <div className="nc-recibo-total-fila">
                <span>Subtotal</span><span>${fmt(totales.subtotal)}</span>
              </div>
              {totales.iva > 0 && (
                <div className="nc-recibo-total-fila">
                  <span>IVA 16%</span><span>${fmt(totales.iva)}</span>
                </div>
              )}
              {totales.ieps > 0 && (
                <div className="nc-recibo-total-fila">
                  <span>IEPS 8%</span><span>${fmt(totales.ieps)}</span>
                </div>
              )}
              {ajuste !== 0 && (
                <div className="nc-recibo-total-fila">
                  <span>Ajuste</span><span>${fmt(ajuste)}</span>
                </div>
              )}
              <div className="nc-recibo-total-fila nc-recibo-grand-total">
                <span>TOTAL</span><span>${fmt(totales.total)}</span>
              </div>
            </div>
            <div className="nc-recibo-footer">
              Documento generado el {fecha} a las {hora}
            </div>
          </div>
        </div>

        <div className="nc-sugerencia-actions" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <button className="nc-btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="nc-btn-secondary" onClick={imprimirTicket}>🧾 Imprimir Ticket</button>
          <button className="nc-btn-primary" onClick={imprimir}>🖨️ Imprimir / Guardar PDF</button>
        </div>
      </div>
    </div>
  );
}

export default ModalReciboPDF;
