import { TENANT } from '../../config/tenant';
import { generarHTMLTicketCompra } from './ticketTemplate';
import { escHTML } from './escHTML';
import { horaFrappe, horaLocal } from '../hora';

const fmt2 = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseImpuestoDesc = (description = '') => {
  if (description.includes('IVA')) return { key: 'iva16', label: 'IVA 16%', rate: 0.16 };
  if (description.includes('IEPS')) return { key: 'ieps', label: 'IEPS 8%', rate: 0.08 };
  return { key: 'tasa0', label: 'Tasa 0', rate: 0 };
};

/**
 * Convierte un doc Purchase Receipt de ERPNext al formato `datos` esperado
 * por las funciones de impresión.
 */
export function docToDatosImpresion(doc) {
  const totales = { subtotal: doc.total || 0, iva: 0, ieps: 0, total: doc.grand_total || 0 };
  let ajuste = 0;
  (doc.taxes || []).forEach(t => {
    if (t.account_head?.includes('IVA')) totales.iva += parseFloat(t.tax_amount || 0);
    else if (t.account_head?.includes('IEPS')) totales.ieps += parseFloat(t.tax_amount || 0);
    else if (t.account_head?.includes('AJUSTE') || t.description?.toLowerCase().includes('redondeo')) {
      ajuste += parseFloat(t.tax_amount || 0);
    }
  });
  // El ajuste (redondeo SAT) se deja como línea separada en el nivel de impuestos.
  // NO se absorbe en subtotal — así subtotalIva16+subtotalIeps+subtotalTasa0 = subtotal exacto.

  const filas = (doc.items || []).map(i => {
    const imp = parseImpuestoDesc(i.description || '');
    return {
      item_code: i.item_code,
      item_name: i.item_name,
      bultos: String(i.qty ?? ''),
      kg_por_bulto: String(i.custom_cantidad_por_presentación || i.conversion_factor > 1 ? i.conversion_factor : ''),
      uom: i.stock_uom || i.uom || '',
      rate: String(i.rate ?? ''),
      impuesto_key: imp.key,
      impuesto_label: imp.label,
      impuesto_rate: imp.rate,
    };
  });

  // Leer custom fields guardados al registrar — fuente de verdad exacta (ajustada manualmente)
  // Fallback a cálculo desde items para compras anteriores sin custom fields
  const calcIva16 = filas.filter(f => f.impuesto_key === 'iva16')
    .reduce((s, f) => s + parseFloat(f.bultos || 0) * parseFloat(f.rate || 0), 0);
  const calcIeps = filas.filter(f => f.impuesto_key === 'ieps')
    .reduce((s, f) => s + parseFloat(f.bultos || 0) * parseFloat(f.rate || 0), 0);
  const calcTasa0 = filas.filter(f => f.impuesto_key === 'tasa0')
    .reduce((s, f) => s + parseFloat(f.bultos || 0) * parseFloat(f.rate || 0), 0);

  totales.subtotalIva16 = doc.custom_subtotal_iva_16  != null ? parseFloat(doc.custom_subtotal_iva_16)  : calcIva16;
  totales.subtotalIeps  = doc.custom_subtotal_ieps_8  != null ? parseFloat(doc.custom_subtotal_ieps_8)  : calcIeps;
  totales.subtotalTasa0 = doc.custom_subtotal_iva_0   != null ? parseFloat(doc.custom_subtotal_iva_0)   : calcTasa0;

  // Subtotal SIEMPRE = suma de los tres componentes (espejo de NuevaCompra).
  // doc.total viene de items qty*rate sin overrides — descartado para que
  // subtotalIva16(.29) + subtotalIeps(0) + subtotalTasa0(0) = subtotal(.29) exacto.
  totales.subtotal = totales.subtotalIva16 + totales.subtotalIeps + totales.subtotalTasa0;

  const fechaSrc = doc.posting_date ? new Date(doc.posting_date) : new Date();
  const fecha = fechaSrc.toISOString().split('T')[0];
  const hora = horaFrappe(doc.posting_time) || horaLocal();

  return {
    noCompra: doc.custom_no_de_compra ?? null,
    noFactura: doc.supplier_delivery_note || '',
    fecha,
    hora,
    proveedor: doc.supplier_name || doc.supplier || '',
    facturadoA: doc.custom_facturado_a || 'SIN FACTURA',
    pagado: !!doc.custom_pagado,
    filas,
    totales,
    ajuste,
    descuento: parseFloat(doc.discount_amount || 0),
    esBorrador: doc.docstatus === 0,
  };
}

/**
 * Imprime ticket térmico compacto. Intenta servidor local 6789 (térmica directa).
 * Si servidor no responde, fallback a window.print() del navegador.
 */
export async function imprimirCompraTicket(datos) {
  const payload = {
    no_compra: datos.noCompra,
    no_factura: datos.noFactura || '',
    proveedor: datos.proveedor || '',
    facturado_a: datos.facturadoA || 'SIN FACTURA',
    pagado: !!datos.pagado,
    fecha: datos.fecha || '',
    hora: datos.hora || '',
    subtotal_iva16: datos.totales?.subtotalIva16 || 0,
    subtotal_ieps: datos.totales?.subtotalIeps || 0,
    subtotal_tasa0: datos.totales?.subtotalTasa0 || 0,
    subtotal: datos.totales?.subtotal || 0,
    iva: datos.totales?.iva || 0,
    ieps: datos.totales?.ieps || 0,
    ajuste: datos.ajuste || 0,
    descuento: datos.descuento || 0,
    total: datos.totales?.total || 0,
    es_borrador: !!datos.esBorrador,
  };
  try {
    const res = await fetch('/print/imprimir-compra', {
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
    const html = generarHTMLTicketCompra(datos);
    win.document.write(html + '<script>window.onload=function(){window.print();}</script>');
    win.document.close();
  }
}

/**
 * Imprime PDF detallado con tabla de items, impuestos por línea y totales.
 */
export function imprimirCompraPDF(datos) {
  const { noCompra, noFactura, fecha, hora, proveedor, facturadoA, pagado, filas, totales, ajuste, descuento, esBorrador } = datos;
  const numStr = noCompra != null ? String(noCompra).padStart(4, '0') : '----';

  const win = window.open('', '_blank', 'width=750,height=700');
  const rows = filas.map(f => {
    const sub = parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);
    const impMonto = sub * parseFloat(f.impuesto_rate || 0);
    const totalLinea = sub + impMonto;
    const impLabel = (f.impuesto_label || 'Tasa 0') + (impMonto > 0 ? ` — $${fmt2(impMonto)}` : '');
    const bultos = parseFloat(f.bultos || 0);
    const kgPorBulto = parseFloat(f.kg_por_bulto || 0);
    const uom = f.uom || '';
    const totalNatural = kgPorBulto > 0 ? bultos * kgPorBulto : bultos;
    const cantCell = kgPorBulto > 0
      ? `${totalNatural.toFixed(2)} ${uom}<br/><small style="color:#666;font-size:10px">${bultos.toFixed(2)} emp.</small>`
      : `${bultos.toFixed(2)}${uom ? ' ' + uom : ''}`;
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
    Math.abs(ajuste) > 10 ? `<tr><td>Ajuste</td><td style="text-align:right">$${fmt2(ajuste)}</td></tr>` : '',
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
    <span><strong>Facturado a:</strong> ${escHTML(facturadoA || 'SIN FACTURA')}</span>
    <span><strong>Estado de pago:</strong> ${pagado ? 'PAGADO' : 'PENDIENTE'}</span>
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
      ${(totales.subtotalIva16 || 0) > 0 ? `<tr class="base-row"><td>Subtotal IVA 16%</td><td style="text-align:right">$${fmt2(totales.subtotalIva16)}</td></tr>` : ''}
      ${(totales.subtotalIeps || 0) > 0 ? `<tr class="base-row"><td>Subtotal IEPS 8%</td><td style="text-align:right">$${fmt2(totales.subtotalIeps)}</td></tr>` : ''}
      ${(totales.subtotalTasa0 || 0) > 0 ? `<tr class="base-row"><td>Subtotal IVA 0%</td><td style="text-align:right">$${fmt2(totales.subtotalTasa0)}</td></tr>` : ''}
      <tr><td>Subtotal</td><td style="text-align:right">$${fmt2(totales.subtotal)}</td></tr>
      ${(descuento || 0) > 0 ? `<tr><td>Descuento</td><td style="text-align:right">−$${fmt2(descuento)}</td></tr>` : ''}
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
}

/**
 * Ticket de compra CONSOLIDADO: suma de varias notas/remisiones de un mismo
 * proveedor (el que cuadra con la factura). Imprime por el navegador.
 * @param {string} proveedor - Nombre del proveedor.
 * @param {string} factura - No. de factura que consolida las notas (puede ir vacío).
 * @param {Array<{no_compra, remision, fecha, total}>} notas - Filas a sumar.
 */
export async function imprimirTicketConsolidado(proveedor, factura, notas, facturadoA = '') {
  const hoy = new Date().toLocaleDateString('es-MX');
  // Térmica WL88S primero (print-server); fallback a navegador si no responde.
  try {
    const res = await fetch('/print/imprimir-ticket-consolidado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor, factura, fecha: hoy, notas, facturado_a: facturadoA }),
    });
    if (!res.ok) throw new Error('Print server ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error térmica');
    return;
  } catch (err) {
    console.warn('Térmica no disponible, fallback navegador:', err.message);
  }
  const granTotal = notas.reduce((s, n) => s + parseFloat(n.total || 0), 0);
  const filas = notas.map(n => `
    <tr>
      <td>#${escHTML(n.no_compra ?? '—')}</td>
      <td>${escHTML(n.remision || '—')}</td>
      <td>${escHTML(n.fecha || '')}</td>
      <td class="r">$${fmt2(n.total)}</td>
    </tr>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <title>Ticket consolidado — ${escHTML(proveedor)}</title>
  <style>
    @page { margin: 8mm; }
    body { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #2c2a27; width: 320px; margin: 0 auto; font-size: 12px; }
    h1 { font-family: 'Space Grotesk', sans-serif; font-size: 16px; margin: 0 0 2px; }
    .sub { color: #6f675d; font-size: 11px; margin: 0 0 10px; }
    .meta { margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6f675d; border-bottom: 2px solid #c8503c; padding: 4px 2px; }
    td { padding: 5px 2px; border-bottom: 1px solid #efeae0; }
    .r { text-align: right; }
    .gran { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 2px solid #2c2a27; font-weight: 700; font-size: 15px; color: #c8503c; }
    .n { color: #6f675d; font-size: 11px; text-align: right; margin-top: 4px; }
  </style></head><body>
    <h1>Panaderías Grace</h1>
    <p class="sub">TICKET DE COMPRA CONSOLIDADO</p>
    <div class="meta"><strong>Proveedor:</strong> ${escHTML(proveedor)}<br><strong>Factura:</strong> ${escHTML(factura || '—')}<br><strong>Facturado a:</strong> ${escHTML(facturadoA || 'SIN FACTURA')}<br><strong>Fecha:</strong> ${escHTML(hoy)}</div>
    <table>
      <thead><tr><th># Compra</th><th>Remisión</th><th>Fecha</th><th class="r">Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="gran"><span>GRAN TOTAL</span><span>$${fmt2(granTotal)}</span></div>
    <div class="n">${notas.length} nota(s)</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=420,height=700');
  win.document.write(html);
  win.document.close();
}
