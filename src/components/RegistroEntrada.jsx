// src/components/RegistroEntrada.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { stockService } from "../services/frappeStock";
import { sanitizar } from '../utils/security';
import { parseErrorFrappe } from '../utils/errorFrappe';
import ModalError from './modals/ModalError';
import "../styles/RegistroMovimiento.css";

const DEFAULT_WAREHOUSE = stockService.getBodegaCentral();

const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: "", item_name: "",
  bultos: "",          // cuantos bultos/piezas llegaron
  kg_por_bulto: "",    // auto-llenado desde catalogo
  total_kg: "",        // calculado: bultos x kg_por_bulto
  uom: "kg",
  presentacion: "",
  basic_rate: "",      // costo unitario opcional (stock inicial / corrige valuation)
});

/**
 * Modal para capturar ajustes de inventario positivos (Entradas).
 * Particularmente diseñado para recibir la mercancía contabilizada en "bultos" 
 * calculando automáticamente el peso real según el factor de conversión del sistema.
 *
 * @param {Object} props - Propiedades del modal.
 * @param {Function} props.onSuccess - Ejecutado al completarse exitosamente la transacción en Frappe.
 * @param {Function} props.onCancel - Ejecutado para abandonar la captura.
 * @returns {JSX.Element} Formulario de entrada de stock.
 */
function RegistroEntrada({ onSuccess, onCancel }) {
  const [filas, setFilas]     = useState([FILA_VACIA()]);
  const [notas, setNotas]     = useState("");
  const [warehouse, setWarehouse] = useState(DEFAULT_WAREHOUSE);
  const [warehouses, setWarehouses] = useState([{ name: DEFAULT_WAREHOUSE, label: 'Bodega Central' }]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [errorModal, setErrorModal] = useState(null);

  useEffect(() => {
    let cancel = false;
    stockService.fetchAllWarehouses()
      .then(list => { if (!cancel) setWarehouses(list); })
      .catch(err => console.error('No pude cargar almacenes:', err));
    return () => { cancel = true; };
  }, []);

  const warehouseLabel = useMemo(
    () => warehouses.find(w => w.name === warehouse)?.label || warehouse,
    [warehouse, warehouses]
  );

  const agregarFila  = () => setFilas(f => [...f, FILA_VACIA()]);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };

  const actualizarFila = (id, campos) => {
    setFilas(f => f.map(r => {
      if (r._id !== id) return r;
      const updated = { ...r, ...campos };
      const bultos     = parseFloat(updated.bultos)      || 0;
      const kgPorBulto = parseFloat(updated.kg_por_bulto) || 0;
      // Sin presentación → qty directa en stock_uom (ej: Pzas individuales)
      updated.total_kg = bultos > 0
        ? (kgPorBulto > 0 ? (bultos * kgPorBulto).toFixed(3) : String(bultos))
        : "";
      return updated;
    }));
  };

  const handleSubmit = async () => {
    // Validar: necesita item_code y al menos 1 bulto/empaque
    const itemsValidos = filas.filter(f => f.item_code && parseFloat(f.bultos) > 0);
    if (!itemsValidos.length) {
      setErrorModal({
        title: 'Sin productos',
        message: 'Agrega al menos un producto con cantidad mayor a cero para registrar la entrada.',
      });
      return;
    }
    setLoading(true);
    try {
      // qty SIEMPRE en unidad base = bultos × contenido_por_empaque.
      // Ej: 3 CAJA × 12 PZA = 36 PZA. registrarEntrada manda conversion_factor=1,
      // así que la conversión debe venir ya aplicada aquí (el Bin vive en base).
      // basic_rate es el costo POR UNIDAD BASE (precio_por_kg/precio_final).
      const items = itemsValidos.map(f => {
        const bultos    = parseFloat(f.bultos) || 0;
        const contenido = parseFloat(f.kg_por_bulto) || 0;
        const qtyBase   = contenido > 0 ? bultos * contenido : bultos;
        return {
          ...f,
          qty: qtyBase,
          basic_rate: parseFloat(f.basic_rate) > 0 ? parseFloat(f.basic_rate) : undefined,
        };
      });
      await stockService.registrarEntrada({ items, notas: sanitizar(notas), warehouse });
      const totalBase = items.reduce((s, it) => s + parseFloat(it.qty), 0);
      setSuccess(`Entrada registrada: ${itemsValidos.length} producto(s) — ${totalBase.toFixed(2)} unidades base en total`);
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      setErrorModal(parseErrorFrappe(err));
    } finally {
      setLoading(false);
    }
  };

  const totalKgGlobal = filas.reduce((s, f) => s + (parseFloat(f.total_kg) || 0), 0);

  return (
    <div className="rm-modal">
      <ModalError
        isOpen={!!errorModal}
        title={errorModal?.title}
        message={errorModal?.message}
        onClose={() => setErrorModal(null)}
      />
      <div className="rm-container entrada">
        <div className="rm-header">
          <h2>Ajuste de Entrada</h2>
          <button className="rm-btn-close" onClick={onCancel}>x</button>
        </div>

        <div className="rm-info-bar">
          <div className="rm-destino-wrap">
            <span className="rm-destino-label">Destino</span>
            <select className="rm-destino-select" value={warehouse}
              onChange={e => setWarehouse(e.target.value)} disabled={loading}>
              {warehouses.map(w => <option key={w.name} value={w.name}>{w.label}</option>)}
            </select>
          </div>
        </div>

        {success && <div className="rm-alert rm-alert-success">{success}</div>}

        <div className="rm-tabla-header">
          <span>Productos a ingresar</span>
        </div>

        <table className="rm-tabla">
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant. Recibida</th>
              <th title="Ej: 25 kg por costal. Dejar vacío si la cantidad ya está en stock_uom (Pzas, Lt, etc.)">Contenido / Ud. (opc.)</th>
              <th>Total en stock</th>
              <th title="Opcional. Si se deja vacío se usa el costo del catálogo.">Costo Unit. (opc.)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(fila => (
              <FilaProducto
                key={fila._id}
                fila={fila}
                onChange={(campos) => actualizarFila(fila._id, campos)}
                onEliminar={() => eliminarFila(fila._id)}
                soloUna={filas.length === 1}
              />
            ))}
          </tbody>
        </table>

        <button className="rm-btn-agregar" onClick={agregarFila}>+ Agregar producto</button>

        <div className="rm-section">
          <label>Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: Llegaron 3 bultos de harina, remision #456..." />
        </div>

        <div className="rm-actions">
          <span className="rm-resumen">
            Total: <strong>{totalKgGlobal.toFixed(2)} unidades</strong> listas para registrar
          </span>
          <button className="rm-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="rm-btn-primary"   onClick={handleSubmit} disabled={loading}>
            {loading ? "Guardando..." : "Confirmar Entrada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila con buscador ─────────────────────────────────────
/**
 * Subcomponente representante de un renglón capturable.
 * Cuenta con un buscador tipográfico atado a la API para autocompletar el nombre y medidas del producto.
 * 
 * @param {Object} props - Datos y callbacks heredados.
 * @param {Object} props.fila - Snapshot del estado del renglón (cantidades, bultos y pk).
 * @param {Function} props.onChange - Disparador cuando cambia bultos/kg.
 * @param {Function} props.onEliminar - Disparador al pulsar eliminar renglón.
 * @param {boolean} props.soloUna - Restringe eliminar si es la última fila restante.
 * @returns {JSX.Element} Fila `<tr>`.
 */
function FilaProducto({ fila, onChange, onEliminar, soloUna }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto]         = useState(false);
  const [busqueda, setBusqueda]       = useState(fila.item_name || "");
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    if (!texto) { onChange({ item_code: "", item_name: "" }); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await stockService.buscarItemsTexto(texto);
      setSugerencias(res);
      setAbierto(true);
    }, 500);
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    // Auto-llenar costo unitario desde el catalogo.
    // Prioridad: precio_final (con impuesto incluido) — refleja costo real de caja
    // del bulto comprado; útil para márgenes y valuation realista.
    const costo = parseFloat(item.custom_precio_final)
              || parseFloat(item.custom_precio_por_kg)
              || parseFloat(item.valuation_rate)
              || parseFloat(item.custom_precio_de_compra)
              || "";
    onChange({
      item_code:    item.item_code,
      item_name:    item.item_name,
      uom:          item.stock_uom || "kg",
      presentacion: item.custom_presentación || "",
      kg_por_bulto: item["custom_cantidad_por_presentación"] || "",
      basic_rate:   costo ? String(costo) : "",
    });
    setAbierto(false);
  };

  return (
    <tr>
      <td>
        <div className="rm-buscador-wrap" ref={wrapRef}>
          <input className="rm-buscador-input" type="text" value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            onFocus={() => sugerencias.length && setAbierto(true)} />
          {abierto && sugerencias.length > 0 && (
            <div className="rm-dropdown">
              {sugerencias.map(item => (
                <div key={item.item_code} className="rm-dropdown-item" onMouseDown={() => seleccionar(item)}>
                  <div className="item-name">{item.item_name}</div>
                  <div className="item-group">{item.item_group} — {item.item_code}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input className="rm-qty-input" type="number" min="0" step="0.01"
            value={fila.bultos} onChange={e => onChange({ bultos: e.target.value })}
            placeholder="0" />
          <span style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
            {fila.presentacion || "Empaque(s)"}
          </span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input className="rm-qty-input" type="number" min="0" step="0.001"
            value={fila.kg_por_bulto} onChange={e => onChange({ kg_por_bulto: e.target.value })}
            placeholder={fila.uom || "Uni"} />
          <span style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
            {fila.uom ? `${fila.uom} por emp.` : "x Empaque"}
          </span>
        </div>
      </td>
      <td>
        {fila.total_kg
          ? <span className="rm-total-kg">
              {Number(fila.total_kg).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
              {' '}<span style={{ fontSize: 12, fontWeight: 'normal' }}>{fila.uom || 'kg'}</span>
            </span>
          : <span style={{ color: "#9ca3af", fontSize: 12 }}>
              {fila.item_code ? 'Ingresa cantidad' : '—'}
            </span>}
      </td>
      <td>
        <input className="rm-qty-input" type="number" min="0" step="0.0001"
          value={fila.basic_rate}
          onChange={e => onChange({ basic_rate: e.target.value })}
          placeholder="$0.00" />
      </td>
      <td>
        <button className="rm-btn-eliminar" onClick={onEliminar} disabled={soloUna}>x</button>
      </td>
    </tr>
  );
}

export default RegistroEntrada;