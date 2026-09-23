import { Fragment, useMemo, useState } from 'react';
import { ventasService } from '../../services/frappeSales';
import { pesos, cantidad } from '../../utils/formato';
import '../../styles/RegistrarPago.css';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Modal para registrar pago contra facturas pendientes de un cliente.
 *
 * Selección por checkbox: marca las facturas que ya te pagaron (o edita el monto
 * por fila para pagos parciales). Arranca vacío; se cobra exactamente lo asignado.
 *
 * Clic en el renglón despliega los productos de esa factura, para saber QUÉ se
 * debe y no solo cuánto. Se piden al abrir (una factura a la vez) y se guardan:
 * reabrir no vuelve a pegarle al servidor.
 */
export default function ModalRegistrarPago({ grupo, onSuccess, onCancel }) {
  const [alloc, setAlloc] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [abiertas, setAbiertas] = useState({});
  const [productos, setProductos] = useState({});

  const totalAsignado = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + parseFloat(v || 0), 0),
    [alloc]
  );
  const handleAllocChange = (name, value) => {
    setAlloc(prev => ({ ...prev, [name]: value }));
  };

  // Checkbox por fila: marcar = pagar el saldo COMPLETO de esa factura; desmarcar = 0.
  // Permite elegir "esta ya me la pagó" sin depender del FIFO.
  const toggleFactura = (f) => {
    const pagada = parseFloat(alloc[f.name] || 0) > 0;
    setAlloc(prev => ({ ...prev, [f.name]: pagada ? '0' : String(f.outstanding_amount) }));
  };

  const toggleProductos = async (name) => {
    const abrir = !abiertas[name];
    setAbiertas(prev => ({ ...prev, [name]: abrir }));
    if (!abrir || productos[name]) return;
    try {
      const items = await ventasService.getFacturaItems(name);
      setProductos(prev => ({ ...prev, [name]: items }));
    } catch (err) {
      setProductos(prev => ({ ...prev, [name]: { error: err.message || 'No se pudieron cargar' } }));
    }
  };

  const handleConfirmar = async () => {
    setError('');
    const facturas = grupo.facturas
      .map(f => ({ name: f.name, allocated: parseFloat(alloc[f.name] || 0) }))
      .filter(f => f.allocated > 0);
    if (!facturas.length) { setError('Marca o asigna monto a alguna factura'); return; }
    // El pago es EXACTAMENTE lo asignado (no un monto fijo aparte). Así se puede pagar
    // una factura específica aunque sea más reciente, sin quedar bloqueado por FIFO.
    const pagoTotal = round2(facturas.reduce((s, f) => s + f.allocated, 0));
    setLoading(true);
    try {
      await ventasService.registrarPago({
        customer: grupo.customer,
        facturas,
        monto: pagoTotal,
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Error registrando pago');
    } finally {
      setLoading(false);
    }
  };

  const marcadas = grupo.facturas.filter(f => parseFloat(alloc[f.name] || 0) > 0).length;

  return (
    <div className="nc-modal-overlay">
      <div className="rp-modal" role="dialog" aria-labelledby="rp-titulo">
        <header className="rp-header">
          <div>
            <span className="rp-eyebrow">Registrar pago</span>
            <h2 id="rp-titulo" className="rp-cliente">{grupo.customer_name}</h2>
          </div>
          <button className="rp-cerrar" onClick={onCancel} aria-label="Cerrar">×</button>
        </header>

        <div className="rp-resumen">
          <div className="rp-stat">
            <span className="rp-stat-label">Deuda total</span>
            <span className="rp-stat-valor rp-deuda">{pesos(grupo.totalDeuda)}</span>
          </div>
          <div className="rp-stat">
            <span className="rp-stat-label">Facturas pendientes</span>
            <span className="rp-stat-valor">{grupo.facturas.length}</span>
          </div>
          <div className="rp-stat">
            <span className="rp-stat-label">Se cobra ({marcadas} marcadas)</span>
            <span className="rp-stat-valor rp-cobra">{pesos(totalAsignado)}</span>
          </div>
        </div>

        <p className="rp-ayuda">
          Marca las facturas que ya te pagaron o escribe el monto para un pago parcial.
          Toca una factura para ver qué productos se deben.
        </p>

        {error && <div className="nc-alert nc-alert-error rp-error">{error}</div>}

        <div className="rp-tabla-wrap">
          <table className="sys-table rp-tabla">
            <thead>
              <tr>
                <th className="rp-col-caret" aria-label="Productos"></th>
                <th>Fecha</th>
                <th># Venta</th>
                <th className="cell-right">Total</th>
                <th className="cell-right">Saldo</th>
                <th className="cell-right">Asignar</th>
                <th className="rp-col-check">✓</th>
              </tr>
            </thead>
            <tbody>
              {grupo.facturas.map(f => {
                const abierta = !!abiertas[f.name];
                const marcada = parseFloat(alloc[f.name] || 0) > 0;
                return (
                  <Fragment key={f.name}>
                    <tr
                      className={`row-clickable${abierta ? ' row-open' : ''}${marcada ? ' rp-marcada' : ''}`}
                      onClick={() => toggleProductos(f.name)}
                    >
                      <td className="rp-col-caret">{abierta ? '▼' : '▶'}</td>
                      <td>{f.posting_date}</td>
                      <td className="cell-code">
                        {f.custom_no_de_venta ? `#${f.custom_no_de_venta}` : f.name}
                      </td>
                      <td className="cell-right">{pesos(f.grand_total)}</td>
                      <td className="cell-right rp-saldo">{pesos(f.outstanding_amount)}</td>
                      <td className="cell-right" onClick={e => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={f.outstanding_amount}
                          value={alloc[f.name] || ''}
                          onChange={e => handleAllocChange(f.name, e.target.value)}
                          className="rp-monto"
                          aria-label={`Monto a cobrar de ${f.custom_no_de_venta || f.name}`}
                        />
                      </td>
                      <td className="rp-col-check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rp-checkbox"
                          checked={marcada}
                          onChange={() => toggleFactura(f)}
                          aria-label={`Pagar factura ${f.custom_no_de_venta || f.name}`}
                        />
                      </td>
                    </tr>
                    {abierta && (
                      <tr className="row-detail">
                        <td colSpan={7}>
                          <ProductosFactura items={productos[f.name]} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="rp-acciones">
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button
            className="nc-btn-primary"
            onClick={handleConfirmar}
            disabled={loading || totalAsignado <= 0}
          >
            {loading ? 'Registrando...' : `Registrar pago ${pesos(totalAsignado)}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Productos de una factura: undefined = cargando, {error} = falló, [] = vacía. */
function ProductosFactura({ items }) {
  if (items === undefined) return <div className="rp-productos-msg">Cargando productos...</div>;
  if (items.error) return <div className="rp-productos-msg rp-productos-error">{items.error}</div>;
  if (!items.length) return <div className="rp-productos-msg">Esta factura no trae productos.</div>;
  return (
    <table className="rp-productos">
      <thead>
        <tr>
          <th>Producto</th>
          <th className="cell-right">Cantidad</th>
          <th className="cell-right">Precio c/imp.</th>
          <th className="cell-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={`${it.item_code}-${i}`}>
            <td>{it.item_name || it.item_code}</td>
            <td className="cell-right">{cantidad(it.qty)} {it.uom}</td>
            <td className="cell-right">{pesos(it.precio)}</td>
            <td className="cell-right">{pesos(it.importe)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
