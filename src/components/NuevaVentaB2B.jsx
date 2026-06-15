// src/components/NuevaVentaB2B.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ventasService } from '../services/frappeSales';
import { fmtUom } from '../utils/uom';
import { stockService } from '../services/frappeStock';
import { BODEGA_CENTRAL } from '../config/constants';
import ModalError from './modals/ModalError';
import BuscadorCliente from './BuscadorCliente';
import ModalReciboPDF from './modals/ModalReciboPDF';
import { ocultaMateriaPrima } from '../config/clientesB2B';
import { IMPUESTOS_MAP } from '../config/impuestos';
import '../styles/NuevaCompra.css';

const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: '', item_name: '', uom: '',
  qty: '',               // Cantidad en stock_uom (Kg/Lt/Pza) — peso real
  rate: '',              // Precio por stock_uom (precio por Kg)
  precio_catalogo: '',
  stock: null,           // null=no consultado; number=disponible en stock_uom (Kg)
  stockLoading: false,
  cantidad_por_presentacion: 1,  // Kg por presentación (1 = sin conversión)
  presentacion: '',              // "Bulto", "Caja", etc — etiqueta empaque
  impuesto_key: 'tasa0', impuesto_label: 'Tasa 0', impuesto_rate: 0,
});

const parseImpuesto = (description = '') => {
  if (description.includes('IEPS')) return IMPUESTOS_MAP['ieps'];
  if (description.includes('IVA')) return IMPUESTOS_MAP['iva16'];
  return IMPUESTOS_MAP['tasa0'];
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Sin redondeo intermedio — espejo del flujo NuevaCompra para coincidir con ERPNext.
const subtotalFila = (f) => parseFloat(f.qty || 0) * parseFloat(f.rate || 0);
const impuestoFila = (f) => subtotalFila(f) * parseFloat(f.impuesto_rate || 0);
const totalFila = (f) => subtotalFila(f) + impuestoFila(f);


// ── Componente principal ────────────────────────────────────────────────────
function NuevaVentaB2B({ onSuccess, onCancel, initialData = null }) {
  const esEdicion = !!initialData;

  const [cliente, setCliente] = useState(
    initialData
      ? { name: initialData.customer, label: initialData.customer_name || initialData.customer }
      : { name: '', label: '' }
  );
  const [fecha] = useState(initialData?.posting_date || new Date().toISOString().split('T')[0]);
  const [filas, setFilas] = useState([FILA_VACIA()]);
  const [notas, setNotas] = useState(initialData?.remarks || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const [pdfData, setPdfData] = useState(null);
  // IVA/IEPS se jalan del catálogo (custom_impuesto del item) — fuente única de verdad.
  // No editable en venta B2B; cambios viajan vía actualización de catálogo desde Compras.
  const IMPUESTOS = ventasService.getImpuestos();

  // ── Carga borrador existente ────────────────────────────────────────────
  useEffect(() => {
    if (!initialData?.name) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const doc = await ventasService.getVentaBorrador(initialData.name);
        setCliente({ name: doc.customer, label: doc.customer_name || doc.customer });
        if (doc.remarks) setNotas(doc.remarks);

        if (doc.items?.length) {
          // Fetch catálogo para rehidratar cantidad_por_presentación + presentación
          const codes = [...new Set(doc.items.map(i => i.item_code).filter(Boolean))];
          const catFields = ['item_code', 'custom_cantidad_por_presentación', 'custom_presentación', 'stock_uom'];
          const catParams = new URLSearchParams({
            fields: JSON.stringify(catFields),
            filters: JSON.stringify([['name', 'in', codes]]),
            limit_page_length: 100,
          });
          let dict = {};
          try {
            const catRes = await fetch('/api/resource/Item?' + catParams, { credentials: 'include' });
            const catData = await catRes.json();
            (catData?.data || []).forEach(it => { dict[it.item_code] = it; });
          } catch (e) {
            console.warn('No se pudo rehidratar catálogo:', e);
          }

          const filasRehidratadas = doc.items.map(i => {
            const imp = parseImpuesto(i.description || '');
            const m = dict[i.item_code] || {};
            const cantPres = parseFloat(m.custom_cantidad_por_presentación) || 1;
            // El doc guarda qty y rate en unidad base → se leen directo, sin convertir.
            return {
              _id: Math.random(),
              item_code: i.item_code || '',
              item_name: i.item_name || '',
              uom: i.uom || m.stock_uom || '',
              qty: String(parseFloat(i.qty) || 0),
              rate: String(parseFloat(i.rate) || 0),
              precio_catalogo: '',
              cantidad_por_presentacion: cantPres,
              presentacion: m.custom_presentación || '',
              stock: null,
              stockLoading: true,
              impuesto_key: imp.key,
              impuesto_label: imp.label,
              impuesto_rate: imp.rate,
            };
          });
          setFilas(filasRehidratadas);

          // Fetch stock Bodega Central para cada item rehidratado.
          const resultados = await Promise.allSettled(
            filasRehidratadas.map(async (f) => {
              try {
                const bin = await stockService.getStockBin(f.item_code, BODEGA_CENTRAL);
                const stockEnUnidad = parseFloat(bin?.actual_stock || 0) * f.cantidad_por_presentacion;
                updateFila(f._id, { stock: stockEnUnidad, stockLoading: false, ...(stockEnUnidad <= 0 ? { qty: '' } : {}) });
              } catch (err) {
                console.error("Error fetch stock:", err);
                updateFila(f._id, { stock: null, stockLoading: false });
              }
            })
          );
          // Construir mapa id → stock (todas resueltas, sin errores silenciosos)
          const stockMap = Object.fromEntries(
            resultados
              .filter(r => r.status === 'fulfilled')
              .map(r => [r.value.id, r.value.stock])
          );
          // UN SOLO setFilas → UN SOLO render
          setFilas(prev =>
            prev.map(r =>
              r._id in stockMap
                ? { ...r, stock: stockMap[r._id], stockLoading: false }
                : r
            )
          );
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

  // ── CRUD filas ──────────────────────────────────────────────────────────
  const agregarFila = useCallback(() => setFilas(f => [...f, FILA_VACIA()]), []);

  const inputRefs = useRef([]);

  const focusRow = useCallback((idx) => {
    if (idx < filas.length) {
      inputRefs.current[idx]?.focus();
    } else {
      agregarFila();
    }
  }, [agregarFila, filas.length]);

  useEffect(() => {
    if (filas.length > 1) {
      inputRefs.current[filas.length - 1]?.focus();
    }
  }, [filas.length]);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };
  const moverFila = (id, dir) => setFilas(f => {
    const i = f.findIndex(r => r._id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= f.length) return f;
    const copia = [...f];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
  });
  const updateFila = (id, campos) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, ...campos } : r));
  const handleImpuesto = (id, key) => {
    // Si key viene de catálogo y no está en lista filtrada (ej. 'ieps' filtrado en venta B2B), cae a tasa0.
    const imp = IMPUESTOS.find(i => i.key === key) || IMPUESTOS.find(i => i.key === 'tasa0');
    if (!imp) return;
    setFilas(f => f.map(r => r._id === id
      ? { ...r, impuesto_key: imp.key, impuesto_label: imp.label, impuesto_rate: imp.rate }
      : r
    ));
  };

  // ── Totales (todos automáticos — sin overrides fiscales en venta B2B) ──
  const totales = filas.reduce((acc, fila) => {
    const base = subtotalFila(fila);
    const imp = base * parseFloat(fila.impuesto_rate || 0);
    acc.subtotal += base;
    if (fila.impuesto_key === 'iva16') { acc.iva += imp; acc.subtotalIva16 += base; }
    else if (fila.impuesto_key === 'ieps') { acc.ieps += imp; acc.subtotalIeps += base; }
    else { acc.subtotalTasa0 += base; }
    return acc;
  }, { subtotal: 0, iva: 0, ieps: 0, subtotalIva16: 0, subtotalIeps: 0, subtotalTasa0: 0 });

  // AjusteSAT auto = redondeo a 2 decimales (matemática, no fiscal)
  const rawTotal = totales.subtotal + totales.iva + totales.ieps;
  const ajusteSAT = Math.round((Math.round(rawTotal * 100) / 100 - rawTotal) * 1e6) / 1e6;
  totales.total = rawTotal + ajusteSAT;

  // ── Validaciones ────────────────────────────────────────────────────────
  const validar = () => {
    if (!cliente.name) { setError('Selecciona un cliente'); return null; }
    const validos = filas.filter(f => f.item_code && parseFloat(f.qty) > 0 && parseFloat(f.rate) >= 0);
    if (!validos.length) { setError('Agrega al menos un producto con cantidad y precio'); return null; }
    // Stock disponible Bodega Central — agrupa por item para sumar filas duplicadas.
    const agregado = {};
    validos.forEach(f => {
      if (!agregado[f.item_code]) agregado[f.item_code] = { item_name: f.item_name, uom: f.uom, stock: f.stock, qty: 0 };
      agregado[f.item_code].qty += parseFloat(f.qty || 0);
    });
    const sinStock = Object.values(agregado).filter(a => a.stock != null && a.qty > parseFloat(a.stock));
    if (sinStock.length) {
      const lista = sinStock.map(a =>
        `• ${a.item_name}: pides ${a.qty.toFixed(2)} ${a.uom || ''}, hay ${a.stock} ${a.uom || ''}`
      ).join('\n');
      setErrorModal({
        isOpen: true,
        message: `Stock insuficiente en Bodega Central:\n\n${lista}`,
      });
      return null;
    }
    return validos;
  };

  /**
   * Convierte items del UI (qty en Kg, rate por Kg) → payload ERPNext (qty en
   * presentación natural, rate por presentación). Total qty×rate se preserva.
   */
  // La venta se registra en unidad base: qty y rate van directo, sin convertir a
  // presentación (el stock vive en base y se descuenta así del Bin).
  const itemsPayload = (items) => items.map(f => ({
    ...f,
    qty: parseFloat(f.qty || 0),
    rate: parseFloat(f.rate || 0),
  }));

  const buildPayloadCommon = (items) => ({
    customer: cliente.name,
    fecha,
    items: itemsPayload(items),
    notas,
    ajuste: ajusteSAT,
    taxOverrides: {},
    subtotalOverrides: {
      iva16: totales.subtotalIva16,
      ieps: totales.subtotalIeps,
      tasa0: totales.subtotalTasa0,
    },
  });

  // ── Guardar borrador ────────────────────────────────────────────────────
  const handleBorrador = async () => {
    setError('');
    const items = validar(); if (!items) return;
    setLoading(true);
    try {
      let docNoVenta = null;
      if (esEdicion) {
        await ventasService.actualizarBorrador(initialData.name, buildPayloadCommon(items));
        setSuccess('BORRADOR ACTUALIZADO');
        docNoVenta = initialData.custom_no_de_venta ?? null;
      } else {
        const doc = await ventasService.guardarBorrador(buildPayloadCommon(items));
        setSuccess(`BORRADOR GUARDADO: ${doc.name}`);
        docNoVenta = doc?.custom_no_de_venta ?? null;
      }
      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      setPdfData({
        noVenta: docNoVenta,
        fecha,
        hora,
        cliente: cliente.label,
        filas: items,
        totales,
        ajuste: ajusteSAT,
        esBorrador: true,
      });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Confirmar venta ─────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    setError('');
    const items = validar(); if (!items) return;
    setLoading(true);
    try {
      if (esEdicion) {
        await ventasService.actualizarBorrador(initialData.name, buildPayloadCommon(items));
        await ventasService.confirmarBorrador(initialData.name);
      } else {
        await ventasService.registrarVenta(buildPayloadCommon(items));
      }
      setSuccess(`✅ Venta confirmada. Total: $${fmt(totales.total)}`);
      onSuccess?.();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="nc-modal">
      <ModalError
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
      />

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
              ? `Editar Venta ${initialData.custom_no_de_venta ? '#' + initialData.custom_no_de_venta : ''}`
              : 'Registrar Venta B2B'}
          </h2>
          <button className="nc-btn-close" onClick={onCancel}>×</button>
        </div>

        {error && <div className="nc-alert nc-alert-error">{error}</div>}
        {success && <div className="nc-alert nc-alert-success">{success}</div>}

        <div className="nc-top-row">
          <div className="nc-field nc-field-proveedor">
            <label>Cliente *</label>
            <BuscadorCliente value={cliente} onChange={setCliente} />
          </div>
          <div className="nc-field nc-fecha">
            <label>Fecha</label>
            <input type="date" value={fecha} readOnly />
          </div>
        </div>

        <p className="nc-section-title">Productos a vender</p>
        <div className="nc-tabla-scroll">
          <table className="nc-tabla">
            <colgroup>
              <col style={{ width: '32%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock disp.</th>
                <th>Cantidad</th>
                <th>Stock final</th>
                <th>Precio venta</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => {
                // Cascade: cada fila parte del stock final de la anterior con mismo item.
                // F1 ve raw; F2 ve (raw - qtyF1); F3 ve (raw - qtyF1 - qtyF2).
                const reservadoOtras = filas.slice(0, idx).reduce((acc, r) =>
                  r.item_code === fila.item_code
                    ? acc + (parseFloat(r.qty) || 0) : acc, 0);
                return (
                  <FilaProducto
                    key={fila._id}
                    fila={fila}
                    impuestos={IMPUESTOS}
                    rowIdx={idx}
                    reservadoOtras={reservadoOtras}
                    onChange={(campos) => updateFila(fila._id, campos)}
                    onImpuesto={(key) => handleImpuesto(fila._id, key)}
                    onEliminar={() => eliminarFila(fila._id)}
                    onAddRow={agregarFila}
                    soloUna={filas.length === 1}
                    bloqueaMP={ocultaMateriaPrima(cliente.name)}
                    inputRef={(el) => { inputRefs.current[idx] = el; }}
                    onFocusNext={() => focusRow(idx + 1)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <button className="nc-btn-agregar" onClick={agregarFila}>+ Agregar producto</button>

        <div className="nc-resumen-box">
          {totales.subtotalIva16 > 0 && (
            <div className="nc-resumen-fila nc-resumen-base">
              <span>Subtotal IVA 16%</span>
              <span className="monto">${fmt(totales.subtotalIva16)}</span>
            </div>
          )}
          {totales.subtotalIeps > 0 && (
            <div className="nc-resumen-fila nc-resumen-base">
              <span>Subtotal IEPS 8%</span>
              <span className="monto">${fmt(totales.subtotalIeps)}</span>
            </div>
          )}
          {totales.subtotalTasa0 > 0 && (
            <div className="nc-resumen-fila nc-resumen-base">
              <span>Subtotal IVA 0%</span>
              <span className="monto">${fmt(totales.subtotalTasa0)}</span>
            </div>
          )}
          <div className="nc-resumen-fila">
            <span>Subtotal</span>
            <span className="monto">${fmt(totales.subtotal)}</span>
          </div>
          {totales.iva > 0 && (
            <div className="nc-resumen-fila">
              <span>IVA 16%</span>
              <span className="monto">${fmt(totales.iva)}</span>
            </div>
          )}
          {totales.ieps > 0 && (
            <div className="nc-resumen-fila">
              <span>IEPS 8%</span>
              <span className="monto">${fmt(totales.ieps)}</span>
            </div>
          )}
          <div className="nc-resumen-fila total">
            <span>Total</span><span className="monto">${fmt(totales.total)}</span>
          </div>
        </div>

        <label className="nc-notas-label">Notas (opcional)</label>
        <textarea className="nc-notas" value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Ej: Pedido especial, entrega en domicilio..." />

        <div className="nc-actions">
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="nc-btn-borrador" onClick={handleBorrador} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Preventa'}
          </button>
          <button className="nc-btn-primary" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Confirmando...' : `Confirmar venta ($${fmt(totales.total)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de producto ────────────────────────────────────────────────────────
function FilaProducto({ fila, impuestos, rowIdx, reservadoOtras = 0, onChange, onImpuesto, onEliminar, onAddRow, soloUna, bloqueaMP, inputRef, onFocusNext }) {
  const [busqueda, setBusqueda] = useState(fila.item_name || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const qtyRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    setCursor(-1);
    if (!texto) { onChange({ item_code: '', item_name: '' }); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await ventasService.buscarItems(texto);
      // PUERTA REAL recibe su materia prima por transferencia, no por venta:
      // se oculta del buscador. Otros clientes (DELI, ZAKIA) sí compran MP.
      // Pan terminado (PRODUCTO TERMINADO) se bloquea en B2B hasta tener
      // Price List por canal (precio capturado manual, no calculado).
      const filtrado = res.filter(it => {
        if (it.custom_tipo_item === 'PRODUCTO TERMINADO') return false;
        if (bloqueaMP && it.custom_tipo_item === 'MATERIA PRIMA') return false;
        return true;
      });
      setSugerencias(filtrado); setAbierto(true);
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

  const seleccionar = async (item) => {
    setBusqueda(item.item_name);
    // Conversión presentación → unidad real (Kg/Lt/Pza)
    const cantPres = parseFloat(item.custom_cantidad_por_presentación) || 1;
    // Precio venta B2B = precio de compra (custom_precio_por_kg = precio/Kg).
    // Modelo confirmado 2026-05-20: B2B paga al costo, sin margen. Última compra
    // actualiza precio_por_kg → ventas siguientes al nuevo precio.
    let ratePorUnidad;
    if (item.custom_precio_por_kg) {
      ratePorUnidad = parseFloat(item.custom_precio_por_kg);
    } else if (item.custom_precio_de_venta) {
      ratePorUnidad = parseFloat(item.custom_precio_de_venta) / cantPres;
    } else if (item.standard_rate) {
      ratePorUnidad = parseFloat(item.standard_rate) / cantPres;
    } else {
      ratePorUnidad = 0;
    }
    onChange({
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.stock_uom,
      cantidad_por_presentacion: cantPres,
      presentacion: item.custom_presentación || '',
      precio_catalogo: ratePorUnidad,
      ...(ratePorUnidad > 0 ? { rate: ratePorUnidad.toFixed(6) } : {}),
      stockLoading: true,
    })
    onImpuesto(item.custom_impuesto || 'tasa0');
    setAbierto(false);
    setCursor(-1);
    setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 0);

    // Fetch stock disponible Bodega Central
    try {
      const bin = await stockService.getStockActual(item.item_code, BODEGA_CENTRAL);
      const stockEnUnidad = parseFloat(bin?.actual_qty || 0); // Bin ya en unidad base
      onChange({ stock: stockEnUnidad, stockLoading: false, ...(stockEnUnidad <= 0 ? { qty: '' } : {}) });
    } catch (err) {
      console.error('Error fetch stock:', err);
      onChange({ stock: 0, qty: '', stockLoading: false });
    }
  };

  const totalConImp = totalFila(fila);
  const uomLabel = fmtUom(fila.uom || 'unid');

  const qtyNum = parseFloat(fila.qty || 0);
  // Stock efectivo descuenta lo reservado por otras filas con mismo item.
  const stock = fila.stock != null ? fila.stock - reservadoOtras : null;
  const stockRestante = stock != null ? stock - qtyNum : null;
  const sinStock = stock != null && stock <= 0 && fila.item_code;
  const excedeStock = stockRestante != null && stockRestante < 0;

  return (
    <tr data-row-idx={rowIdx} className={excedeStock ? 'nc-fila-alerta' : ''}>
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

      {/* Stock disponible Bodega Central (snapshot al seleccionar) */}
      <td>
        {!fila.item_code ? (
          <span className="nc-uom-empty">—</span>
        ) : fila.stockLoading ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>...</span>
        ) : sinStock ? (
          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>
            Sin stock
          </span>
        ) : (
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
            {Number(stock).toFixed(2)} {uomLabel}
          </span>
        )}
      </td>

      <td>
        <input className={`nc-input cantidad ${excedeStock ? 'nc-input-alerta' : ''}`}
          type="number" min="0" step="0.01"
          ref={qtyRef}
          value={sinStock ? '' : fila.qty}
          onChange={e => onChange({ qty: e.target.value })}
          placeholder={sinStock ? '—' : '0'}
          disabled={sinStock}
          title={sinStock ? 'Sin stock — elimina la fila' : ''}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFocusNext(); } }} />
        <span style={{ fontSize: 11, color: '#666', marginLeft: 4 }}>{uomLabel}</span>
        {qtyNum > 0 && fila.cantidad_por_presentacion > 1 && fila.presentacion && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            = {(qtyNum / fila.cantidad_por_presentacion).toFixed(2)} {fila.presentacion}
          </div>
        )}
      </td>

      {/* Stock final (= stock disp - cantidad capturada) */}
      <td>
        {!fila.item_code || stock == null ? (
          <span className="nc-uom-empty">—</span>
        ) : sinStock ? (
          <span className="nc-uom-empty">—</span>
        ) : (
          <span style={{
            fontWeight: 700, fontSize: 14,
            color: excedeStock ? '#dc2626' : stockRestante <= (stock * 0.1) ? '#d97706' : '#16a34a',
          }}>
            {Number(stockRestante).toFixed(2)} {uomLabel}
          </span>
        )}
      </td>

      {/* Precio venta — readonly, fuente: catálogo (custom_precio_de_venta, sino standard_rate) */}
      <td>
        {fila.rate
          ? <span className="nc-precio-fijo">${parseFloat(fila.rate).toFixed(2)}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      <td><span className="nc-subtotal">${fmt(totalConImp)}</span></td>

      <td style={{ textAlign: 'center', padding: '0 4px' }}>
        <button className="nc-btn-eliminar" onClick={onEliminar}
          disabled={soloUna} title="Eliminar"
          style={{
            fontSize: 22, fontWeight: 700, lineHeight: 1,
            padding: '4px 10px', minWidth: 32,
          }}>×</button>
      </td>
    </tr>
  );
}

export default NuevaVentaB2B;
