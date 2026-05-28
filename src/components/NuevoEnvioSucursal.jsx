// src/components/NuevoEnvioSucursal.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { stockService } from '../services/frappeStock';
import { fmtUom } from '../utils/uom';
import { BODEGA_CENTRAL } from '../config/constants';
import useSucursales from '../hooks/useSucursales';
import ModalError from './modals/ModalError';
import ModalHojaEntrega from './modals/ModalHojaEntrega';
import { parseErrorFrappe } from '../utils/errorFrappe';
import '../styles/NuevaCompra.css';

const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: '', item_name: '', uom: '',
  qty: '',                       // en stock_uom (Kg/Lt/Pza)
  stock: null,
  stockLoading: false,
  cantidad_por_presentacion: 1,
  presentacion: '',
});

const fmtQty = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Componente principal ────────────────────────────────────────────────────
function NuevoEnvioSucursal({ onSuccess, onCancel, sucursalDefault = null }) {
  const { sucursales_destino: sucursales } = useSucursales();
  const [warehouseDestino, setWarehouseDestino] = useState(sucursalDefault || '');

  // Inicializar warehouse cuando cargue config (si no vino sucursalDefault)
  useEffect(() => {
    if (!warehouseDestino && sucursales.length > 0) {
      setWarehouseDestino(sucursales[0].warehouse);
    }
  }, [sucursales, warehouseDestino]);
  const [fecha] = useState(new Date().toISOString().split('T')[0]);
  const [filas, setFilas] = useState([FILA_VACIA()]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });
  const inputRefs = useRef([]);
  const [hojaData, setHojaData] = useState(null);

  const sucursalLabel = sucursales.find(s => s.warehouse === warehouseDestino)?.label || warehouseDestino;

  // ── CRUD filas ──────────────────────────────────────────────────────────
  const agregarFila = useCallback(() => setFilas(f => [...f, FILA_VACIA()]), []);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };
  const updateFila = (id, campos) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, ...campos } : r));

  const focusRow = useCallback((idx) => {
    if (idx < inputRefs.current.length) {
      inputRefs.current[idx]?.focus();
    } else {
      agregarFila();
    }
  }, [agregarFila]);

  // ── Validación ──────────────────────────────────────────────────────────
  const validar = () => {
    if (!warehouseDestino) {
      setErrorModal({ isOpen: true, title: 'Falta destino', message: 'Selecciona una sucursal de destino.' });
      return null;
    }
    const validos = filas.filter(f => f.item_code && parseFloat(f.qty) > 0);
    if (!validos.length) {
      setErrorModal({ isOpen: true, title: 'Sin productos', message: 'Agrega al menos un producto con cantidad para registrar el envío.' });
      return null;
    }
    const sinStock = validos.filter(f => f.stock != null && parseFloat(f.qty) > parseFloat(f.stock));
    if (sinStock.length) {
      const lista = sinStock.map(f =>
        `• ${f.item_name}: pides ${f.qty} ${f.uom || ''}, hay ${f.stock} ${f.uom || ''}`
      ).join('\n');
      setErrorModal({ isOpen: true, title: 'Stock insuficiente', message: `Bodega Central no tiene suficiente:\n\n${lista}` });
      return null;
    }
    return validos;
  };

  // Convierte UI (qty en Kg/Lt/Pza) → payload (qty en presentación natural)
  const itemsPayload = (items) => items.map(f => {
    const cantPres = parseFloat(f.cantidad_por_presentacion) || 1;
    const qtyKg = parseFloat(f.qty || 0);
    return {
      item_code: f.item_code,
      item_name: f.item_name,
      uom: f.uom,
      qty: cantPres > 0 ? qtyKg / cantPres : qtyKg,
    };
  });

  // ── Confirmar envío ─────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    const items = validar(); if (!items) return;
    setLoading(true);
    try {
      const doc = await stockService.crearTransferenciaSucursal({
        warehouseDestino,
        items: itemsPayload(items),
        fecha,
        notas,
        asBorrador: false,
      });
      setSuccess(`✅ Envío registrado: ${doc.name}`);
      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      setHojaData({
        fecha, hora, sucursalLabel, warehouseDestino,
        filas: items, notas, docName: doc.name,
      });
    } catch (err) {
      setErrorModal({ isOpen: true, ...parseErrorFrappe(err) });
    } finally { setLoading(false); }
  };

  return (
    <div className="nc-modal">
      <ModalError
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
      />

      {hojaData && (
        <ModalHojaEntrega
          datos={hojaData}
          onClose={() => { setHojaData(null); onSuccess?.(); }}
        />
      )}

      <div className="nc-container">
        <div className="nc-header">
          <h2>Nuevo Envío a Sucursal</h2>
          <button className="nc-btn-close" onClick={onCancel}>×</button>
        </div>

        {success && <div className="nc-alert nc-alert-success">{success}</div>}

        <div className="nc-top-row">
          <div className="nc-field nc-field-proveedor">
            <label>Sucursal destino *</label>
            <select className="nc-input" value={warehouseDestino}
              onChange={e => setWarehouseDestino(e.target.value)}>
              {sucursales.map(s => (
                <option key={s.warehouse} value={s.warehouse}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="nc-field nc-fecha">
            <label>Fecha</label>
            <input type="date" value={fecha} readOnly />
          </div>
        </div>

        <p className="nc-section-title">Productos a enviar</p>
        <div className="nc-tabla-scroll">
          <table className="nc-tabla">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock disp.</th>
                <th>Cantidad</th>
                <th>Stock final</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => (
                <FilaEnvio
                  key={fila._id}
                  fila={fila}

                  onChange={(campos) => updateFila(fila._id, campos)}
                  onEliminar={() => eliminarFila(fila._id)}
                  onFocusNext={() => focusRow(idx + 1)}
                  inputRef={el => { inputRefs.current[idx] = el; }}
                  soloUna={filas.length === 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button className="nc-btn-agregar" onClick={agregarFila}>+ Agregar producto</button>

        <label className="nc-notas-label">Notas (opcional)</label>
        <textarea className="nc-notas" value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Ej: Entrega matutina, contiene pedido especial..." />

        <div className="nc-actions">
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="nc-btn-primary" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Enviando...' : 'Confirmar envío'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de envío (sin precios) ─────────────────────────────────────────────
function FilaEnvio({ fila, onChange, onEliminar, onFocusNext, inputRef, soloUna }) {
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
      const res = await stockService.buscarItemsTexto(texto);
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

  const seleccionar = async (item) => {
    const cantPres = parseFloat(item.custom_cantidad_por_presentación) || 1;
    setBusqueda(item.item_name);
    onChange({
      item_code:               item.item_code,
      item_name:               item.item_name,
      uom:                     item.stock_uom,
      cantidad_por_presentacion: cantPres,
      presentacion:            item.custom_presentación || '',
      stockLoading:            true,
    });
    setAbierto(false);
    setCursor(-1);
    setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 0);

    try {
      const bin = await stockService.getStockActual(item.item_code, BODEGA_CENTRAL);
      const qtyNaturalBin = parseFloat(bin?.actual_qty || 0);
      const stockEnUnidad = qtyNaturalBin * cantPres;
      onChange({ stock: stockEnUnidad, stockLoading: false, ...(stockEnUnidad <= 0 ? { qty: '' } : {}) });
    } catch (err) {
      console.error('Error fetch stock:', err);
      onChange({ stock: 0, qty: '', stockLoading: false });
    }
  };


  const uomLabel = fmtUom(fila.uom || 'unid');
  const qtyNum = parseFloat(fila.qty || 0);
  const stock = fila.stock;
  const stockRestante = stock != null ? stock - qtyNum : null;
  const sinStock = stock != null && stock <= 0 && fila.item_code;
  const excedeStock = stockRestante != null && stockRestante < 0;

  return (
    <tr className={excedeStock ? 'nc-fila-alerta' : ''}>
      <td>
        <div className="nc-buscador-wrap" ref={wrapRef}>
          <input className="nc-buscar-input" type="text" value={busqueda}
            ref={inputRef}
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

      <td>
        {!fila.item_code ? (
          <span className="nc-uom-empty">—</span>
        ) : fila.stockLoading ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>...</span>
        ) : sinStock ? (
          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>Sin stock</span>
        ) : (
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
            {fmtQty(stock)} {uomLabel}
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
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFocusNext?.(); } }} />
        <span style={{ fontSize: 11, color: '#666', marginLeft: 4 }}>{uomLabel}</span>
        {qtyNum > 0 && fila.cantidad_por_presentacion > 1 && fila.presentacion && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            = {(qtyNum / fila.cantidad_por_presentacion).toFixed(2)} {fila.presentacion}
          </div>
        )}
      </td>

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
            {fmtQty(stockRestante)} {uomLabel}
          </span>
        )}
      </td>

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

export default NuevoEnvioSucursal;
