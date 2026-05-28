// src/components/ModalReciboPDF.jsx
// Preview + impresión PDF de venta B2B (preventa o registrada).
// Espera datos: { noVenta, fecha, hora, cliente, filas, totales, ajuste, esBorrador }
import React from 'react';
import { TENANT } from '../../config/tenant';
import { fmtUom } from '../../utils/uom';

const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmt2 = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ModalReciboPDF({ datos, onClose }) {
  const { noVenta, fecha, hora, cliente, filas, totales, ajuste, esBorrador } = datos;
  const numStr = noVenta != null ? String(noVenta).padStart(4, '0') : '----';

  const imprimir = () => {
    const win = window.open('', '_blank', 'width=750,height=700');
    const rows = filas.map(f => {
      const sub = parseFloat(f.qty || 0) * parseFloat(f.rate || 0);
      const impMonto = sub * parseFloat(f.impuesto_rate || 0);
      const totalLinea = sub + impMonto;
      const impLabel = (f.impuesto_label || 'Tasa 0') + (impMonto > 0 ? ` — $${fmt2(impMonto)}` : '');
      const qty = parseFloat(f.qty || 0);
      const uom = fmtUom(f.uom || '');
      const cantPres = parseFloat(f.cantidad_por_presentacion) || 1;
      const presentacion = f.presentacion || '';
      const qtyPres = cantPres > 1 ? qty / cantPres : null;
      const cantCell = qtyPres != null && presentacion
        ? `${qty.toFixed(2)} ${escHTML(uom)}<br/><small style="color:#666;font-size:10px">${qtyPres.toFixed(2)} ${escHTML(presentacion)}</small>`
        : `${qty.toFixed(2)}${uom ? ' ' + escHTML(uom) : ''}`;
      return `
        <tr>
          <td>${escHTML(f.item_name || f.item_code)}</td>
          <td style="text-align:center">${cantCell}</td>
          <td style="text-align:right">$${fmt2(f.rate)}</td>
          <td style="text-align:right">${escHTML(impLabel)}</td>
          <td style="text-align:right">$${fmt2(totalLinea)}</td>
        </tr>`;
    }).join('');

    const impuestosRows = [
      totales.iva > 0 ? `<tr><td>IVA 16%</td><td style="text-align:right">$${fmt2(totales.iva)}</td></tr>` : '',
      totales.ieps > 0 ? `<tr><td>IEPS 8%</td><td style="text-align:right">$${fmt2(totales.ieps)}</td></tr>` : '',
      ajuste !== 0 ? `<tr><td>Ajuste</td><td style="text-align:right">$${fmt2(ajuste)}</td></tr>` : '',
    ].join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${esBorrador ? 'Preventa' : 'Venta'} #${escHTML(numStr)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 15px; font-weight: normal; margin-top: 4px; color: #555; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 20px; }
    .info-grid span { font-size: 12px; }
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
    <h2>${esBorrador ? 'PREVENTA — PENDIENTE DE CONFIRMAR' : 'COMPROBANTE DE VENTA'}</h2>
  </div>
  <hr class="divider"/>
  <div class="info-grid">
    <span><strong>No. Venta:</strong> #${escHTML(numStr)}</span>
    <span><strong>Fecha:</strong> ${escHTML(fecha)}</span>
    <span><strong>Hora:</strong> ${escHTML(hora)}</span>
    <span><strong>Cliente:</strong> ${escHTML(cliente)}</span>
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
      <tr class="base-row"><td>Subtotal IVA 16%</td><td style="text-align:right">$${fmt2(totales.subtotalIva16 || 0)}</td></tr>
      <tr class="base-row"><td>Subtotal IEPS 8%</td><td style="text-align:right">$${fmt2(totales.subtotalIeps || 0)}</td></tr>
      <tr class="base-row"><td>Subtotal IVA 0%</td><td style="text-align:right">$${fmt2(totales.subtotalTasa0 || 0)}</td></tr>
      <tr><td>Subtotal</td><td style="text-align:right">$${fmt2(totales.subtotal)}</td></tr>
      ${impuestosRows}
      <tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${fmt2(totales.total)}</td></tr>
    </tbody>
  </table>
  <div class="footer">Documento generado el ${escHTML(fecha)} a las ${escHTML(hora)}</div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="nc-modal-overlay">
      <div className="nc-pdf-preview-modal">
        <div className="nc-pdf-modal-header">
          <span>🧾 Vista previa — {esBorrador ? 'Preventa' : 'Venta'} #{numStr}</span>
          <button className="nc-btn-close" onClick={onClose}>×</button>
        </div>

        <div className="nc-pdf-scroll">
          <div className="nc-recibo">
            <div className="nc-recibo-head">
              <div className="nc-recibo-empresa">{TENANT.nombreFull}</div>
              <div className="nc-recibo-titulo">
                {esBorrador ? 'PREVENTA — PENDIENTE DE CONFIRMAR' : 'COMPROBANTE DE VENTA'}
              </div>
            </div>
            <hr className="nc-recibo-div" />
            <div className="nc-recibo-info">
              <span><strong>No. Venta:</strong> #{numStr}</span>
              <span><strong>Fecha:</strong> {fecha}</span>
              <span><strong>Hora:</strong> {hora}</span>
              <span><strong>Cliente:</strong> {cliente}</span>
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
                  const sub = parseFloat(f.qty || 0) * parseFloat(f.rate || 0);
                  const impMonto = sub * parseFloat(f.impuesto_rate || 0);
                  const totalLinea = sub + impMonto;
                  const qty = parseFloat(f.qty || 0);
                  const uom = fmtUom(f.uom || '');
                  const cantPres = parseFloat(f.cantidad_por_presentacion) || 1;
                  const presentacion = f.presentacion || '';
                  const qtyPres = cantPres > 1 ? qty / cantPres : null;
                  return (
                    <tr key={i}>
                      <td>{f.item_name || f.item_code}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600 }}>
                          {qty.toFixed(2)}{uom ? ' ' + uom : ''}
                        </div>
                        {qtyPres != null && presentacion && (
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {qtyPres.toFixed(2)} {presentacion}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>${fmt2(f.rate)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {f.impuesto_label || 'Tasa 0'}
                        {impMonto > 0 && ` — $${fmt2(impMonto)}`}
                      </td>
                      <td style={{ textAlign: 'right' }}>${fmt2(totalLinea)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <hr className="nc-recibo-div-thin" />
            <div className="nc-recibo-totales">
              <div className="nc-recibo-total-fila nc-recibo-base">
                <span>Subtotal IVA 16%</span><span>${fmt2(totales.subtotalIva16 || 0)}</span>
              </div>
              <div className="nc-recibo-total-fila nc-recibo-base">
                <span>Subtotal IEPS 8%</span><span>${fmt2(totales.subtotalIeps || 0)}</span>
              </div>
              <div className="nc-recibo-total-fila nc-recibo-base">
                <span>Subtotal IVA 0%</span><span>${fmt2(totales.subtotalTasa0 || 0)}</span>
              </div>
              <div className="nc-recibo-total-fila">
                <span>Subtotal</span><span>${fmt2(totales.subtotal)}</span>
              </div>
              {totales.iva > 0 && (
                <div className="nc-recibo-total-fila">
                  <span>IVA 16%</span><span>${fmt2(totales.iva)}</span>
                </div>
              )}
              {totales.ieps > 0 && (
                <div className="nc-recibo-total-fila">
                  <span>IEPS 8%</span><span>${fmt2(totales.ieps)}</span>
                </div>
              )}
              {ajuste !== 0 && (
                <div className="nc-recibo-total-fila">
                  <span>Ajuste</span><span>${fmt2(ajuste)}</span>
                </div>
              )}
              <div className="nc-recibo-total-fila nc-recibo-grand-total">
                <span>TOTAL</span><span>${fmt2(totales.total)}</span>
              </div>
            </div>
            <div className="nc-recibo-footer">
              Documento generado el {fecha} a las {hora}
            </div>
          </div>
        </div>

        <div className="nc-sugerencia-actions" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <button className="nc-btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="nc-btn-primary" onClick={imprimir}>🖨️ Imprimir / Guardar PDF</button>
        </div>
      </div>
    </div>
  );
}

export default ModalReciboPDF;
