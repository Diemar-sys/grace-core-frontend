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
import { pedidoService } from '../../services/frappePedido';
import { auth } from '../../services/frappeAuth';
import { parseErrorFrappe } from '../../utils/errorFrappe';
import ModalError from './ModalError';
import '../../styles/NuevaCompra.css';
import { pesos } from '../../utils/formato';

const FILA_VACIA = () => ({ _id: Math.random(), item_code: '', qty: '', costo: '', pedido: null });

/** Fecha de hoy en el formato que espera el backend (YYYY-MM-DD), en hora local. */
export const hoyISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Renglones precargados con el pedido del día: qué panes y cuántos se pidieron.
 *
 * La hoja es la verdad del PEDIDO, no de la producción — se escribe antes de que
 * el pan exista. Por eso la cantidad se precarga pero `pedido` se guarda aparte:
 * la pantalla enseña los dos y un número corregido se ve distinto del pedido.
 * Sin esto hay que teclear 77 renglones de memoria cada mañana.
 *
 * ponytail: no se pregunta la receta de cada pan (serían 77 peticiones). El
 * servidor ignora el costo tecleado cuando el pan tiene receta (`_resolver_costo`),
 * así que preguntarlo no cambiaría el resultado.
 */
export function filasDesdePedido(renglones, catalogo, entrado = {}) {
  // 🔴 21-sep: precarga `pedido − lo que YA entró hoy`. Antes la 2a entrada del día
  // volvía a traer el pedido completo y guardar sin mirar duplicaba la hornada
  // (250 conchas → 500). El pan cuyo pedido ya entró completo no se precarga; si
  // salió de más del horno, se captura a mano como siempre.
  return (renglones || [])
    .filter(r => catalogo[r.clave])
    .map(r => {
      const yaEntro = entrado[r.clave] || 0;
      return {
        _id: `ped-${r.clave}`,
        item_code: r.clave,
        qty: String((r.total ?? 0) - yaEntro),   // ≤ 0 lo descarta el filtro de abajo
        costo: costoTexto(catalogo[r.clave]?.custom_costo_estimado),
        pedido: r.total ?? null,
        yaEntro,
      };
    })
    .filter(f => parseFloat(f.qty) > 0);
}

const fmtMoney = (n) =>
  pesos(n);

/**
 * Texto del costo por pieza para el input.
 *
 * `precio × 0.35` (el costo provisional) produce ruido de coma flotante:
 * 8.70 × 0.35 = 3.0449999999999995. Sin esto, el panadero ve 16 decimales en
 * un campo de dinero. Se corta a 4 y se quitan los ceros de cola, que es la
 * misma precisión con la que ya se pinta el costo de receta.
 */
export function costoTexto(n) {
  const v = parseFloat(n);
  if (!(v > 0)) return '';
  return String(Math.round(v * 10000) / 10000);
}

/**
 * El panadero teclea el NOMBRE del pan; el backend quiere el item_code.
 * ponytail: nombre primero, código después — así un código pegado o escaneado
 * sigue sirviendo. Nombre repetido en el catálogo = gana el primero.
 */
export function resolverItemCode(texto, productos) {
  const t = (texto || '').trim().toUpperCase();
  if (!t) return '';
  const prod = productos.find(p => p.item_name?.toUpperCase() === t)
    || productos.find(p => p.item_code?.toUpperCase() === t);
  return prod?.item_code || '';
}

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

/**
 * ¿Se puede teclear el costo de este renglón? Solo el Gerente, y solo si el pan
 * no tiene receta (con receta el costo sale de los ingredientes). Candado del
 * costo, 10-sep: a los demás el servidor les ignora lo tecleado, así que dejarlos
 * escribir sería prometerles algo que no pasa.
 */
export const costoEditable = (fila, esGerente) => esGerente && !fila.conReceta;

function ModalEntradaPan({ onSuccess, onCancel }) {
  const esGerente = auth.getUser()?.role === 'Gerente';
  const [productos, setProductos] = useState([]);
  const [filas, setFilas] = useState([FILA_VACIA()]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });

  const [avisoPedido, setAvisoPedido] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      let cat = [];
      try {
        cat = await produccionService.buscarProductosTerminados('', 500);
      } catch (err) {
        if (vivo) setErrorModal({ isOpen: true, ...parseErrorFrappe(err) });
        return;
      }
      if (!vivo) return;
      setProductos(cat);

      // El pedido del día precarga los renglones. Si no hay pedido cargado, la
      // pantalla sigue sirviendo a mano: no encontrarlo no es un error.
      const mapa = Object.fromEntries(cat.map(p => [p.item_code, p]));
      try {
        // Sin saber qué ya entró hoy NO se precarga: precargar el pedido completo
        // es justo lo que duplicaba la hornada.
        const [ped, entrado] = await Promise.all([
          pedidoService.consultar(hoyISO()),
          produccionService.entradoHoy(hoyISO()),
        ]);
        if (!vivo) return;
        const filasPed = filasDesdePedido(ped?.renglones, mapa, entrado);
        if (!filasPed.length) {
          setAvisoPedido(ped?.renglones?.length
            ? 'Ya entró todo lo pedido hoy: captura a mano solo lo que salió de más.'
            : 'No hay pedido cargado para hoy: captura la hornada a mano.');
          return;
        }
        setFilas(filasPed);
        setAvisoPedido(Object.keys(entrado).length
          ? `Precargado lo que falta del pedido de hoy (${filasPed.length} panes): ya se descontó lo que entró antes.`
          : `Precargado del pedido de hoy (${filasPed.length} panes). Corrige lo que salió distinto del horno.`);
      } catch {
        if (vivo) setAvisoPedido('No se pudo leer el pedido de hoy o lo que ya entró: captura la hornada a mano.');
      }
    })();
    return () => { vivo = false; };
  }, []);

  const catalogo = useMemo(
    () => Object.fromEntries(productos.map(p => [p.item_code, p])),
    [productos],
  );

  const updateFila = (id, campos) =>
    setFilas(f => f.map(r => r._id === id ? { ...r, ...campos } : r));

  // Al elegir producto se precarga su costo de catálogo. Editable SOLO para el
  // Gerente y si el pan no tiene receta (`costoEditable`): con receta el costo sale de los ingredientes y sus precios de
  // compra, y el servidor ignora lo que se teclee aquí — pedirlo sería mentir.
  const elegirProducto = async (id, texto) => {
    const prod = catalogo[resolverItemCode(texto, productos)];
    updateFila(id, {
      item_code: prod?.item_code || '',
      costo: costoTexto(prod?.custom_costo_estimado),
      conReceta: false,
    });
    if (!prod?.item_code) return;
    try {
      const receta = await produccionService.costoRecetaHoy(prod.item_code);
      if (receta) {
        updateFila(id, { conReceta: true, costo: String(receta.hoy.por_pieza.toFixed(4)) });
      }
    } catch {
      /* sin respuesta se queda editable: es el comportamiento de siempre */
    }
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
        message: `Sin costo no se puede valuar la entrada: ${sinCosto.map(f => catalogo[f.item_code]?.item_name || f.item_code).join(', ')}. ${esGerente ? 'Captúralo aquí o en el catálogo del producto.' : 'Pídele al Gerente que lo capture en el catálogo del producto.'}`,
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
        {avisoPedido && <p className="nc-hint nc-aviso-pedido">{avisoPedido}</p>}

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
                      defaultValue={catalogo[fila.item_code]?.item_name || ''}
                      placeholder="Escribe el pan..."
                      onChange={e => elegirProducto(fila._id, e.target.value)}
                    />
                    {fila.item_code && (
                      <small className="nc-th-hint">
                        {fila.item_code} · {catalogo[fila.item_code]?.stock_uom}
                      </small>
                    )}
                  </td>
                  <td>
                    <input type="number" className="nc-input" min="0" step="1"
                      value={fila.qty}
                      onChange={e => updateFila(fila._id, { qty: e.target.value })} />
                    {fila.pedido != null && (
                      <small className="nc-th-hint">
                        pedido: {fila.pedido}
                        {fila.yaEntro > 0 && ` · ya entró ${fila.yaEntro}`}
                        {parseFloat(fila.qty) !== fila.pedido - (fila.yaEntro || 0) && ' · corregido'}
                      </small>
                    )}
                  </td>
                  <td>
                    <input type="number" className="nc-input" min="0" step="0.01"
                      placeholder="Del catálogo"
                      value={fila.costo}
                      readOnly={!costoEditable(fila, esGerente)}
                      title={fila.conReceta
                        ? 'Sale de la receta: se cambia editando la receta en Producción'
                        : !esGerente ? 'El costo lo cambia solo el Gerente, en el catálogo' : undefined}
                      onChange={e => updateFila(fila._id, { costo: e.target.value })} />
                    {fila.conReceta && <small className="nc-hint">de la receta</small>}
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
            <option key={p.item_code} value={p.item_name}>{p.item_code}</option>
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
