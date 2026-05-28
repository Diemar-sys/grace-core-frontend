import React, { useState, useRef, useEffect, useCallback } from 'react';
import { comprasService } from '../services/frappePurchase';
import ModalError from './modals/ModalError';
import ModalSugerenciaPrecios from './compras/ModalSugerenciaPrecios';
import ModalReciboPDF from './compras/ModalReciboPDF';
import BuscadorProveedor from './compras/BuscadorProveedor';
import FilaProducto from './compras/FilaProducto';
import {
  FILA_VACIA, MARGEN_DEFAULT, fmt,
  parseImpuesto, subtotalFila, calcVariacion,
} from './compras/compraUtils';
import '../styles/NuevaCompra.css';

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
  const margen = MARGEN_DEFAULT;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const [cambiosPendientes, setCambiosPendientes] = useState(null);
  const [pdfData, setPdfData] = useState(null);

  const IMPUESTOS  = comprasService.getImpuestos();
  const margenNum  = parseFloat(margen) || 0;
  const inputRefs  = useRef([]);

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

          const ivaEntry  = doc.taxes.find(t => t.description?.includes('IVA') || t.account_head?.includes('IVA ACREDITABLE'));
          const iepsEntry = doc.taxes.find(t => t.description?.includes('IEPS') || t.account_head?.includes('IEPS'));
          if (ivaEntry)  { setIvaOverride(String(ivaEntry.tax_amount));   setIvaManual(true); }
          if (iepsEntry) { setIepsOverride(String(iepsEntry.tax_amount)); setIepsManual(true); }
        } else if (doc.rounding_adjustment) {
          setAjuste(String(doc.rounding_adjustment));
          setAjusteManual(Math.abs(doc.rounding_adjustment) > 0.005);
        }

        if (doc.items?.length) {
          const codes    = [...new Set(doc.items.map(i => i.item_code))];
          const catItems = await comprasService.getItemsCatalogo(codes);
          const dict     = {};
          catItems.forEach(it => { dict[it.item_code] = it; });

          setFilas(doc.items.map(i => {
            const imp = parseImpuesto(i.description || '');
            const m   = dict[i.item_code] || {};
            return {
              _id:             Math.random(),
              item_code:       i.item_code || '',
              item_name:       i.item_name || '',
              uom:             i.uom || '',
              bultos:          i.qty != null ? String(i.qty) : '',
              rate:            i.rate != null ? String(i.rate) : '',
              precio_catalogo: m.custom_precio_de_compra != null ? String(m.custom_precio_de_compra) : '',
              kg_por_bulto:    m.custom_cantidad_por_presentación || '',
              precio_por_kg:   m.custom_precio_por_kg || '',
              impuesto_key:    imp.key,
              impuesto_label:  imp.label,
              impuesto_rate:   imp.rate,
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
  const agregarFila = useCallback(() => setFilas(f => [...f, FILA_VACIA()]), []);

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
    const imp = IMPUESTOS.find(i => i.key === key);
    setFilas(f => f.map(r => r._id === id
      ? { ...r, impuesto_key: imp.key, impuesto_label: imp.label, impuesto_rate: imp.rate }
      : r
    ));
  };

  const focusRow = useCallback((idx) => {
    if (idx < inputRefs.current.length) {
      inputRefs.current[idx]?.focus();
    } else {
      agregarFila();
      setTimeout(() => inputRefs.current[inputRefs.current.length - 1]?.focus(), 0);
    }
  }, [agregarFila]);

  // ── Totales ───────────────────────────────────────────────────────────────
  const totales = filas.reduce((acc, fila) => {
    const base = subtotalFila(fila);
    const imp  = base * parseFloat(fila.impuesto_rate || 0);
    acc.subtotal += base;
    if (fila.impuesto_key === 'iva16')  { acc.iva += imp;  acc.subtotalIva16 += base; }
    else if (fila.impuesto_key === 'ieps') { acc.ieps += imp; acc.subtotalIeps += base; }
    else { acc.subtotalTasa0 += base; }
    return acc;
  }, { subtotal: 0, iva: 0, ieps: 0, subtotalIva16: 0, subtotalTasa0: 0, subtotalIeps: 0 });

  const ivaEfectivo  = (ivaManual  && totales.iva  > 0) ? parseFloat(ivaOverride  || 0) : totales.iva;
  const iepsEfectivo = (iepsManual && totales.ieps > 0) ? parseFloat(iepsOverride || 0) : totales.ieps;
  totales.iva  = ivaEfectivo;
  totales.ieps = iepsEfectivo;

  const subtotalIva16Calc  = totales.subtotalIva16;
  const subtotalIepsCalc   = totales.subtotalIeps;
  const subtotalTasa0Calc  = totales.subtotalTasa0;
  totales.subtotalIva16 = subtotalIva16Manual ? parseFloat(subtotalIva16Override || 0) : subtotalIva16Calc;
  totales.subtotalIeps  = subtotalIepsManual  ? parseFloat(subtotalIepsOverride  || 0) : subtotalIepsCalc;
  totales.subtotalTasa0 = subtotalTasa0Manual ? parseFloat(subtotalTasa0Override || 0) : subtotalTasa0Calc;

  const subtotalCalc    = totales.subtotal;
  const subtotalEfectivo = totales.subtotalIva16 + totales.subtotalIeps + totales.subtotalTasa0;
  const subtotalDiff    = subtotalEfectivo - subtotalCalc;
  totales.subtotal      = subtotalEfectivo;

  const rawTotal       = subtotalEfectivo + ivaEfectivo + iepsEfectivo;
  const ajusteSAT      = Math.round((Math.round(rawTotal * 100) / 100 - rawTotal) * 1e6) / 1e6;
  const ajusteEfectivo = ajusteManual ? parseFloat(ajuste || 0) : ajusteSAT;
  const ajusteParaErp  = ajusteEfectivo + subtotalDiff;
  totales.total        = rawTotal + ajusteEfectivo;

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

  const validarMargen = (items) => {
    const violaciones = items.filter(f => { const v = calcVariacion(f); return v && Math.abs(v.diff) > margenNum; });
    if (violaciones.length > 0) {
      const lista = violaciones.map(f => {
        const v = calcVariacion(f);
        return `• ${f.item_name}: catálogo $${fmt(v.catalogo)} → compra $${fmt(v.actual)} (diff $${fmt(Math.abs(v.diff))})`;
      }).join('\n');
      setErrorModal({ isOpen: true, message: `La variación de precio supera el margen configurado de $${fmt(margenNum)}. Revisa los siguientes productos:\n\n${lista}` });
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
      ...(ivaManual  && totales.iva  > 0 ? { iva16: parseFloat(ivaOverride  || 0) } : {}),
      ...(iepsManual && totales.ieps > 0 ? { ieps:  parseFloat(iepsOverride || 0) } : {}),
    };
    const subtotalOverrides = { iva16: totales.subtotalIva16, ieps: totales.subtotalIeps, tasa0: totales.subtotalTasa0 };
    setLoading(true);
    try {
      let docNoCompra = null;
      if (esEdicion) {
        await comprasService.actualizarBorrador(initialData.name, { supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides });
        setSuccess('BORRADOR ACTUALIZADO');
        docNoCompra = initialData.custom_no_de_compra ?? null;
      } else {
        const doc = await comprasService.guardarBorrador({ supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides });
        setSuccess(`BORRADOR GUARDADO: ${doc.name}`);
        docNoCompra = doc?.custom_no_de_compra ?? null;
      }
      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      setPdfData({ noCompra: docNoCompra, noFactura: billNo, fecha, hora, proveedor: proveedor.label, filas: items, totales, ajuste: ajusteEfectivo, esBorrador: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Confirmar compra ──────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    setError('');
    const items  = validar();          if (!items)    return;
    const ajusteNum = validarAjuste(); if (ajusteNum === null) return;
    const itemsOk   = validarMargen(items); if (!itemsOk) return;
    const taxOverrides = {
      ...(ivaManual  && totales.iva  > 0 ? { iva16: parseFloat(ivaOverride  || 0) } : {}),
      ...(iepsManual && totales.ieps > 0 ? { ieps:  parseFloat(iepsOverride || 0) } : {}),
    };
    const subtotalOverrides = { iva16: totales.subtotalIva16, ieps: totales.subtotalIeps, tasa0: totales.subtotalTasa0 };

    setLoading(true);
    try {
      if (esEdicion) {
        await comprasService.actualizarBorrador(initialData.name, { supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides });
        await comprasService.confirmarBorrador(initialData.name);
      } else {
        await comprasService.registrarCompra({ supplier: proveedor.name, fecha, billNo, items, notas, ajuste: ajusteNum, taxOverrides, subtotalOverrides });
      }
      setSuccess(`✅ Compra confirmada. Total: $${fmt(totales.total)}`);
      const conCambio = itemsOk.filter(f => calcVariacion(f)?.cambio);
      if (conCambio.length > 0) { setCambiosPendientes(conCambio); } else { onSuccess?.(); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Actualizar precios en catálogo ────────────────────────────────────────
  const handleActualizarCatalogo = async (seleccionados) => {
    setCambiosPendientes(null);
    if (seleccionados.length > 0) {
      try {
        await Promise.all(seleccionados.map(f => {
          const kgPorBulto    = parseFloat(f.kg_por_bulto || 0);
          const nuevoPrecio   = parseFloat(f.rate);
          const nuevoPrecioPorKg = kgPorBulto > 0 ? parseFloat((nuevoPrecio / kgPorBulto).toFixed(6)) : null;
          return comprasService.actualizarPrecioCatalogo(f.item_code, nuevoPrecio, nuevoPrecioPorKg);
        }));
      } catch (err) { console.error('Error actualizando catálogo:', err); }
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

      {cambiosPendientes && (
        <ModalSugerenciaPrecios
          cambios={cambiosPendientes}
          onAceptar={handleActualizarCatalogo}
          onOmitir={() => { setCambiosPendientes(null); onSuccess?.(); }}
        />
      )}

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

        {error   && <div className="nc-alert nc-alert-error">{error}</div>}
        {success && <div className="nc-alert nc-alert-success">{success}</div>}

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
                  key={fila._id}
                  fila={fila}
                  margen={margenNum}
                  inputRef={el => { inputRefs.current[idx] = el; }}
                  onChange={(campos) => updateFila(fila._id, campos)}
                  onImpuesto={(key) => handleImpuesto(fila._id, key)}
                  onEliminar={() => eliminarFila(fila._id)}
                  onMover={(dir) => moverFila(fila._id, dir)}
                  onFocusNext={() => focusRow(idx + 1)}
                  esPrimera={idx === 0}
                  esUltima={idx === filas.length - 1}
                  soloUna={filas.length === 1}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button className="nc-btn-agregar" onClick={agregarFila}>+ Agregar producto</button>

        <div className="nc-resumen-box">
          {(subtotalIva16Calc > 0 || subtotalIva16Manual) && <div className="nc-resumen-fila nc-resumen-base">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Subtotal IVA 16%
              {subtotalIva16Manual ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span> : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {subtotalIva16Manual && (<button className="nc-btn-reset-ajuste" onClick={() => { setSubtotalIva16Override(''); setSubtotalIva16Manual(false); }} title="Restaurar calculado">↺</button>)}
              <input type="number" className="nc-input-ajuste"
                value={subtotalIva16Manual ? subtotalIva16Override : subtotalIva16Calc.toFixed(2)}
                onChange={e => { setSubtotalIva16Override(e.target.value); setSubtotalIva16Manual(true); }}
                step="0.01" />
            </div>
          </div>}
          {(subtotalIepsCalc > 0 || subtotalIepsManual) && <div className="nc-resumen-fila nc-resumen-base">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Subtotal IEPS 8%
              {subtotalIepsManual ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span> : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {subtotalIepsManual && (<button className="nc-btn-reset-ajuste" onClick={() => { setSubtotalIepsOverride(''); setSubtotalIepsManual(false); }} title="Restaurar calculado">↺</button>)}
              <input type="number" className="nc-input-ajuste"
                value={subtotalIepsManual ? subtotalIepsOverride : subtotalIepsCalc.toFixed(2)}
                onChange={e => { setSubtotalIepsOverride(e.target.value); setSubtotalIepsManual(true); }}
                step="0.01" />
            </div>
          </div>}
          {(subtotalTasa0Calc > 0 || subtotalTasa0Manual) && <div className="nc-resumen-fila nc-resumen-base">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Subtotal IVA 0%
              {subtotalTasa0Manual ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span> : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {subtotalTasa0Manual && (<button className="nc-btn-reset-ajuste" onClick={() => { setSubtotalTasa0Override(''); setSubtotalTasa0Manual(false); }} title="Restaurar calculado">↺</button>)}
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
                {ivaManual ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span> : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {ivaManual && (<button className="nc-btn-reset-ajuste" onClick={() => { setIvaOverride(''); setIvaManual(false); }} title="Restaurar IVA calculado">↺</button>)}
                <input type="number" className="nc-input-ajuste"
                  value={ivaManual ? ivaOverride : totales.iva.toFixed(2)}
                  onChange={e => { setIvaOverride(e.target.value); setIvaManual(true); }}
                  step="0.01" />
              </div>
            </div>
          )}
          {totales.ieps > 0 && (
            <div className="nc-resumen-fila">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                IEPS 8%
                {iepsManual ? <span className="nc-ajuste-badge nc-ajuste-manual">Manual</span> : <span className="nc-ajuste-badge nc-ajuste-auto">Auto</span>}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {iepsManual && (<button className="nc-btn-reset-ajuste" onClick={() => { setIepsOverride(''); setIepsManual(false); }} title="Restaurar IEPS calculado">↺</button>)}
                <input type="number" className="nc-input-ajuste"
                  value={iepsManual ? iepsOverride : totales.ieps.toFixed(2)}
                  onChange={e => { setIepsOverride(e.target.value); setIepsManual(true); }}
                  step="0.01" />
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

export { BuscadorProveedor };
export default NuevaCompra;
