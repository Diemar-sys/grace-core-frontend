// src/components/ModalHojaEntrega.jsx
import React from 'react';
import { TENANT } from '../../config/tenant';

const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/**
 * Hoja de entrega para Stock Entry Material Transfer hacia sucursal.
 * Vista PDF + impresión nativa, SIN precios (transferencia interna).
 *
 * @param {Object} props
 * @param {Object} props.datos
 * @param {string} props.datos.fecha
 * @param {string} props.datos.hora
 * @param {string} props.datos.sucursalLabel
 * @param {string} props.datos.warehouseDestino
 * @param {string} [props.datos.docName]
 * @param {string} [props.datos.notas]
 * @param {Array<{item_code, item_name, uom, qty, cantidad_por_presentacion?, presentacion?}>} props.datos.filas
 * @param {Function} props.onClose
 */
function ModalHojaEntrega({ datos, onClose }) {
  const { fecha, hora, sucursalLabel, warehouseDestino, filas, notas, docName } = datos;

  const imprimir = () => {
    const win = window.open('', '_blank', 'width=750,height=700');
    const rows = filas.map(f => {
      const qty = parseFloat(f.qty || 0);
      const uom = f.uom || '';
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
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Hoja de Entrega — ${escHTML(sucursalLabel)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 15px; font-weight: normal; margin-top: 4px; color: #555; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 20px; }
    .info-grid span { font-size: 12px; }
    .divider { border: none; border-top: 1.5px solid #111; margin: 12px 0; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.items th { font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #333; padding: 4px 6px; }
    table.items td { padding: 6px 6px; font-size: 13px; border-bottom: 1px dashed #ddd; }
    .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
    .firma-box { text-align: center; }
    .firma-line { border-top: 1px solid #111; margin: 0 20px 6px; padding-top: 6px; font-size: 12px; }
    .notas { margin-top: 12px; font-size: 12px; color: #555; font-style: italic; }
    .footer { margin-top: 28px; text-align: center; font-size: 11px; color: #888; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHTML(TENANT.nombreFull)}</h1>
    <h2>HOJA DE ENTREGA — TRANSFERENCIA INTERNA</h2>
  </div>
  <hr class="divider"/>
  <div class="info-grid">
    <span><strong>Sucursal:</strong> ${escHTML(sucursalLabel)}</span>
    <span><strong>Warehouse:</strong> ${escHTML(warehouseDestino)}</span>
    <span><strong>Fecha:</strong> ${escHTML(fecha)}</span>
    <span><strong>Hora:</strong> ${escHTML(hora)}</span>
    <span><strong>No. envío:</strong> ${escHTML(docName || '—')}</span>
    <span><strong>Origen:</strong> Bodega Central</span>
  </div>
  <hr class="divider"/>
  <table class="items">
    <thead>
      <tr>
        <th style="text-align:left">Producto</th>
        <th style="text-align:center">Cantidad</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${notas ? `<div class="notas"><strong>Notas:</strong> ${escHTML(notas)}</div>` : ''}
  <div class="firmas">
    <div class="firma-box">
      <div class="firma-line">Entrega (matriz)</div>
    </div>
    <div class="firma-box">
      <div class="firma-line">Recibe (encargado sucursal)</div>
    </div>
  </div>
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
          <span>📋 Hoja de Entrega — {sucursalLabel}</span>
          <button className="nc-btn-close" onClick={onClose}>×</button>
        </div>
        <div className="nc-pdf-scroll">
          <div className="nc-recibo">
            <div className="nc-recibo-head">
              <div className="nc-recibo-empresa">{TENANT.nombreFull}</div>
              <div className="nc-recibo-titulo">HOJA DE ENTREGA — TRANSFERENCIA INTERNA</div>
            </div>
            <hr className="nc-recibo-div" />
            <div className="nc-recibo-info">
              <span><strong>Sucursal:</strong> {sucursalLabel}</span>
              <span><strong>Fecha:</strong> {fecha}</span>
              <span><strong>Hora:</strong> {hora}</span>
              <span><strong>No. envío:</strong> {docName || '—'}</span>
            </div>
            <hr className="nc-recibo-div" />
            <table className="nc-recibo-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const qty = parseFloat(f.qty || 0);
                  const uom = f.uom || '';
                  const cantPres = parseFloat(f.cantidad_por_presentacion) || 1;
                  const presentacion = f.presentacion || '';
                  const qtyPres = cantPres > 1 ? qty / cantPres : null;
                  return (
                    <tr key={`${f.item_code ?? ''}-${i}`}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {notas && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#555', fontStyle: 'italic' }}>
                <strong>Notas:</strong> {notas}
              </div>
            )}
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

export default ModalHojaEntrega;
