// src/components/RegistroSalida.jsx
import React, { useState, useRef, useEffect } from 'react';
import { stockService } from '../services/frappeStock';
import { sanitizar } from '../utils/security';
import { getSucursalesDestino } from '../config/clientesB2B';
import { BODEGA_CENTRAL } from '../config/constants';
import { TENANT } from '../config/tenant';
import { fetchStockMapKg } from '../utils/stockMP';
import { fmtUom } from '../utils/uom';
import { parseErrorFrappe, logError } from '../utils/errorFrappe';
import ModalError from './modals/ModalError';
import '../styles/RegistroMovimiento.css';

const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: '', item_name: '', qty: '', uom: '',
  cantPres: 1, presentacion: '',
});

/**
 * Modal para despachar o enviar mercancías internas (Transferencias/Material Issue).
 * Permite seleccionar hacia qué Sub-Almacén de los Departamentos va dirigida la salida.
 * Cantidad capturada en stock_uom (Kg/Lt/Pza); submit convierte a unidad natural
 * (BULTO/CUBETA) dividiendo por cantidad_por_presentación.
 */
function RegistroSalida({ onSuccess, onCancel }) {
  const [almacenDestino, setAlmacenDestino] = useState('');
  const [filas, setFilas]     = useState([FILA_VACIA()]);
  const [notas, setNotas]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState(null);

  const [grupos, setGrupos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [stockLoaded, setStockLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetchStockMapKg(BODEGA_CENTRAL)
      .then(m => { if (!cancel) { setStockMap(m); setStockLoaded(true); } })
      .catch(err => { logError('Stock origen', err); setStockLoaded(true); });
    Promise.all([
      stockService.fetchAlmacenesAgrupados(),
      stockService.fetchAlmacenes(),
    ])
      .then(([agrup, flat]) => {
        if (cancel) return;
        const exclWh = new Set([
          BODEGA_CENTRAL,
          TENANT.tiendaMatriz,
          ...getSucursalesDestino().map(s => s.warehouse),
        ]);
        const agrupFiltrado = agrup
          .map(g => ({ ...g, almacenes: g.almacenes.filter(a => !exclWh.has(a.name)) }))
          .filter(g => g.almacenes.length > 0);
        setGrupos(agrupFiltrado);
        setAlmacenes(flat.filter(a => !exclWh.has(a.name)));
      })
      .catch(err => logError('Almacenes', err));
    return () => { cancel = true; };
  }, []);

  const agregarFila  = () => setFilas(f => [...f, FILA_VACIA()]);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };
  const actualizarFila = (id, campos) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, ...campos } : r));

  // Cascade: cada fila parte del stock final de la fila ANTERIOR del mismo item.
  // F1 usa raw; F2 usa (raw - qtyF1); F3 usa (raw - qtyF1 - qtyF2); etc.
  // Item con item_code pero sin entrada en stockMap (no hay Bin) = stock 0.
  const filasConStock = filas.map((f, idx) => {
    const info = stockLoaded && f.item_code ? stockMap[f.item_code] : null;
    const stockKg = stockLoaded && f.item_code
      ? (info ? info.stockKg : 0)
      : null;
    const qty = parseFloat(f.qty) || 0;
    const consumidoAntes = filas.slice(0, idx).reduce((acc, r) =>
      r.item_code === f.item_code ? acc + (parseFloat(r.qty) || 0) : acc, 0);
    const stockEfectivo = stockKg != null ? stockKg - consumidoAntes : null;
    const stockFinal = stockEfectivo != null ? stockEfectivo - qty : null;
    const insuficiente = stockEfectivo != null && qty > stockEfectivo;
    return { ...f, stockKg, stockEfectivo, actualNatural: info?.actual ?? null, stockFinal, insuficiente };
  });
  const hayFaltantes = filasConStock.some(f => f.insuficiente);

  const handleSubmit = async () => {
    if (!almacenDestino) {
      setErrorModal({ title: 'Falta destino', message: 'Selecciona el almacén destino antes de continuar.' });
      return;
    }
    const itemsValidos = filasConStock.filter(f => f.item_code && parseFloat(f.qty) > 0);
    if (!itemsValidos.length) {
      setErrorModal({
        title: 'Sin productos',
        message: 'Agrega al menos un producto con cantidad mayor a 0 para registrar la transferencia.',
      });
      return;
    }
    if (hayFaltantes) {
      const det = itemsValidos.filter(f => f.insuficiente)
        .map(f => `${f.item_name} (pide ${f.qty} ${f.uom}, hay ${(f.stockKg ?? 0).toFixed(2)} ${f.uom})`)
        .join('; ');
      setErrorModal({ title: 'Stock insuficiente', message: `Bodega Central no tiene suficiente: ${det}` });
      return;
    }

    setLoading(true);
    try {
      // qty va en stock_uom (Kg/Lt/Pza) con conversion_factor=1 en registrarSalida.
      // ERPNext descuenta del Bin en stock_uom directamente.
      const itemsLimpios = itemsValidos.map(f => ({
        item_code: f.item_code,
        qty: parseFloat(f.qty),
        uom: f.uom,
      }));
      await stockService.registrarSalida({
        almacenDestino, items: itemsLimpios, notas: sanitizar(notas),
      });
      const dest = almacenes.find(a => a.name === almacenDestino)?.label || almacenDestino;
      setSuccess(`Transferencia registrada hacia ${dest}: ${itemsValidos.length} producto(s)`);
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      setErrorModal(parseErrorFrappe(err));
    } finally {
      setLoading(false);
    }
  };

  const totalProductos = filas.filter(f => f.item_code && parseFloat(f.qty) > 0).length;
  const labelDestino   = almacenes.find(a => a.name === almacenDestino)?.label || '';

  return (
    <div className="rm-modal">
      <ModalError
        isOpen={!!errorModal}
        title={errorModal?.title}
        message={errorModal?.message}
        onClose={() => setErrorModal(null)}
      />
      <div className="rm-container salida">
        <div className="rm-header">
          <h2>Registrar Salida / Transferencia</h2>
          <button className="rm-btn-close" onClick={onCancel}>x</button>
        </div>

        <div className="rm-info-bar">
          <span className="rm-info-chip origen">Origen: Bodega Central - Insumos</span>
          {labelDestino && (
            <span className="rm-info-chip destino">Destino: {labelDestino}</span>
          )}
          <span className="rm-info-chip" style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>
            Tipo: Transferencia de Material
          </span>
        </div>

        {success && <div className="rm-alert rm-alert-success">{success}</div>}
        {hayFaltantes && (
          <div className="rm-alert rm-alert-error">
            ⚠ Stock insuficiente en Bodega Central. Revisa filas en rojo.
          </div>
        )}

        <div className="rm-section">
          <label>Almacen destino *</label>
          <select value={almacenDestino} onChange={e => setAlmacenDestino(e.target.value)}>
            <option value="">Selecciona destino...</option>
            {grupos.map(g => (
              <optgroup key={g.tipo} label={g.tipo}>
                {g.almacenes.map(a => (
                  <option key={a.name} value={a.name}>{a.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="rm-tabla-header">
          <span>Productos a transferir</span>
        </div>

        <table className="rm-tabla">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Producto</th>
              <th style={{ width: '17%' }}>Stock disp.</th>
              <th style={{ width: '17%' }}>Cantidad</th>
              <th style={{ width: '17%' }}>Stock final</th>
              <th style={{ width: '14%' }}></th>
            </tr>
          </thead>
          <tbody>
            {filasConStock.map(fila => (
              <FilaProducto
                key={fila._id}
                fila={fila}
                stockLoaded={stockLoaded}
                onChange={(campos) => actualizarFila(fila._id, campos)}
                onEliminar={() => eliminarFila(fila._id)}
                soloUna={filas.length === 1}
              />
            ))}
          </tbody>
        </table>

        <button className="rm-btn-agregar" onClick={agregarFila}>
          + Agregar producto
        </button>

        <div className="rm-section">
          <label>Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Ej: Pedido para produccion del dia..."
          />
        </div>

        <div className="rm-actions">
          <span className="rm-resumen">
            <strong>{totalProductos}</strong> producto(s) para transferir
          </span>
          <button className="rm-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="rm-btn-primary"   onClick={handleSubmit}
            disabled={loading || hayFaltantes}
            style={hayFaltantes ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {loading ? 'Guardando...' : hayFaltantes ? '✕ Stock insuficiente' : 'Confirmar Transferencia'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Fila con buscador + columnas stock/cantidad/stock final (pattern NuevaVentaB2B).
 */
function FilaProducto({ fila, stockLoaded, onChange, onEliminar, soloUna }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto]         = useState(false);
  const [busqueda, setBusqueda]       = useState(fila.item_name || '');
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    if (!texto) { onChange({ item_code: '', item_name: '' }); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await stockService.buscarItemsTexto(texto);
      setSugerencias(res);
      setAbierto(true);
    }, 500);
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    onChange({
      item_code:    item.item_code,
      item_name:    item.item_name,
      uom:          item.stock_uom,
      cantPres:     parseFloat(item.custom_cantidad_por_presentación) || 1,
      presentacion: item.custom_presentación || '',
    });
    setSugerencias([]);
    setAbierto(false);
  };

  const qtyNum = parseFloat(fila.qty) || 0;
  // Idéntico a NuevaVentaB2B: Stock disp = raw - reservadoOtras.
  // Stock final = Stock disp - qty propia.
  const stockMostrar = fila.stockEfectivo;
  const sinStock = fila.item_code && stockLoaded && stockMostrar != null && stockMostrar <= 0;
  const stockFinal = fila.stockFinal;
  const colorFinal = fila.insuficiente
    ? '#dc2626'
    : (stockFinal != null && stockMostrar > 0 && stockFinal <= stockMostrar * 0.1)
      ? '#d97706' : '#16a34a';

  const rowStyle = fila.insuficiente ? { background: '#fee2e2' } : undefined;

  return (
    <tr style={rowStyle}>
      <td>
        <div className="rm-buscador-wrap" ref={wrapRef}>
          <input
            className="rm-buscador-input"
            type="text"
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            onFocus={() => sugerencias.length && setAbierto(true)}
          />
          {abierto && sugerencias.length > 0 && (
            <div className="rm-dropdown">
              {sugerencias.map(item => (
                <div key={item.item_code} className="rm-dropdown-item" onMouseDown={() => seleccionar(item)}>
                  <div className="item-name">{item.item_name}</div>
                  <div className="item-group">{item.item_group} - {item.item_code}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Stock disponible (Kg) — descuenta lo reservado por otras filas */}
      <td style={{ textAlign: 'center' }}>
        {!fila.item_code ? <span style={{ color: '#9ca3af' }}>—</span>
          : !stockLoaded ? <span style={{ fontSize: 12, color: '#6b7280' }}>...</span>
          : sinStock ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>Sin stock</span>
          : (
            <div>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                {Number(stockMostrar).toFixed(2)} {fmtUom(fila.uom)}
              </span>
              {fila.cantPres > 1 && fila.presentacion && (
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  ({Number(stockMostrar / fila.cantPres).toFixed(2)} {fila.presentacion})
                </div>
              )}
            </div>
          )}
      </td>

      {/* Cantidad input */}
      <td style={{ textAlign: 'center' }}>
        <input
          className="rm-qty-input"
          type="number" min="0" step="0.01"
          value={sinStock ? '' : fila.qty}
          onChange={e => onChange({ qty: e.target.value })}
          placeholder={sinStock ? '—' : '0'}
          disabled={sinStock}
        />
        <span style={{ fontSize: 11, color: '#666', marginLeft: 4 }}>{fmtUom(fila.uom)}</span>
        {qtyNum > 0 && fila.cantPres > 1 && fila.presentacion && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            = {(qtyNum / fila.cantPres).toFixed(2)} {fila.presentacion}
          </div>
        )}
      </td>

      {/* Stock final (Kg) */}
      <td style={{ textAlign: 'center' }}>
        {!fila.item_code || stockFinal == null ? <span style={{ color: '#9ca3af' }}>—</span>
          : sinStock ? <span style={{ color: '#9ca3af' }}>—</span>
          : (
            <span style={{ fontWeight: 700, fontSize: 14, color: colorFinal }}>
              {Number(stockFinal).toFixed(2)} {fmtUom(fila.uom)}
            </span>
          )}
      </td>

      <td style={{ textAlign: 'center' }}>
        <button className="rm-btn-eliminar" onClick={onEliminar} disabled={soloUna} title="Eliminar fila">x</button>
      </td>
    </tr>
  );
}

export default RegistroSalida;
