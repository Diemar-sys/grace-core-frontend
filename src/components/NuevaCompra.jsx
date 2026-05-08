// src/components/NuevaCompra.jsx
import React, { useState, useRef, useEffect } from 'react';
import { comprasService } from '../services/frappePurchase';
import ModalError from './ModalError';
import { TENANT } from '../config/tenant';
import { IMPUESTOS_MAP } from '../config/impuestos';
import { generarHTMLTicketCompra } from '../utils/print/ticketTemplate';
import '../styles/NuevaCompra.css';

// Margen por default (en pesos). El usuario puede ajustarlo en la UI.
const MARGEN_DEFAULT = 100;

/** Escapa caracteres HTML para evitar XSS al inyectar en `document.write`. */
const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: '', item_name: '', uom: '',
  bultos: '', kg_por_bulto: '', rate: '',
  precio_catalogo: '',      // precio original del catálogo (referencia)
  precio_por_kg: '',        // precio por kg del catálogo (referencia)
  impuesto_key: 'tasa0', impuesto_label: 'Tasa 0', impuesto_rate: 0,
});

const parseImpuesto = (description = '') => {
  if (description.includes('IVA')) return IMPUESTOS_MAP['iva16'];
  if (description.includes('IEPS')) return IMPUESTOS_MAP['ieps'];
  return IMPUESTOS_MAP['tasa0'];
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(n * 100) / 100;
const totalPorFila = (f) => parseFloat(f.bultos || 0) * parseFloat(f.kg_por_bulto || 0);
// Sin redondeo intermedio por línea — espejo del cálculo server-side de ERPNext
// con Currency Precision = 6. UI suma con precisión completa y redondea solo al
// mostrar via fmt(). Así total UI coincide con grand_total de ERPNext.
const subtotalFila = (f) => parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);
const impuestoFila = (f) => subtotalFila(f) * parseFloat(f.impuesto_rate || 0);
const totalFila = (f) => subtotalFila(f) + impuestoFila(f);

// ── Calcula variación de precio de una fila ──────────────────────────────────
const calcVariacion = (fila) => {
  const actual = parseFloat(fila.rate || 0);
  const catalogo = parseFloat(fila.precio_catalogo || 0);
  if (!catalogo || !actual) return null;
  const diff = actual - catalogo;
  const pct = (diff / catalogo) * 100;
  return { diff, pct, actual, catalogo, cambio: Math.abs(diff) > 0.005 };
};

// ── Modal de sugerencia de actualización de precios ──────────────────────────
/**
 * Modal que aparece tras confirmar la compra cuando algún precio difirió de su
 * valor en el Catálogo. Muestra una tabla por producto con checkbox para que
 * el usuario elija cuáles actualizar.
 *
 * @param {Array}    props.cambios    - Filas cuyo precio difirió (con variación calculada).
 * @param {Function} props.onAceptar - Callback(seleccionados) con array de item_code a actualizar.
 * @param {Function} props.onOmitir  - Callback para no actualizar nada.
 */
function ModalSugerenciaPrecios({ cambios, onAceptar, onOmitir }) {
  const [seleccionados, setSeleccionados] = useState(
    () => Object.fromEntries(cambios.map(c => [c.item_code, true]))
  );

  const toggle = (code) =>
    setSeleccionados(prev => ({ ...prev, [code]: !prev[code] }));

  const hayAlguno = Object.values(seleccionados).some(Boolean);

  return (
    <div className="nc-modal-overlay">
      <div className="nc-sugerencia-modal">
        <div className="nc-sugerencia-header">
          <span className="nc-sugerencia-icon">📊</span>
          <div>
            <h3>Actualizar precios en Catálogo</h3>
            <p>Los siguientes productos se compraron a un precio diferente al registrado.</p>
          </div>
        </div>

        <div className="nc-sugerencia-tabla-wrap">
          <table className="nc-sugerencia-tabla">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Producto</th>
                <th>Precio catálogo</th>
                <th>Precio compra</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map(c => {
                const v = calcVariacion(c);
                const sube = v && v.diff > 0;
                return (
                  <tr key={c.item_code} className={seleccionados[c.item_code] ? 'nc-row-sel' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="nc-checkbox"
                        checked={!!seleccionados[c.item_code]}
                        onChange={() => toggle(c.item_code)}
                      />
                    </td>
                    <td className="nc-sug-nombre">{c.item_name}</td>
                    <td className="nc-sug-monto">${fmt(v?.catalogo)}</td>
                    <td className="nc-sug-monto nc-sug-nuevo">${fmt(v?.actual)}</td>
                    <td>
                      <span className={`nc-var-badge ${sube ? 'nc-var-sube' : 'nc-var-baja'}`}>
                        {sube ? '▲' : '▼'} {Math.abs(v?.pct).toFixed(1)}%
                        {' '}({sube ? '+' : ''}${fmt(v?.diff)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="nc-sug-nota">
          Se actualizará <strong>Precio de Compra</strong> y <strong>Precio por KG</strong> en el Catálogo.
        </p>

        <div className="nc-sugerencia-actions">
          <button className="nc-btn-secondary" onClick={onOmitir}>
            Omitir, no actualizar
          </button>
          <button
            className="nc-btn-primary"
            onClick={() => onAceptar(cambios.filter(c => seleccionados[c.item_code]))}
            disabled={!hayAlguno}
          >
            Actualizar seleccionados
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Recibo PDF ─────────────────────────────────────────────────────────
function ModalReciboPDF({ datos, onClose }) {
  const { noCompra, noFactura, fecha, hora, proveedor, filas, totales, ajuste, esBorrador } = datos;

  const fmt2 = (n) =>
    Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const numStr = noCompra != null ? String(noCompra).padStart(4, '0') : '----';

  const imprimir = () => {
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
      ajuste !== 0 ? `<tr><td>Ajuste</td><td style="text-align:right">$${fmt2(ajuste)}</td></tr>` : '',
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
      <tr class="base-row"><td>Subtotal IVA 16%</td><td style="text-align:right">$${fmt2(totales.subtotalIva16 || 0)}</td></tr>
      <tr class="base-row"><td>Subtotal IEPS 8%</td><td style="text-align:right">$${fmt2(totales.subtotalIeps || 0)}</td></tr>
      <tr class="base-row"><td>Subtotal IVA 0%</td><td style="text-align:right">$${fmt2(totales.subtotalTasa0 || 0)}</td></tr>
      ${(() => { const d = (totales.subtotal||0) - ((totales.subtotalIva16||0)+(totales.subtotalIeps||0)+(totales.subtotalTasa0||0)); return d !== 0 ? `<tr class="base-row"><td>Ajuste</td><td style="text-align:right">$${fmt2(d)}</td></tr>` : ''; })()}
      <tr><td>Subtotal</td><td style="text-align:right">$${fmt2(totales.subtotal)}</td></tr>
      ${impuestosRows}
      <tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${fmt2(totales.total)}</td></tr>
    </tbody>
  </table>
  <div class="footer">Documento generado el ${escHTML(fecha)} a las ${escHTML(hora)}</div>
  <script>window.onload = function(){ window.print(); }<\/script>
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
    win.document.write(html + '<script>window.onload=function(){window.print();}<\/script>');
    win.document.close();
  };

  return (
    <div className="nc-modal-overlay">
      <div className="nc-pdf-preview-modal">
        {/* Cabecera del modal */}
        <div className="nc-pdf-modal-header">
          <span>🧾 Vista previa — {esBorrador ? 'Precompra' : 'Compra'} #{numStr}</span>
          <button className="nc-btn-close" onClick={onClose}>×</button>
        </div>

        {/* Preview del recibo */}
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
                  const uom = f.uom || '';
                  const totalNatural = kgPorBulto > 0 ? bultos * kgPorBulto : bultos;
                  return (
                    <tr key={i}>
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
              {(() => { const d = (totales.subtotal||0) - ((totales.subtotalIva16||0)+(totales.subtotalIeps||0)+(totales.subtotalTasa0||0)); return d !== 0 ? (<div className="nc-recibo-total-fila nc-recibo-base"><span>Ajuste</span><span>${fmt2(d)}</span></div>) : null; })()}
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

        {/* Acciones */}
        <div className="nc-sugerencia-actions" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <button className="nc-btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="nc-btn-secondary" onClick={imprimirTicket}>🧾 Imprimir Ticket</button>
          <button className="nc-btn-primary" onClick={imprimir}>🖨️ Imprimir / Guardar PDF</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
/**
 * Modal para crear o editar un borrador de Compra (Purchase Receipt).
 *
 * @param {Function} props.onSuccess   - Callback al completar.
 * @param {Function} props.onCancel    - Callback para cerrar sin cambios.
 * @param {Object}  [props.initialData] - Si existe, modo edición.
 */
function NuevaCompra({ onSuccess, onCancel, initialData = null }) {
  const esEdicion = !!initialData;

  const [proveedor, setProveedor] = useState(
    initialData
      ? { name: initialData.supplier, label: initialData.supplier_name || initialData.supplier }
      : { name: '', label: '' }
  );
  const [fecha] = useState(initialData?.posting_date || new Date().toISOString().split('T')[0]);
  const [billNo, setBillNo] = useState('');
  const [filas, setFilas] = useState([FILA_VACIA()]);
  const [notas, setNotas] = useState(initialData?.remarks || '');
  const [ajuste, setAjuste] = useState(String(initialData?.rounding_adjustment || ''));
  const [ajusteManual, setAjusteManual] = useState(false);
  const [ivaOverride, setIvaOverride] = useState('');
  const [ivaManual, setIvaManual] = useState(false);
  const [iepsOverride, setIepsOverride] = useState('');
  const [iepsManual, setIepsManual] = useState(false);
  const [subtotalIva16Override, setSubtotalIva16Override] = useState('');
  const [subtotalIva16Manual, setSubtotalIva16Manual] = useState(false);
  const [subtotalIepsOverride, setSubtotalIepsOverride] = useState('');
  const [subtotalIepsManual, setSubtotalIepsManual] = useState(false);
  const [subtotalTasa0Override, setSubtotalTasa0Override] = useState('');
  const [subtotalTasa0Manual, setSubtotalTasa0Manual] = useState(false);
  const [margen, setMargen] = useState(String(MARGEN_DEFAULT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });

  // Modal de sugerencia post-confirmación
  const [cambiosPendientes, setCambiosPendientes] = useState(null); // null = oculto
  const [pdfData, setPdfData] = useState(null);

  const IMPUESTOS = comprasService.getImpuestos();
  const margenNum = parseFloat(margen) || 0;

  // ── Carga borrador existente ──────────────────────────────────────────────
  useEffect(() => {
    if (!initialData?.name) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const doc = await comprasService.getCompraBorrador(initialData.name);
        setProveedor({ name: doc.supplier, label: doc.supplier_name || doc.supplier });
        if (doc.supplier_delivery_note) setBillNo(doc.supplier_delivery_note);
        if (doc.remarks) setNotas(doc.remarks);

        if (doc.taxes?.length) {
          const redondeo = doc.taxes.find(t =>
            t.account_head === 'AJUSTE POR REDONDEO - PG' ||
            t.description?.toLowerCase().includes('redondeo')
          );
          const savedAjuste = redondeo ? redondeo.tax_amount : 0;
          setAjuste(String(savedAjuste));
          setAjusteManual(Math.abs(savedAjuste) > 0.005);

          const ivaEntry = doc.taxes.find(t =>
            t.description?.includes('IVA') || t.account_head?.includes('IVA ACREDITABLE')
          );
          const iepsEntry = doc.taxes.find(t =>
            t.description?.includes('IEPS') || t.account_head?.includes('IEPS')
          );
          if (ivaEntry) { setIvaOverride(String(ivaEntry.tax_amount)); setIvaManual(true); }
          if (iepsEntry) { setIepsOverride(String(iepsEntry.tax_amount)); setIepsManual(true); }
        } else if (doc.rounding_adjustment) {
          setAjuste(String(doc.rounding_adjustment));
          setAjusteManual(Math.abs(doc.rounding_adjustment) > 0.005);
        }

        if (doc.items?.length) {
          const codes = [...new Set(doc.items.map(i => i.item_code))];
          const catItems = await comprasService.getItemsCatalogo(codes);
          const dict = {};
          catItems.forEach(it => { dict[it.item_code] = it; });

          setFilas(doc.items.map(i => {
            const imp = parseImpuesto(i.description || '');
            const m = dict[i.item_code] || {};
            return {
              _id: Math.random(),
              item_code: i.item_code || '',
              item_name: i.item_name || '',
              uom: i.uom || '',
              bultos: i.qty != null ? String(i.qty) : '',
              rate: i.rate != null ? String(i.rate) : '',
              precio_catalogo: m.custom_precio_de_compra != null ? String(m.custom_precio_de_compra) : '',
              kg_por_bulto: m.custom_cantidad_por_presentación || '',
              precio_por_kg: m.custom_precio_por_kg || '',
              impuesto_key: imp.key,
              impuesto_label: imp.label,
              impuesto_rate: imp.rate,
            };
          }));
        } else {
          setFilas([FILA_VACIA()]);
        }
      } catch (err) {
        setError('Error al cargar el borrador: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [initialData]);

  // ── CRUD de filas ─────────────────────────────────────────────────────────
  const agregarFila = () => setFilas(f => [...f, FILA_VACIA()]);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };
  const moverFila = (id, dir) => setFilas(f => {
    const i = f.findIndex(r => r._id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= f.length) return f;
    const copia = [...f];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
  });
  const updateFila = (id, campo, valor) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, [campo]: valor } : r));
  const handleImpuesto = (id, key) => {
    const imp = IMPUESTOS.find(i => i.key === key);
    setFilas(f => f.map(r => r._id === id
      ? { ...r, impuesto_key: imp.key, impuesto_label: imp.label, impuesto_rate: imp.rate }
      : r
    ));
  };

  // ── Totales ───────────────────────────────────────────────────────────────
  const totales = filas.reduce((acc, fila) => {
    const base = subtotalFila(fila);
    const imp = base * parseFloat(fila.impuesto_rate || 0);
    acc.subtotal += base;
    if (fila.impuesto_key === 'iva16') { acc.iva += imp; acc.subtotalIva16 += base; }
    else if (fila.impuesto_key === 'ieps') { acc.ieps += imp; acc.subtotalIeps += base; }
    else { acc.subtotalTasa0 += base; }
    return acc;
  }, { subtotal: 0, iva: 0, ieps: 0, subtotalIva16: 0, subtotalTasa0: 0, subtotalIeps: 0 });

  // Overrides manuales de IVA/IEPS
  const ivaEfectivo = (ivaManual && totales.iva > 0) ? parseFloat(ivaOverride || 0) : totales.iva;
  const iepsEfectivo = (iepsManual && totales.ieps > 0) ? parseFloat(iepsOverride || 0) : totales.ieps;
  totales.iva = ivaEfectivo;
  totales.ieps = iepsEfectivo;

  // Overrides de subtotales por tipo — fuente de verdad para el Subtotal
  const subtotalIva16Calc = totales.subtotalIva16;
  const subtotalIepsCalc  = totales.subtotalIeps;
  const subtotalTasa0Calc = totales.subtotalTasa0;
  totales.subtotalIva16 = subtotalIva16Manual ? parseFloat(subtotalIva16Override || 0) : subtotalIva16Calc;
  totales.subtotalIeps  = subtotalIepsManual  ? parseFloat(subtotalIepsOverride  || 0) : subtotalIepsCalc;
  totales.subtotalTasa0 = subtotalTasa0Manual ? parseFloat(subtotalTasa0Override || 0) : subtotalTasa0Calc;

  // Subtotal SIEMPRE = suma de los tres componentes — no tiene override propio
  const subtotalCalc    = totales.subtotal; // sum original de items (lo que ERPNext guarda)
  const subtotalEfectivo = totales.subtotalIva16 + totales.subtotalIeps + totales.subtotalTasa0;
  const subtotalDiff    = subtotalEfectivo - subtotalCalc; // diferencia → va al ajuste ERPNext
  totales.subtotal      = subtotalEfectivo;

  // Total = Subtotal + IVA + IEPS [+ ajuste SAT]
  const rawTotal = subtotalEfectivo + ivaEfectivo + iepsEfectivo;
  const ajusteSAT = Math.round((Math.round(rawTotal * 100) / 100 - rawTotal) * 1e6) / 1e6;
  const ajusteEfectivo = ajusteManual ? parseFloat(ajuste || 0) : ajusteSAT;
  const ajusteParaErp  = ajusteEfectivo + subtotalDiff;
  totales.total = rawTotal + ajusteEfectivo;

  // ── Validaciones ─────────────────────────────────────────────────────────
  const validar = () => {
    if (!proveedor.name) { setError('Selecciona un proveedor'); return null; }
    const validos = filas.filter(f => f.item_code && parseFloat(f.bultos) > 0 && parseFloat(f.rate) >= 0);
    if (!validos.length) { setError('Agrega al menos un producto con cantidad y precio'); return null; }
    return validos.map(f => ({ ...f, qty: f.bultos }));
  };

  const validarAjuste = () => {
    if (Math.abs(ajusteEfectivo) > 100) {
      setErrorModal({ isOpen: true, message: 'EL AJUSTE DE BALANCE NO PUEDE SER MAYOR A $100.00. Verifica que los precios de los productos estén correctos.' });
      return null;
    }
    return ajusteParaErp;
  };

  /**
   * Valida que ninguna fila supere el margen configurado.
   * Retorna null si hay violaciones (y muestra el error), o el array limpio si todo está bien.
   */
  const validarMargen = (items) => {
    const violaciones = items.filter(f => {
      const v = calcVariacion(f);
      return v && Math.abs(v.diff) > margenNum;
    });
    if (violaciones.length > 0) {
      const lista = violaciones.map(f => {
        const v = calcVariacion(f);
        return `• ${f.item_name}: catálogo $${fmt(v.catalogo)} → compra $${fmt(v.actual)} (diff $${fmt(Math.abs(v.diff))})`;
      }).join('\n');
      setErrorModal({
        isOpen: true,
        message: `La variación de precio supera el margen configurado de $${fmt(margenNum)}. Revisa los siguientes productos:\n\n${lista}`,
      });
      return null;
    }
    return items;
  };

  // ── Guardar borrador ──────────────────────────────────────────────────────
  const handleBorrador = async () => {
    setError('');
    const items = validar(); if (!items) return;
    const ajusteNum = validarAjuste(); if (ajusteNum === null) return;
    const taxOverrides = {
      ...(ivaManual && totales.iva > 0 ? { iva16: parseFloat(ivaOverride || 0) } : {}),
      ...(iepsManual && totales.ieps > 0 ? { ieps: parseFloat(iepsOverride || 0) } : {}),
    };
    const subtotalOverrides = {
      iva16: totales.subtotalIva16,
      ieps:  totales.subtotalIeps,
      tasa0: totales.subtotalTasa0,
    };
    setLoading(true);
    try {
      let docNoCompra = null;
      if (esEdicion) {
        await comprasService.actualizarBorrador(initialData.name, {
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides,
        });
        setSuccess('BORRADOR ACTUALIZADO');
        docNoCompra = initialData.custom_no_de_compra ?? null;
      } else {
        const doc = await comprasService.guardarBorrador({
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides,
        });
        setSuccess(`BORRADOR GUARDADO: ${doc.name}`);
        docNoCompra = doc?.custom_no_de_compra ?? null;
      }
      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      setPdfData({
        noCompra: docNoCompra,
        noFactura: billNo,
        fecha,
        hora,
        proveedor: proveedor.label,
        filas: items,
        totales,
        ajuste: ajusteEfectivo,
        esBorrador: true,
      });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Confirmar compra ──────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    setError('');
    const items = validar(); if (!items) return;
    const ajusteNum = validarAjuste(); if (ajusteNum === null) return;
    const itemsOk = validarMargen(items); if (!itemsOk) return;
    const taxOverrides = {
      ...(ivaManual && totales.iva > 0 ? { iva16: parseFloat(ivaOverride || 0) } : {}),
      ...(iepsManual && totales.ieps > 0 ? { ieps: parseFloat(iepsOverride || 0) } : {}),
    };
    const subtotalOverrides = {
      iva16: totales.subtotalIva16,
      ieps:  totales.subtotalIeps,
      tasa0: totales.subtotalTasa0,
    };

    setLoading(true);
    try {
      if (esEdicion) {
        await comprasService.actualizarBorrador(initialData.name, {
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides,
        });
        await comprasService.confirmarBorrador(initialData.name);
      } else {
        await comprasService.registrarCompra({
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides,
        });
      }
      setSuccess(`✅ Compra confirmada. Total: $${fmt(totales.total)}`);

      // ¿Hay precios que cambiaron? → mostrar modal de sugerencia primero
      const conCambio = itemsOk.filter(f => calcVariacion(f)?.cambio);
      if (conCambio.length > 0) {
        setCambiosPendientes(conCambio);
      } else {
        onSuccess?.();
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Actualizar precios en catálogo (desde sugerencia) ────────────────────
  const handleActualizarCatalogo = async (seleccionados) => {
    setCambiosPendientes(null);
    if (seleccionados.length > 0) {
      try {
        await Promise.all(
          seleccionados.map(f => {
            const kgPorBulto = parseFloat(f.kg_por_bulto || 0);
            const nuevoPrecio = parseFloat(f.rate);
            const nuevoPrecioPorKg = kgPorBulto > 0
              ? parseFloat((nuevoPrecio / kgPorBulto).toFixed(6))
              : null;
            return comprasService.actualizarPrecioCatalogo(f.item_code, nuevoPrecio, nuevoPrecioPorKg);
          })
        );
      } catch (err) {
        console.error('Error actualizando catálogo:', err);
      }
    }
    onSuccess?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="nc-modal">
      <ModalError
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
      />

      {/* Modal sugerencia actualización de precios */}
      {cambiosPendientes && (
        <ModalSugerenciaPrecios
          cambios={cambiosPendientes}
          onAceptar={handleActualizarCatalogo}
          onOmitir={() => {
            setCambiosPendientes(null);
            onSuccess?.();
          }}
        />
      )}

      {/* Modal recibo PDF */}
      {pdfData && (
        <ModalReciboPDF
          datos={pdfData}
          onClose={() => { setPdfData(null); onSuccess?.(); }}
        />
      )}

      <div className="nc-container">
        <div className="nc-header">
          <h2>
            {esEdicion
              ? `Editar Compra ${initialData.custom_no_de_compra ? '#' + initialData.custom_no_de_compra : ''}`
              : 'Registrar Compra'}
          </h2>
          <button className="nc-btn-close" onClick={onCancel}>×</button>
        </div>

        {error && <div className="nc-alert nc-alert-error">{error}</div>}
        {success && <div className="nc-alert nc-alert-success">{success}</div>}

        {/* Fila superior */}
        <div className="nc-top-row">
          <div className="nc-field nc-field-proveedor">
            <label>Proveedor *</label>
            <BuscadorProveedor value={proveedor} onChange={setProveedor} />
          </div>
          <div className="nc-field nc-factura">
            <label>No. Factura</label>
            <input type="text" className="nc-input-factura" value={billNo}
              onChange={e => setBillNo(e.target.value)} placeholder="Ej: FAC-001" />
          </div>
          <div className="nc-field nc-fecha">
            <label>Fecha</label>
            <input type="date" value={fecha} readOnly />
          </div>
        </div>

        {/* Tabla */}
        <p className="nc-section-title">Productos recibidos</p>
        <div className="nc-tabla-scroll">
          <table className="nc-tabla">
            <colgroup>
              <col className="col-mover" />
              <col className="col-producto" />
              <col className="col-cantidad" />
              <col className="col-cantidad" />
              <col className="col-cantidad" />
              <col className="col-precio-fijo" />
              <col className="col-precio-compra" />
              <col className="col-diferencia" />
              <col className="col-impuesto" />
              <col className="col-subtotal" />
              <col className="col-acciones" />
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Por empaque</th>
                <th>Total</th>
                <th>Precio de Catálogo</th>
                <th>Precio de compra</th>
                <th>Diferencia</th>
                <th>Impuesto</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => (
                <FilaProducto
                  key={fila._id} fila={fila} impuestos={IMPUESTOS}
                  margen={margenNum}
                  rowIdx={idx}
                  onChange={(campo, valor) => updateFila(fila._id, campo, valor)}
                  onImpuesto={(key) => handleImpuesto(fila._id, key)}
                  onEliminar={() => eliminarFila(fila._id)}
                  onMover={(dir) => moverFila(fila._id, dir)}
                  onAddRow={agregarFila}
                  esPrimera={idx === 0}
                  esUltima={idx === filas.length - 1}
                  soloUna={filas.length === 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button className="nc-btn-agregar" onClick={agregarFila}>+ Agregar producto</button>

        {/* Resumen */}
        <div className="nc-resumen-box">
          {(subtotalIva16Calc > 0 || subtotalIva16Manual) && <div className="nc-resumen-fila nc-resumen-base">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Subtotal IVA 16%
              {subtotalIva16Manual
                ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span>
                : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {subtotalIva16Manual && (
                <button className="nc-btn-reset-ajuste"
                  onClick={() => { setSubtotalIva16Override(''); setSubtotalIva16Manual(false); }}
                  title="Restaurar calculado">↺</button>
              )}
              <input type="number" className="nc-input-ajuste"
                value={subtotalIva16Manual ? subtotalIva16Override : subtotalIva16Calc.toFixed(2)}
                onChange={e => { setSubtotalIva16Override(e.target.value); setSubtotalIva16Manual(true); }}
                step="0.01" />
            </div>
          </div>}
          {(subtotalIepsCalc > 0 || subtotalIepsManual) && <div className="nc-resumen-fila nc-resumen-base">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Subtotal IEPS 8%
              {subtotalIepsManual
                ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span>
                : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {subtotalIepsManual && (
                <button className="nc-btn-reset-ajuste"
                  onClick={() => { setSubtotalIepsOverride(''); setSubtotalIepsManual(false); }}
                  title="Restaurar calculado">↺</button>
              )}
              <input type="number" className="nc-input-ajuste"
                value={subtotalIepsManual ? subtotalIepsOverride : subtotalIepsCalc.toFixed(2)}
                onChange={e => { setSubtotalIepsOverride(e.target.value); setSubtotalIepsManual(true); }}
                step="0.01" />
            </div>
          </div>}
          {(subtotalTasa0Calc > 0 || subtotalTasa0Manual) && <div className="nc-resumen-fila nc-resumen-base">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Subtotal IVA 0%
              {subtotalTasa0Manual
                ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span>
                : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {subtotalTasa0Manual && (
                <button className="nc-btn-reset-ajuste"
                  onClick={() => { setSubtotalTasa0Override(''); setSubtotalTasa0Manual(false); }}
                  title="Restaurar calculado">↺</button>
              )}
              <input type="number" className="nc-input-ajuste"
                value={subtotalTasa0Manual ? subtotalTasa0Override : subtotalTasa0Calc.toFixed(2)}
                onChange={e => { setSubtotalTasa0Override(e.target.value); setSubtotalTasa0Manual(true); }}
                step="0.01" />
            </div>
          </div>}
          <div className="nc-resumen-fila">
            <span>Subtotal</span>
            <span className="monto">${fmt(totales.subtotal)}</span>
          </div>
          {totales.iva > 0 && (
            <div className="nc-resumen-fila">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                IVA 16%
                {ivaManual
                  ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span>
                  : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>
                }
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {ivaManual && (
                  <button className="nc-btn-reset-ajuste"
                    onClick={() => { setIvaOverride(''); setIvaManual(false); }}
                    title="Restaurar IVA calculado">↺</button>
                )}
                <input
                  type="number"
                  className="nc-input-ajuste"
                  value={ivaManual ? ivaOverride : totales.iva.toFixed(2)}
                  onChange={e => { setIvaOverride(e.target.value); setIvaManual(true); }}
                  step="0.01"
                />
              </div>
            </div>
          )}
          {totales.ieps > 0 && (
            <div className="nc-resumen-fila">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                IEPS 8%
                {iepsManual
                  ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span>
                  : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>
                }
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {iepsManual && (
                  <button className="nc-btn-reset-ajuste"
                    onClick={() => { setIepsOverride(''); setIepsManual(false); }}
                    title="Restaurar IEPS calculado">↺</button>
                )}
                <input
                  type="number"
                  className="nc-input-ajuste"
                  value={iepsManual ? iepsOverride : totales.ieps.toFixed(2)}
                  onChange={e => { setIepsOverride(e.target.value); setIepsManual(true); }}
                  step="0.01"
                />
              </div>
            </div>
          )}
          <div className="nc-resumen-fila total">
            <span>Total</span><span className="monto">${fmt(totales.total)}</span>
          </div>
        </div>

        <label className="nc-notas-label">Notas (opcional)</label>
        <textarea className="nc-notas" value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Ej: Remisión #456, condiciones especiales..." />

        <div className="nc-actions">
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="nc-btn-borrador" onClick={handleBorrador} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Precompra'}
          </button>
          <button className="nc-btn-primary" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Confirmando...' : `Confirmar compra ($${fmt(totales.total)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Buscador de proveedor ─────────────────────────────────────────────────────
function BuscadorProveedor({ value, onChange, grande = false }) {
  const [busqueda, setBusqueda] = useState(value.label || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = (texto) => {
    setBusqueda(texto);
    setCursor(-1);
    if (!texto) { onChange({ name: '', label: '' }); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await comprasService.buscarProveedores(texto);
      setSugerencias(res); setAbierto(true);
    }, 500);
  };

  const seleccionar = (prov) => {
    setBusqueda(prov.supplier_name);
    onChange({ name: prov.name, label: prov.supplier_name });
    setAbierto(false);
    setCursor(-1);
  };

  const handleKeyDown = (e) => {
    if (!abierto || !sugerencias.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => { const next = Math.min(c + 1, sugerencias.length - 1); listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' }); return next; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => { const prev = Math.max(c - 1, 0); listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' }); return prev; });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = cursor >= 0 ? cursor : 0;
      if (sugerencias[idx]) seleccionar(sugerencias[idx]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div className="nc-buscador-wrap" ref={wrapRef}>
      <input type="text" className={grande ? 'nc-buscar-input grande' : 'nc-buscar-input'}
        value={busqueda} onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar proveedor..." onFocus={() => sugerencias.length && setAbierto(true)} />
      {abierto && sugerencias.length > 0 && (
        <div className="nc-dropdown" ref={listRef}>
          {sugerencias.map((p, i) => (
            <div key={p.name}
              className={`nc-dropdown-item${i === cursor ? ' nc-dropdown-item--active' : ''}`}
              onMouseDown={() => seleccionar(p)}>
              <div className="d-name">{p.supplier_name}</div>
              <div className="d-sub">{p.supplier_group}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fila de producto ──────────────────────────────────────────────────────────
/**
 * Subcomponente de fila con:
 *  - Autocompletado de producto.
 *  - Campo `rate` editable (precio por empaque).
 *  - Badge de variación de precio en tiempo real.
 *  - Bloqueo visual si la variación supera el margen.
 */
function FilaProducto({ fila, impuestos, margen, rowIdx, onChange, onImpuesto, onEliminar, onMover, onAddRow, esPrimera, esUltima, soloUna }) {
  const [busqueda, setBusqueda] = useState(fila.item_name || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const bultosRef = useRef(null);
  const rateRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    setCursor(-1);
    if (!texto) { onChange('item_code', ''); onChange('item_name', ''); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await comprasService.buscarItems(texto);
      setSugerencias(res); setAbierto(true);
    }, 500);
  };

  const handleItemKeyDown = (e) => {
    if (!abierto || !sugerencias.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => { const next = Math.min(c + 1, sugerencias.length - 1); listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' }); return next; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => { const prev = Math.max(c - 1, 0); listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' }); return prev; });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = cursor >= 0 ? cursor : 0;
      if (sugerencias[idx]) seleccionar(sugerencias[idx]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    onChange('item_code', item.item_code);
    onChange('item_name', item.item_name);
    onChange('uom', item.stock_uom);
    onChange('kg_por_bulto', item.custom_cantidad_por_presentación || '');
    onChange('precio_por_kg', item.custom_precio_por_kg || '');
    const precioCatalogo = item.custom_precio_de_compra || '';
    onChange('precio_catalogo', precioCatalogo);
    if (precioCatalogo) onChange('rate', String(precioCatalogo));
    onImpuesto(item.custom_impuesto || 'tasa0');
    setAbierto(false);
    setCursor(-1);
    setTimeout(() => { bultosRef.current?.focus(); bultosRef.current?.select(); }, 0);
  };

  const focusNextRow = () => {
    const nextTr = document.querySelector(`tr[data-row-idx="${rowIdx + 1}"]`);
    const nextInput = nextTr?.querySelector('.nc-buscar-input');
    if (nextInput) {
      nextInput.focus();
    } else {
      onAddRow?.();
      setTimeout(() => {
        const trs = document.querySelectorAll('tr[data-row-idx]');
        const last = trs[trs.length - 1];
        last?.querySelector('.nc-buscar-input')?.focus();
      }, 50);
    }
  };

  const total = totalPorFila(fila);
  const subtotal = subtotalFila(fila);
  const impMonto = impuestoFila(fila);
  const totalConImp = totalFila(fila);
  const uomLabel = fila.uom || 'unid';

  const variacion = calcVariacion(fila);
  const superaMargen = variacion && margen > 0 && Math.abs(variacion.diff) > margen;

  return (
    <tr className={superaMargen ? 'nc-fila-alerta' : ''} data-row-idx={rowIdx}>

      {/* Mover arriba/abajo */}
      <td>
        <div className="nc-fila-mover">
          <button className="nc-btn-mover" onClick={() => onMover(-1)}
            disabled={esPrimera} title="Mover arriba">▲</button>
          <button className="nc-btn-mover" onClick={() => onMover(1)}
            disabled={esUltima} title="Mover abajo">▼</button>
        </div>
      </td>

      {/* Producto */}
      <td>
        <div className="nc-buscador-wrap" ref={wrapRef}>
          <input className="nc-buscar-input" type="text" value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            onKeyDown={handleItemKeyDown}
            placeholder="Buscar producto..."
            onFocus={() => sugerencias.length && setAbierto(true)} />
          {abierto && sugerencias.length > 0 && (
            <div className="nc-dropdown" ref={listRef}>
              {sugerencias.map((item, i) => (
                <div key={item.item_code}
                  className={`nc-dropdown-item${i === cursor ? ' nc-dropdown-item--active' : ''}`}
                  onMouseDown={() => seleccionar(item)}>
                  <div className="d-name">{item.item_name}</div>
                  <div className="d-sub">{item.item_group} — {item.item_code}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Cantidad (bultos) */}
      <td>
        <input className="nc-input cantidad" type="number" min="0" step="0.01"
          ref={bultosRef}
          value={fila.bultos} onChange={e => onChange('bultos', e.target.value)} placeholder="0"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rateRef.current?.focus(); rateRef.current?.select(); } }} />
      </td>

      {/* Por empaque (kg/unidades del catálogo, readonly) */}
      <td>
        {fila.kg_por_bulto
          ? <span className="nc-catalog-val">{fila.kg_por_bulto} {uomLabel}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      {/* Total (bultos × por empaque) */}
      <td>
        {total > 0
          ? <span className="nc-kg-badge">{Number(total).toFixed(2)} {uomLabel}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      {/* Precio/empaque fijo (catálogo, readonly) */}
      <td>
        {fila.precio_catalogo
          ? <span className="nc-precio-fijo">${parseFloat(fila.precio_catalogo).toFixed(2)}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      {/* Precio de compra (editable) */}
      <td>
        <input
          className={`nc-input precio ${superaMargen ? 'nc-input-alerta' : variacion?.cambio ? 'nc-input-cambiado' : ''}`}
          type="number"
          min="0"
          step="0.000001"
          ref={rateRef}
          value={fila.rate}
          onChange={e => onChange('rate', e.target.value)}
          placeholder="0.00"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusNextRow(); } }}
        />
      </td>

      {/* Diferencia (% y $) */}
      <td className="nc-td-diff">
        {variacion?.cambio ? (
          <span className={`nc-var-badge-sm ${superaMargen
            ? 'nc-var-alerta'
            : variacion.diff > 0 ? 'nc-var-sube' : 'nc-var-baja'
            }`}>
            {variacion.diff > 0 ? '▲' : '▼'}
            {' '}{Math.abs(variacion.pct).toFixed(1)}%
            {' '}(${fmt(Math.abs(variacion.diff))})
            {superaMargen && ' ⚠️'}
          </span>
        ) : (
          <span className="nc-uom-empty">—</span>
        )}
      </td>

      {/* Impuesto */}
      <td>
        <span className={`nc-imp-badge nc-imp-${fila.impuesto_key}`}>
          {fila.impuesto_label || 'Tasa 0'}
          {impMonto > 0 && <> — ${fmt(impMonto)}</>}
        </span>
      </td>

      {/* Total con impuesto */}
      <td><span className="nc-subtotal">${fmt(totalConImp)}</span></td>

      {/* Eliminar */}
      <td>
        <button className="nc-btn-eliminar" onClick={onEliminar}
          disabled={soloUna} title="Eliminar">×</button>
      </td>
    </tr>
  );
}

export { BuscadorProveedor };
export default NuevaCompra;