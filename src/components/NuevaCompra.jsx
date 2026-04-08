// src/components/NuevaCompra.jsx
import React, { useState, useRef, useEffect } from 'react';
import { comprasService } from '../services/frappePurchase';
import ModalError from './ModalError';
import '../styles/NuevaCompra.css';

const IMPUESTOS_MAP = {
  tasa0: { key: 'tasa0', label: 'Tasa 0', rate: 0 },
  iva16: { key: 'iva16', label: 'IVA 16%', rate: 0.16 },
  ieps: { key: 'ieps', label: 'IEPS 8%', rate: 0.08 },
};

// Margen por default (en pesos). El usuario puede ajustarlo en la UI.
const MARGEN_DEFAULT = 100;

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
const totalPorFila = (f) => parseFloat(f.bultos || 0) * parseFloat(f.kg_por_bulto || 0);
const subtotalFila = (f) => parseFloat(f.bultos || 0) * parseFloat(f.rate || 0);

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
  const [margen, setMargen] = useState(String(MARGEN_DEFAULT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });

  // Modal de sugerencia post-confirmación
  const [cambiosPendientes, setCambiosPendientes] = useState(null); // null = oculto

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
          setAjuste(redondeo ? String(redondeo.tax_amount) : '');
        } else if (doc.rounding_adjustment) {
          setAjuste(String(doc.rounding_adjustment));
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
    if (fila.impuesto_key === 'iva16') acc.iva += imp;
    if (fila.impuesto_key === 'ieps') acc.ieps += imp;
    return acc;
  }, { subtotal: 0, iva: 0, ieps: 0 });
  totales.total = totales.subtotal + totales.iva + totales.ieps + parseFloat(ajuste || 0);

  // ── Validaciones ─────────────────────────────────────────────────────────
  const validar = () => {
    if (!proveedor.name) { setError('Selecciona un proveedor'); return null; }
    const validos = filas.filter(f => f.item_code && parseFloat(f.bultos) > 0 && parseFloat(f.rate) >= 0);
    if (!validos.length) { setError('Agrega al menos un producto con cantidad y precio'); return null; }
    return validos.map(f => ({ ...f, qty: f.bultos }));
  };

  const validarAjuste = () => {
    const n = parseFloat(ajuste || 0);
    if (Math.abs(n) > 100) {
      setErrorModal({ isOpen: true, message: 'EL AJUSTE DE BALANCE NO PUEDE SER MAYOR A $100.00. Verifica que los precios de los productos estén correctos.' });
      return null;
    }
    return n;
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
    setLoading(true);
    try {
      if (esEdicion) {
        await comprasService.actualizarBorrador(initialData.name, {
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum,
        });
        setSuccess('BORRADOR ACTUALIZADO');
      } else {
        const doc = await comprasService.guardarBorrador({
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum,
        });
        setSuccess(`BORRADOR GUARDADO: ${doc.name}`);
      }
      setTimeout(() => onSuccess?.(), 1600);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Confirmar compra ──────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    setError('');
    const items = validar(); if (!items) return;
    const ajusteNum = validarAjuste(); if (ajusteNum === null) return;
    const itemsOk = validarMargen(items); if (!itemsOk) return;

    setLoading(true);
    try {
      if (esEdicion) {
        await comprasService.actualizarBorrador(initialData.name, {
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum,
        });
        await comprasService.confirmarBorrador(initialData.name);
      } else {
        await comprasService.registrarCompra({
          supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum,
        });
      }
      setSuccess(`✅ Compra confirmada. Total: $${fmt(totales.total)}`);

      // ¿Hay precios que cambiaron? → mostrar modal de sugerencia
      const conCambio = itemsOk.filter(f => {
        const v = calcVariacion(f);
        return v && v.cambio;
      });
      if (conCambio.length > 0) {
        setCambiosPendientes(conCambio);
        // No llamamos onSuccess todavía; se llamará desde el modal
      } else {
        setTimeout(() => onSuccess?.(), 1600);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Actualizar precios en catálogo (desde sugerencia) ────────────────────
  const handleActualizarCatalogo = async (seleccionados) => {
    setCambiosPendientes(null);
    if (seleccionados.length === 0) { onSuccess?.(); return; }
    try {
      await Promise.all(
        seleccionados.map(f => {
          const kgPorBulto = parseFloat(f.kg_por_bulto || 0);
          const nuevoPrecio = parseFloat(f.rate);
          // Si sabemos los kg por bulto, recalculamos precio/kg directamente
          const nuevoPrecioPorKg = kgPorBulto > 0
            ? parseFloat((nuevoPrecio / kgPorBulto).toFixed(6))
            : null;
          return comprasService.actualizarPrecioCatalogo(f.item_code, nuevoPrecio, nuevoPrecioPorKg);
        })
      );
    } catch (err) {
      console.error('Error actualizando catálogo:', err);
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
          onOmitir={() => { setCambiosPendientes(null); onSuccess?.(); }}
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
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Por empaque</th>
                <th>Total</th>
                <th>Precio de Catálogo</th>
                <th>Precio de compra</th>
                <th>Diferencia</th>
                <th>Impuesto</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(fila => (
                <FilaProducto
                  key={fila._id} fila={fila} impuestos={IMPUESTOS}
                  margen={margenNum}
                  onChange={(campo, valor) => updateFila(fila._id, campo, valor)}
                  onImpuesto={(key) => handleImpuesto(fila._id, key)}
                  onEliminar={() => eliminarFila(fila._id)}
                  soloUna={filas.length === 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button className="nc-btn-agregar" onClick={agregarFila}>+ Agregar producto</button>

        {/* Resumen */}
        <div className="nc-resumen-box">
          <div className="nc-resumen-fila">
            <span>Subtotal</span>
            <span className="monto">${fmt(totales.subtotal)}</span>
          </div>
          {totales.iva > 0 && (
            <div className="nc-resumen-fila">
              <span>IVA 16%</span><span className="monto">${fmt(totales.iva)}</span>
            </div>
          )}
          {totales.ieps > 0 && (
            <div className="nc-resumen-fila">
              <span>IEPS 8%</span><span className="monto">${fmt(totales.ieps)}</span>
            </div>
          )}
          <div className="nc-resumen-fila">
            <span>Ajuste (+/-)</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <input type="number" className="nc-input-ajuste" value={ajuste}
                onChange={e => setAjuste(e.target.value)} placeholder="0.00" step="0.01" />
              <small style={{ color: '#9ca3af', fontSize: '11px' }}>Máx. ±$100.00 de redondeo</small>
            </div>
          </div>

          {/* Margen configurable */}
          <div className="nc-resumen-fila nc-margen-fila">
            <span title="Si una fila supera este monto de variación, se bloquea la compra">
              Margen de precio ⚙️
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#8b6a4e', fontSize: 13 }}>$</span>
                <input
                  type="number"
                  className="nc-input-ajuste"
                  value={margen}
                  onChange={e => setMargen(e.target.value)}
                  placeholder="100"
                  min="0"
                  step="10"
                />
              </div>
              <small style={{ color: '#9ca3af', fontSize: '11px' }}>Variación máx. por producto</small>
            </div>
          </div>

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
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = (texto) => {
    setBusqueda(texto);
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
  };

  return (
    <div className="nc-buscador-wrap" ref={wrapRef}>
      <input type="text" className={grande ? 'nc-buscar-input grande' : 'nc-buscar-input'}
        value={busqueda} onChange={e => handleInput(e.target.value)}
        placeholder="Buscar proveedor..." onFocus={() => sugerencias.length && setAbierto(true)} />
      {abierto && sugerencias.length > 0 && (
        <div className="nc-dropdown">
          {sugerencias.map(p => (
            <div key={p.name} className="nc-dropdown-item" onMouseDown={() => seleccionar(p)}>
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
function FilaProducto({ fila, impuestos, margen, onChange, onImpuesto, onEliminar, soloUna }) {
  const [busqueda, setBusqueda] = useState(fila.item_name || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    if (!texto) { onChange('item_code', ''); onChange('item_name', ''); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await comprasService.buscarItems(texto);
      setSugerencias(res); setAbierto(true);
    }, 500);
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    onChange('item_code', item.item_code);
    onChange('item_name', item.item_name);
    onChange('uom', item.stock_uom);
    onChange('kg_por_bulto', item.custom_cantidad_por_presentación || '');
    onChange('precio_por_kg', item.custom_precio_por_kg || '');
    // Guardamos el precio del catálogo como referencia
    const precioCatalogo = item.custom_precio_de_compra || '';
    onChange('precio_catalogo', precioCatalogo);
    // Solo colocamos el precio de catálogo como default
    if (precioCatalogo) onChange('rate', String(precioCatalogo));
    onImpuesto(item.custom_impuesto || 'tasa0');
    setAbierto(false);
  };

  const total = totalPorFila(fila);
  const subtotal = subtotalFila(fila);
  const uomLabel = fila.uom || 'unid';

  const variacion = calcVariacion(fila);
  const superaMargen = variacion && margen > 0 && Math.abs(variacion.diff) > margen;

  return (
    <tr className={superaMargen ? 'nc-fila-alerta' : ''}>

      {/* Producto */}
      <td>
        <div className="nc-buscador-wrap" ref={wrapRef}>
          <input className="nc-buscar-input" type="text" value={busqueda}
            onChange={e => handleBusqueda(e.target.value)} placeholder="Buscar producto..."
            onFocus={() => sugerencias.length && setAbierto(true)} />
          {abierto && sugerencias.length > 0 && (
            <div className="nc-dropdown">
              {sugerencias.map(item => (
                <div key={item.item_code} className="nc-dropdown-item" onMouseDown={() => seleccionar(item)}>
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
        <input className="nc-input cantidad" type="number" min="0" step="1"
          value={fila.bultos} onChange={e => onChange('bultos', e.target.value)} placeholder="0" />
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
          step="0.01"
          value={fila.rate}
          onChange={e => onChange('rate', e.target.value)}
          placeholder="0.00"
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
        </span>
      </td>

      {/* Subtotal */}
      <td><span className="nc-subtotal">${fmt(subtotal)}</span></td>

      {/* Eliminar */}
      <td>
        <button className="nc-btn-eliminar" onClick={onEliminar} disabled={soloUna}>×</button>
      </td>
    </tr>
  );
}

export { BuscadorProveedor };
export default NuevaCompra;