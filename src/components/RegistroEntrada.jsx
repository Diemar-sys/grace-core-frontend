// src/components/RegistroEntrada.jsx
import React, { useState, useRef, useEffect } from "react";
import { stockService } from "../services/frappeStock";
import "../styles/RegistroMovimiento.css";

const FILA_VACIA = () => ({
  _id: Math.random(),
  item_code: "", item_name: "",
  bultos: "",          // cuantos bultos/piezas llegaron
  kg_por_bulto: "",    // auto-llenado desde catalogo
  total_kg: "",        // calculado: bultos x kg_por_bulto
  uom: "kg",
  presentacion: "",
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
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  const agregarFila  = () => setFilas(f => [...f, FILA_VACIA()]);
  const eliminarFila = (id) => { if (filas.length > 1) setFilas(f => f.filter(r => r._id !== id)); };

  const actualizarFila = (id, campo, valor) => {
    setFilas(f => f.map(r => {
      if (r._id !== id) return r;
      const updated = { ...r, [campo]: valor };
      // Recalcular total_kg cuando cambia bultos o kg_por_bulto
      const bultos     = parseFloat(campo === "bultos"      ? valor : updated.bultos)      || 0;
      const kgPorBulto = parseFloat(campo === "kg_por_bulto" ? valor : updated.kg_por_bulto) || 0;
      updated.total_kg = bultos > 0 && kgPorBulto > 0 ? (bultos * kgPorBulto).toFixed(3) : "";
      return updated;
    }));
  };

  const handleSubmit = async () => {
    setError("");
    const itemsValidos = filas.filter(f => f.item_code && parseFloat(f.total_kg) > 0);
    if (!itemsValidos.length) {
      setError("Agrega al menos un producto con bultos y kg por bulto");
      return;
    }
    setLoading(true);
    try {
      // Mandamos total_kg como qty a ERPNext
      const items = itemsValidos.map(f => ({ ...f, qty: f.total_kg }));
      await stockService.registrarEntrada({ items, notas });
      const totalKg = itemsValidos.reduce((s, f) => s + parseFloat(f.total_kg), 0);
      setSuccess(`Entrada registrada: ${itemsValidos.length} producto(s) — ${totalKg.toFixed(2)} unidades en total`);
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalKgGlobal = filas.reduce((s, f) => s + (parseFloat(f.total_kg) || 0), 0);

  return (
    <div className="rm-modal">
      <div className="rm-container entrada">
        <div className="rm-header">
          <h2>Ajuste de Entrada</h2>
          <button className="rm-btn-close" onClick={onCancel}>x</button>
        </div>

        <div className="rm-info-bar">
          <span className="rm-info-chip origen">Destino: Bodega Central</span>
          <span className="rm-info-chip" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
            Unidades convertidas calculadas
          </span>
        </div>

        {error   && <div className="rm-alert rm-alert-error">{error}</div>}
        {success && <div className="rm-alert rm-alert-success">{success}</div>}

        <div className="rm-tabla-header">
          <span>Productos a ingresar</span>
        </div>

        <table className="rm-tabla">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant. Recibida</th>
              <th>Contenido Ud.</th>
              <th>Total</th>
              <th>UOM</th>
              <th></th>
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
    if (!texto) { onChange("item_code", ""); onChange("item_name", ""); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await stockService.buscarItemsTexto(texto);
      setSugerencias(res);
      setAbierto(true);
    }, 500);
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    onChange("item_code",    item.item_code);
    onChange("item_name",    item.item_name);
    onChange("uom",          item.stock_uom || "kg");
    onChange("presentacion", item.custom_presentación || "");
    // Auto-llenar kg_por_bulto desde el catalogo
    const kgPorBulto = item["custom_cantidad_por_presentación"] || "";
    onChange("kg_por_bulto", kgPorBulto);
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
            value={fila.bultos} onChange={e => onChange("bultos", e.target.value)}
            placeholder="0" />
          <span style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
            {fila.presentacion || "Empaque(s)"}
          </span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input className="rm-qty-input" type="number" min="0" step="0.001"
            value={fila.kg_por_bulto} onChange={e => onChange("kg_por_bulto", e.target.value)}
            placeholder={fila.uom || "Uni"} />
          <span style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
            {fila.uom ? `${fila.uom} por emp.` : "x Empaque"}
          </span>
        </div>
      </td>
      <td>
        {fila.total_kg
          ? <span className="rm-total-kg">{fila.total_kg} <span style={{ fontSize: 12, fontWeight: 'normal' }}>{fila.uom || "kg"}</span></span>
          : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}
      </td>
      <td>
        <span className="rm-uom-badge">{fila.uom || "kg"}</span>
      </td>
      <td>
        <button className="rm-btn-eliminar" onClick={onEliminar} disabled={soloUna}>x</button>
      </td>
    </tr>
  );
}

export default RegistroEntrada;