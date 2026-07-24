// src/components/modals/ModalEntradaPan.jsx
/**
 * Alta de pan terminado SIN receta: la hornada entra al almacén de pan valuada
 * al costo estimado del catálogo. Mientras no existan los BOM, esta es la puerta
 * por la que el pan llega al inventario para poder repartirse.
 *
 * ponytail: el buscador es un <datalist> nativo, no un autocomplete propio.
 * Son ~50 panes: se cargan de una y el navegador filtra solo (sin debounce,
 * sin navegación por teclado que mantener).
 */
import { useState, useEffect, useMemo } from 'react';
import { produccionService } from '../../services/frappeProduccion';
import { parseErrorFrappe } from '../../utils/errorFrappe';
import ModalError from './ModalError';
import '../../styles/NuevaCompra.css';

const FILA_VACIA = () => ({ _id: Math.random(), item_code: '', qty: '', costo: '' });

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/** Renglones listos para el backend. Exportado: es lo que se prueba. */
export function itemsPayload(filas) {
  return filas
    .filter(f => f.item_code && parseFloat(f.qty) > 0)
    .map(f => ({
      item_code: f.item_code,
      qty: parseFloat(f.qty),
      ...(parseFloat(f.costo) > 0 ? { costo: parseFloat(f.costo) } : {}),
    }));
}

/** Valor total de la hornada. El costo tecleado manda; si no, el del catálogo. */
export function calcularValor(filas, catalogo) {
  return filas.reduce((acc, f) => {
    const qty = parseFloat(f.qty) || 0;
    if (!f.item_code || qty <= 0) return acc;
    const costo = parseFloat(f.costo) > 0
      ? parseFloat(f.costo)
      : parseFloat(catalogo[f.item_code]?.custom_costo_estimado) || 0;
    return acc + qty * costo;
  }, 0);
}

function ModalEntradaPan({ onSuccess, onCancel }) {
  const [productos, setProductos] = useState([]);
  const [filas, setFilas] = useState([FILA_VACIA()]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    produccionService.buscarProductosTerminados('', 500)
      .then(setProductos)
      .catch(err => setErrorModal({ isOpen: true, ...parseErrorFrappe(err) }));
  }, []);

  const catalogo = useMemo(
    () => Object.fromEntries(productos.map(p => [p.item_code, p])),
    [productos],
  );

  const updateFila = (id, campos) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, ...campos } : r));

  // Al elegir producto se precarga su costo de catálogo (editable).
  const elegirProducto = (id, itemCode) => {
    const prod = catalogo[itemCode];
    updateFila(id, {
      item_code: prod ? itemCode : '',
      costo: prod?.custom_costo_estimado ? String(prod.custom_costo_estimado) : '',
    });
  };

  const valorTotal = calcularValor(filas, catalogo);
  const sinCosto = filas.filter(
    f => f.item_code && parseFloat(f.qty) > 0 && !(parseFloat(f.costo) > 0),
  );

  const guardar = async () => {
    const items = itemsPayload(filas);
    if (!items.length) {
      setErrorModal({ isOpen: true, title: 'Falta capturar', message: 'Agrega al menos un producto con cantidad.' });
      return;
    }
    if (sinCosto.length) {
      setErrorModal({
        isOpen: true,
        title: 'Falta el costo',
        message: `Sin costo no se puede valuar la entrada: ${sinCosto.map(f => catalogo[f.item_code]?.item_name || f.item_code).join(', ')}. Captúralo aquí o en el catálogo del producto.`,
      });
      return;
    }
    setLoading(true);
    try {
      const res = await produccionService.registrarEntradaPan({ items, notas });
      onSuccess?.(res);
    } catch (err) {
      setErrorModal({ isOpen: true, ...parseErrorFrappe(err) });
    } finally { setLoading(false); }
  };

  return (
    <div className="nc-modal-overlay">
      <ModalError
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
      />

      <div className="nc-container nc-entrada-pan" style={{ maxWidth: 760, margin: 0 }}>
        <div className="nc-header">
          <h2>Entrada de Pan</h2>
          <button className="nc-btn-close" onClick={onCancel}>×</button>
        </div>

        <p className="nc-section-title">Pan producido hoy — cada pan entra al almacén de su departamento</p>

        <div className="nc-tabla-scroll">
          <table className="nc-tabla">
            <colgroup>
              <col style={{ width: '52%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo por pieza</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(fila => (
                <tr key={fila._id}>
                  <td>
                    <input
                      className="nc-input"
                      list="pan-terminado-lista"
                      defaultValue={fila.item_code}
                      placeholder="Escribe el pan..."
                      onChange={e => elegirProducto(fila._id, e.target.value)}
                    />
                    {fila.item_code && (
                      <small className="nc-th-hint">
                        {catalogo[fila.item_code]?.item_name} · {catalogo[fila.item_code]?.stock_uom}
                      </small>
                    )}
                  </td>
                  <td>
                    <input type="number" className="nc-input" min="0" step="1"
                      value={fila.qty}
                      onChange={e => updateFila(fila._id, { qty: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" className="nc-input" min="0" step="0.01"
                      placeholder="Del catálogo"
                      value={fila.costo}
                      onChange={e => updateFila(fila._id, { costo: e.target.value })} />
                  </td>
                  <td>
                    <button className="nc-btn-eliminar"
                      disabled={filas.length === 1}
                      onClick={() => setFilas(f => f.filter(r => r._id !== fila._id))}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <datalist id="pan-terminado-lista">
          {productos.map(p => (
            <option key={p.item_code} value={p.item_code}>{p.item_name}</option>
          ))}
        </datalist>

        <button className="nc-btn-agregar" onClick={() => setFilas(f => [...f, FILA_VACIA()])}>
          + Agregar producto
        </button>

        <label className="nc-notas-label">Notas (opcional)</label>
        <textarea className="nc-notas" value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Ej: Hornada matutina" />

        <div className="nc-entrada-total">
          <span>Valor de la hornada</span>
          <strong>{fmtMoney(valorTotal)}</strong>
        </div>

        <div className="nc-actions">
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="nc-btn-primary" onClick={guardar} disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalEntradaPan;
