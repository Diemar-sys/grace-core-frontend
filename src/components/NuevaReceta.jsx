// src/components/NuevaReceta.jsx
// Formulario para crear/editar recetas (BOM) en ERPNext
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { produccionService } from '../services/frappeProduccion';
import { stockService } from '../services/frappeStock';
import ModalError from './ModalError';
import '../styles/Produccion.css';

const DEPARTAMENTOS = stockService.getAlmacenesDepartamento();

const FILA_VACIA = () => ({
  _id: Math.random().toString(36).slice(2),
  item_code: '',
  item_name: '',
  qty: '',
  uom: '',
  _busqueda: '',
  _sugerencias: [],
  _abierto: false,
});

function NuevaReceta({ onSuccess, onCancel, editBOM = null }) {
  const [meta, setMeta] = useState({
    item: editBOM?.item || '',
    item_name: editBOM?.item_name || '',
    quantity: editBOM?.quantity || '1',
    uom: editBOM?.uom || 'Kg',
    custom_departamento: editBOM?.custom_departamento || '',
  });
  const [ingredientes, setIngredientes] = useState(editBOM?.items?.length
    ? editBOM.items.map(i => ({ _id: Math.random().toString(36).slice(2), ...i, _busqueda: i.item_name || '', _sugerencias: [], _abierto: false }))
    : [FILA_VACIA()]
  );
  const [productoSugs, setProductoSugs] = useState([]);
  const [productoBuscando, setProductoBuscando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const timerRef = useRef(null);

  // Buscar producto final (meta.item)
  const buscarProductoFinal = useCallback(async (texto) => {
    if (texto.length < 2) { setProductoSugs([]); return; }
    setProductoBuscando(true);
    try {
      const items = await produccionService.buscarProductosTerminados(texto);
      setProductoSugs(items);
    } finally {
      setProductoBuscando(false);
    }
  }, []);

  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    setMeta(prev => ({ ...prev, [name]: value }));
    if (name === 'item') {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => buscarProductoFinal(value), 300);
    }
  };

  const seleccionarProductoFinal = (item) => {
    setMeta(prev => ({
      ...prev,
      item: item.item_code,
      item_name: item.item_name,
      uom: item.stock_uom || 'Kg',
    }));
    setProductoSugs([]);
  };

  // ── Manejo de filas de ingredientes ────────────────────
  const updateIngrediente = (id, field, value) => {
    setIngredientes(prev => prev.map(row =>
      row._id === id ? { ...row, [field]: value } : row
    ));
  };

  const buscarIngrediente = useCallback(async (id, texto) => {
    if (texto.length < 2) {
      setIngredientes(prev => prev.map(r => r._id === id ? { ...r, _sugerencias: [], _abierto: false } : r));
      return;
    }
    const items = await produccionService.buscarItems(texto);
    setIngredientes(prev => prev.map(r => r._id === id
      ? { ...r, _sugerencias: items, _abierto: true }
      : r
    ));
  }, []);

  const seleccionarIngrediente = (id, item) => {
    setIngredientes(prev => prev.map(r => r._id === id ? {
      ...r,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.stock_uom,
      _busqueda: item.item_name,
      _sugerencias: [],
      _abierto: false,
    } : r));
  };

  const addIngrediente = () => setIngredientes(prev => [...prev, FILA_VACIA()]);

  const removeIngrediente = (id) => {
    setIngredientes(prev => prev.filter(r => r._id !== id));
  };

  // ── Submit ──────────────────────────────────────────────
  const handleGuardar = async (activar = false) => {
    if (!meta.item.trim()) {
      setErrorModal({ isOpen: true, message: 'DEBES SELECCIONAR EL PRODUCTO FINAL DE LA RECETA.' });
      return;
    }
    if (!meta.quantity || parseFloat(meta.quantity) <= 0) {
      setErrorModal({ isOpen: true, message: 'LA CANTIDAD QUE PRODUCE LA RECETA DEBE SER MAYOR A CERO.' });
      return;
    }
    const validos = ingredientes.filter(r => r.item_code && parseFloat(r.qty) > 0);
    if (!validos.length) {
      setErrorModal({ isOpen: true, message: 'AGREGA AL MENOS UN INGREDIENTE CON CANTIDAD MAYOR A CERO.' });
      return;
    }

    setLoading(true);
    try {
      const bom = await produccionService.crearBOM({
        item: meta.item,
        quantity: meta.quantity,
        uom: meta.uom,
        custom_departamento: meta.custom_departamento,
        items: validos.map(r => ({ item_code: r.item_code, item_name: r.item_name, qty: r.qty, uom: r.uom })),
      });

      if (activar) {
        await produccionService.activarBOM(bom.name);
      }

      onSuccess?.(bom);
    } catch (err) {
      let msg = err.message || 'Error desconocido al guardar la receta';
      if (msg.includes('already exists') || msg.includes('Duplicate')) {
        msg = `YA EXISTE UNA RECETA PARA EL PRODUCTO "${meta.item}". REVISA LAS RECETAS EXISTENTES.`;
      }
      setErrorModal({ isOpen: true, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="receta-overlay">
      <div className="receta-modal">
        <ModalError
          isOpen={errorModal.isOpen}
          message={errorModal.message}
          onClose={() => setErrorModal({ isOpen: false, message: '' })}
        />

        {/* HEADER */}
        <div className="receta-header">
          <h2>{editBOM ? 'Editar' : 'Nueva'} Receta</h2>
          <button className="btn-close" onClick={onCancel}>×</button>
        </div>

        {/* BODY */}
        <div className="receta-body">
          {/* Datos generales de la receta */}
          <div className="receta-meta-grid">
            {/* Producto final */}
            <div className="receta-field" style={{ position: 'relative' }}>
              <label>Producto Final *</label>
              <input
                name="item"
                value={meta.item}
                onChange={handleMetaChange}
                placeholder="Buscar producto..."
                autoComplete="off"
              />
              {productoSugs.length > 0 && (
                <div className="ingrediente-dropdown">
                  {productoSugs.map(s => (
                    <div key={s.item_code} className="ingrediente-dropdown-item"
                      onMouseDown={() => seleccionarProductoFinal(s)}>
                      <span>{s.item_name}</span>
                      <span className="item-code">{s.item_code}</span>
                    </div>
                  ))}
                </div>
              )}
              {meta.item_name && meta.item_name !== meta.item && (
                <small style={{ color: '#6b7280' }}>{meta.item_name}</small>
              )}
            </div>

            {/* Cantidad que produce */}
            <div className="receta-field">
              <label>Cantidad *</label>
              <input type="number" name="quantity" value={meta.quantity}
                onChange={handleMetaChange} min="0.001" step="0.001" placeholder="1" />
            </div>

            {/* UoM */}
            <div className="receta-field">
              <label>Unidad</label>
              <input name="uom" value={meta.uom} onChange={handleMetaChange} placeholder="Kg, pza..." />
            </div>

            {/* Departamento */}
            <div className="receta-field">
              <label>Departamento</label>
              <select name="custom_departamento" value={meta.custom_departamento} onChange={handleMetaChange}>
                <option value="">— Todos —</option>
                {DEPARTAMENTOS.map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de ingredientes */}
          <div className="ingredientes-section">
            <h4>Ingredientes</h4>
            <table className="ingredientes-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Insumo / Ingrediente</th>
                  <th style={{ width: '20%' }}>Cantidad</th>
                  <th style={{ width: '15%' }}>Unidad</th>
                  <th style={{ width: '25%' }}>Código</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {ingredientes.map(row => (
                  <tr key={row._id}>
                    {/* Buscador de insumo */}
                    <td>
                      <div className="ingrediente-search-wrap">
                        <input
                          value={row._busqueda}
                          onChange={e => {
                            updateIngrediente(row._id, '_busqueda', e.target.value);
                            clearTimeout(timerRef.current);
                            timerRef.current = setTimeout(() => buscarIngrediente(row._id, e.target.value), 300);
                          }}
                          placeholder="Buscar insumo..."
                          autoComplete="off"
                        />
                        {row._abierto && row._sugerencias.length > 0 && (
                          <div className="ingrediente-dropdown">
                            {row._sugerencias.map(s => (
                              <div key={s.item_code} className="ingrediente-dropdown-item"
                                onMouseDown={() => seleccionarIngrediente(row._id, s)}>
                                <span>{s.item_name}</span>
                                <span className="item-code">{s.item_code}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <input type="number" value={row.qty}
                        onChange={e => updateIngrediente(row._id, 'qty', e.target.value)}
                        min="0" step="0.001" placeholder="0.000" />
                    </td>
                    <td>
                      <input value={row.uom} readOnly placeholder="—" style={{ background: '#f9fafb', color: '#6b7280' }} />
                    </td>
                    <td>
                      <input value={row.item_code} readOnly placeholder="—" style={{ background: '#f9fafb', color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }} />
                    </td>
                    <td>
                      <button className="btn-remove-row" onClick={() => removeIngrediente(row._id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-add-ingrediente" type="button" onClick={addIngrediente}>
              + Agregar ingrediente
            </button>
          </div>
        </div>

        {/* FOOTER */}
        <div className="receta-footer">
          <button className="btn-cancelar-receta" onClick={onCancel}>Cancelar</button>
          <button className="btn-guardar-receta" disabled={loading}
            onClick={() => handleGuardar(false)}>
            {loading ? 'Guardando...' : 'Guardar Borrador'}
          </button>
          <button className="btn-activar-receta" disabled={loading}
            onClick={() => handleGuardar(true)}>
            {loading ? 'Guardando...' : 'Guardar y Activar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NuevaReceta;
