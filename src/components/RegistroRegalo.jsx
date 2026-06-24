// src/components/RegistroRegalo.jsx
import React, { useState, useRef, useEffect } from 'react';
import { stockService } from '../services/frappeStock';
import { BODEGA_CENTRAL } from '../config/constants';
import { fmtUom } from '../utils/uom';
import { parseErrorFrappe, logError } from '../utils/errorFrappe';
import ModalError from './modals/ModalError';
import ConfirmModal from './modals/ConfirmModal';
import '../styles/RegistroMovimiento.css';

const fmtMXN = n => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const num    = v => parseFloat(v) || 0;

/**
 * Modal para registrar un regalo de proveedor (free goods) como Material Receipt.
 * Captura en la PRESENTACIÓN del artículo (pza/caja…) y su precio por pieza;
 * convierte a base (kg/lt) usando custom_cantidad_por_presentación del item.
 * Así no se repite el bug de meter piezas como si fueran kg.
 * El backend (api.regalos) entra a valuation rate de mercado (no 0) → moving
 * average intacto; contrapartida a cuenta de ingreso en especie.
 */
function RegistroRegalo({ onSuccess, onCancel }) {
  const [almacen, setAlmacen]   = useState(BODEGA_CENTRAL);
  const [almacenes, setAlmacenes] = useState([]);
  // cantPres = base por unidad de presentación (ej. 0.4 kg/pza). pres = etiqueta (PZA).
  const [item, setItem]         = useState({ item_code: '', item_name: '', uom: '', cantPres: 1, pres: '' });
  const [cantidad, setCantidad] = useState('');   // en unidades de presentación (piezas)
  const [precio, setPrecio]     = useState('');   // por pieza
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const [errorModal, setErrorModal] = useState(null);
  const [confirm, setConfirm]   = useState(false);

  useEffect(() => {
    let cancel = false;
    stockService.fetchAllWarehousesInclusive()
      .then(list => { if (!cancel) setAlmacenes(list); })
      .catch(err => logError('Almacenes', err));
    return () => { cancel = true; };
  }, []);

  const seleccionarItem = async (it) => {
    const cantPres = num(it.custom_cantidad_por_presentación) || 1;
    const pres = it.custom_presentación || '';
    setItem({ item_code: it.item_code, item_name: it.item_name, uom: it.stock_uom, cantPres, pres });
    setCantidad('');
    setPrecio('');
    // Pre-fill precio sugerido por pieza = valuation_rate (por base) × base/pieza.
    try {
      const d = await stockService.getRegaloDefaults(it.item_code);
      const rateBase = num(d?.valuation_rate_sugerido);
      if (rateBase > 0) setPrecio((rateBase * cantPres).toFixed(2));
    } catch (err) { logError('Regalo defaults', err); }
  };

  // unidad que se muestra al usuario: presentación si existe, si no el uom base
  const unidad   = item.pres || fmtUom(item.uom) || 'pieza';
  const tienePres = item.cantPres && item.cantPres !== 1;

  const cantNum   = num(cantidad);
  const precNum   = num(precio);
  const qtyBase   = cantNum * item.cantPres;                       // a kg/lt
  const ratePorBase = item.cantPres > 0 ? precNum / item.cantPres : precNum;  // por kg/lt
  const total     = cantNum * precNum;                            // = qtyBase × ratePorBase
  const puedeGuardar = item.item_code && cantNum > 0 && precNum > 0;

  const handleSubmit = () => {
    if (!item.item_code) return setErrorModal({ title: 'Falta producto', message: 'Selecciona el producto regalado.' });
    if (cantNum <= 0)    return setErrorModal({ title: 'Cantidad inválida', message: 'La cantidad debe ser mayor a 0.' });
    if (precNum <= 0)    return setErrorModal({ title: 'Falta precio', message: 'El precio de mercado es obligatorio y mayor a 0 (precio 0 distorsiona el costeo del pan).' });
    setConfirm(true);
  };

  const confirmar = async () => {
    setLoading(true);
    try {
      await stockService.registrarRegalo({
        item_code: item.item_code, qty: qtyBase, valuation_rate: ratePorBase, warehouse: almacen,
      });
      setConfirm(false);
      const lbl = almacenes.find(a => a.name === almacen)?.label || almacen;
      setSuccess(`Regalo registrado en ${lbl}: ${cantNum} ${unidad} de ${item.item_name} (${fmtMXN(total)})`);
      setTimeout(() => onSuccess?.(), 1600);
    } catch (err) {
      setConfirm(false);
      setErrorModal(parseErrorFrappe(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="rm-modal">
      <ModalError isOpen={!!errorModal} title={errorModal?.title} message={errorModal?.message} onClose={() => setErrorModal(null)} />

      {confirm && (
        <ConfirmModal
          title="Confirmar regalo"
          description={<>Se registrará la entrada de <strong>{cantNum} {unidad}</strong> de <strong>{item.item_name}</strong> ({qtyBase.toFixed(3)} {fmtUom(item.uom)}) a <strong>{fmtMXN(precNum)}</strong> por {unidad}.</>}
          subdescription={`Total reconocido como ingreso en especie: ${fmtMXN(total)}. El moving average NO baja (costeo del pan intacto).`}
          confirmLabel="Sí, registrar regalo"
          loadingLabel="Guardando..."
          cancelLabel="Cancelar"
          onConfirm={confirmar}
          onCancel={() => setConfirm(false)}
          loading={loading}
        />
      )}

      <div className="rm-container">
        <div className="rm-header">
          <h2>Registrar Regalo de Proveedor</h2>
          <button className="rm-btn-close" onClick={onCancel}>x</button>
        </div>

        <div className="rm-info-bar">
          <span className="rm-info-chip" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
            Entrada a precio de mercado (Material Receipt)
          </span>
          <span className="rm-info-chip" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
            Contrapartida: ingreso en especie
          </span>
        </div>

        {success && <div className="rm-alert rm-alert-success">{success}</div>}

        <div className="rm-section">
          <label>Almacén destino *</label>
          <select value={almacen} onChange={e => setAlmacen(e.target.value)}>
            {almacenes.map(a => <option key={a.name} value={a.name}>{a.label}</option>)}
          </select>
        </div>

        <div className="rm-section">
          <label>Producto regalado *</label>
          <BuscadorItem value={item.item_name} onSelect={seleccionarItem} />
        </div>

        {/* Captura por pieza/presentación — bonito */}
        <div className="rr-grid">
          <div className="rr-field">
            <label>Cantidad</label>
            <div className="rr-input-unit">
              <input type="number" min="0" step="1" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" />
              <span className="rr-unit">{unidad}</span>
            </div>
          </div>
          <div className="rr-field">
            <label>Precio por {unidad}</label>
            <div className="rr-input-unit">
              <span className="rr-prefix">$</span>
              <input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0.00" />
            </div>
          </div>
        </div>

        {/* Conversión a base — para que el usuario verifique (anti bug bin) */}
        {item.item_code && (cantNum > 0 || precNum > 0) && (
          <div className="rr-conv">
            {tienePres
              ? <>Equivale a <strong>{qtyBase.toFixed(3)} {fmtUom(item.uom)}</strong> · costo <strong>{fmtMXN(ratePorBase)}/{fmtUom(item.uom)}</strong></>
              : <>Costo <strong>{fmtMXN(ratePorBase)}/{fmtUom(item.uom)}</strong></>}
          </div>
        )}

        <div className="rr-total-card">
          <span>Valor del regalo</span>
          <strong>{fmtMXN(total)}</strong>
        </div>

        <div className="rm-actions">
          <button className="rm-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="rm-btn-primary" onClick={handleSubmit} disabled={loading || !puedeGuardar}
            style={!puedeGuardar ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {loading ? 'Guardando...' : 'Registrar Regalo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BuscadorItem({ value, onSelect }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState(value || '');
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    if (!texto) { setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await stockService.buscarItemsTexto(texto);
      setSugerencias(res); setAbierto(true);
    }, 500);
  };

  return (
    <div className="rm-buscador-wrap" ref={wrapRef}>
      <input className="rm-buscador-input" type="text" value={busqueda}
        onChange={e => handleBusqueda(e.target.value)} placeholder="Buscar producto..."
        onFocus={() => sugerencias.length && setAbierto(true)} />
      {abierto && sugerencias.length > 0 && (
        <div className="rm-dropdown">
          {sugerencias.map(it => (
            <div key={it.item_code} className="rm-dropdown-item"
              onMouseDown={() => { setBusqueda(it.item_name); setAbierto(false); onSelect(it); }}>
              <div className="item-name">{it.item_name}</div>
              <div className="item-group">{it.item_group} - {it.item_code}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RegistroRegalo;
