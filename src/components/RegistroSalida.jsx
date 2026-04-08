// src/components/RegistroSalida.jsx
import React, { useState, useRef, useEffect } from 'react';
import { stockService } from '../services/frappeStock';
import '../styles/RegistroMovimiento.css';

const FILA_VACIA = () => ({ _id: Math.random(), item_code: '', item_name: '', qty: '', uom: '' });

/**
 * Modal para despachar o enviar mercancías internas (Transferencias/Material Issue).
 * Permite seleccionar hacia qué Sub-Almacén de los Departamentos va dirigida la salida.
 *
 * @param {Object} props - Objeto de configuración del componente.
 * @param {Function} props.onSuccess - Disparador post-éxito al generar el Stock Entry.
 * @param {Function} props.onCancel - Salir sin guardar.
 * @returns {JSX.Element} Vista del formulario.
 */
function RegistroSalida({ onSuccess, onCancel }) {
  const [almacenDestino, setAlmacenDestino] = useState('');
  const [filas, setFilas]     = useState([FILA_VACIA()]);
  const [notas, setNotas]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const almacenes = stockService.getAlmacenesDepartamento();

  const agregarFila  = () => setFilas(f => [...f, FILA_VACIA()]);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };
  const actualizarFila = (id, campo, valor) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, [campo]: valor } : r));

  const handleSubmit = async () => {
    setError('');
    if (!almacenDestino) { setError('Selecciona el almacen destino'); return; }
    const itemsValidos = filas.filter(f => f.item_code && parseFloat(f.qty) > 0);
    if (!itemsValidos.length) { setError('Agrega al menos un producto con cantidad mayor a 0'); return; }

    setLoading(true);
    try {
      await stockService.registrarSalida({ almacenDestino, items: itemsValidos, notas });
      const dest = almacenes.find(a => a.name === almacenDestino)?.label || almacenDestino;
      setSuccess(`Transferencia registrada hacia ${dest}: ${itemsValidos.length} producto(s)`);
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalProductos = filas.filter(f => f.item_code && parseFloat(f.qty) > 0).length;
  const labelDestino   = almacenes.find(a => a.name === almacenDestino)?.label || '';

  return (
    <div className="rm-modal">
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

        {error   && <div className="rm-alert rm-alert-error">{error}</div>}
        {success && <div className="rm-alert rm-alert-success">{success}</div>}

        <div className="rm-section">
          <label>Almacen destino *</label>
          <select value={almacenDestino} onChange={e => setAlmacenDestino(e.target.value)}>
            <option value="">Selecciona el departamento...</option>
            {almacenes.map(a => (
              <option key={a.name} value={a.name}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="rm-tabla-header">
          <span>Productos a transferir</span>
        </div>

        <table className="rm-tabla">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Producto</th>
              <th style={{ width: '20%' }}>Cantidad</th>
              <th style={{ width: '20%' }}>Unidad</th>
              <th style={{ width: '15%' }}></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(fila => (
              <FilaProducto
                key={fila._id}
                fila={fila}
                onChange={(campo, valor) => actualizarFila(fila._id, campo, valor)}
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
          <button className="rm-btn-primary"   onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Confirmar Transferencia'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila con buscador (idéntica a RegistroEntrada) ──────────
/**
 * Subcomponente representante de un renglón capturable (Transferencias).
 * Comparte lógica de autocompletado on-type con RegistroEntrada.
 * 
 * @param {Object} props - Datos y callbacks.
 * @param {Object} props.fila - Snapshot del status actual.
 * @param {Function} props.onChange - Handler de mutación de columnas.
 * @param {Function} props.onEliminar - Remover fila de la grilla.
 * @param {boolean} props.soloUna - Si está true, el botón "x" vendrá discapacitado.
 * @returns {JSX.Element} Elemento TableRow (`<tr>`).
 */
function FilaProducto({ fila, onChange, onEliminar, soloUna }) {
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
    if (!texto) { onChange('item_code', ''); onChange('item_name', ''); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await stockService.buscarItemsTexto(texto);
      setSugerencias(res);
      setAbierto(true);
    }, 500);
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    onChange('item_code', item.item_code);
    onChange('item_name', item.item_name);
    onChange('uom',       item.stock_uom);
    setSugerencias([]);
    setAbierto(false);
  };

  return (
    <tr>
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
      <td>
        <input
          className="rm-qty-input"
          type="number"
          min="0"
          step="0.01"
          value={fila.qty}
          onChange={e => onChange('qty', e.target.value)}
          placeholder="0"
        />
      </td>
      <td>
        {fila.uom
          ? <span className="rm-uom-badge">{fila.uom}</span>
          : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
      </td>
      <td>
        <button className="rm-btn-eliminar" onClick={onEliminar} disabled={soloUna} title="Eliminar fila">
          x
        </button>
      </td>
    </tr>
  );
}

export default RegistroSalida;