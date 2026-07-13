import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import ModalRegistrarPago from './modals/ModalRegistrarPago';
import { ventasService } from '../services/frappeSales';

const fmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Cuentas por cobrar B2B: tarjetas (Total/Cobrado/Se debe) + tabla por cliente.
 * Compartido entre el reporte (readOnly) y Ventas B2B → Registrar Cobro (con botón Cobrar).
 *
 * @param {boolean} [readOnly=false] true → sin columna/botón Cobrar (solo consulta).
 * ref.recargar() → refresca los datos (para el botón "Actualizar" del padre).
 */
const TablaCuentasPorCobrar = forwardRef(function TablaCuentasPorCobrar({ readOnly = false }, ref) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soloSaldo, setSoloSaldo] = useState(true);
  const [pagoModal, setPagoModal] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setData(await ventasService.getCuentasPorCobrar()); }
    catch (err) { console.error('Error CxC:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

  const filas = useMemo(
    () => soloSaldo ? data.filter(r => (parseFloat(r.pendiente) || 0) > 0.005) : data,
    [data, soloSaldo]
  );

  const tot = useMemo(() => filas.reduce((a, r) => ({
    n: a.n + (r.n || 0),
    total: a.total + (parseFloat(r.total) || 0),
    pagado: a.pagado + (parseFloat(r.pagado) || 0),
    pendiente: a.pendiente + (parseFloat(r.pendiente) || 0),
  }), { n: 0, total: 0, pagado: 0, pendiente: 0 }), [filas]);

  // Abre el modal de cobro: trae las SI pendientes del cliente y arma el grupo FIFO.
  const abrirCobro = async (fila) => {
    try {
      const facturas = await ventasService.getFacturasPendientes({ customer: fila.customer });
      if (!facturas.length) { await cargar(); return; }
      setPagoModal({
        customer: fila.customer,
        customer_name: fila.customer_name,
        totalDeuda: facturas.reduce((s, f) => s + parseFloat(f.outstanding_amount || 0), 0),
        facturas,
      });
    } catch (err) { console.error('Error abriendo cobro:', err); }
  };

  const nCols = readOnly ? 5 : 6;

  return (
    <>
      <div className="stats-cards" style={{ marginBottom: 16 }}>
        <div className="stat-card warning">
          <span className="stat-number comp-stat-total">${fmt(tot.total)}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card">
          <span className="stat-number comp-stat-total" style={{ color: '#16a34a' }}>${fmt(tot.pagado)}</span>
          <span className="stat-label">Cobrado</span>
        </div>
        <div className="stat-card">
          <span className="stat-number comp-stat-total" style={{ color: '#dc2626' }}>${fmt(tot.pendiente)}</span>
          <span className="stat-label">Se debe</span>
        </div>
      </div>

      <div className="filtros-section" style={{ alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={soloSaldo} onChange={e => setSoloSaldo(e.target.checked)} />
          Solo con saldo pendiente
        </label>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="table-container">
          <table className="sys-table report-compact">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="cell-right"># Ventas</th>
                <th className="cell-right">Total</th>
                <th className="cell-right">Cobrado</th>
                <th className="cell-right">Se debe</th>
                {!readOnly && <th className="cell-right"></th>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={nCols} className="no-data">Sin cuentas por cobrar.</td></tr>
              ) : filas.map(r => (
                <tr key={r.customer}>
                  <td className="cell-name">{r.customer_name}</td>
                  <td className="cell-right">{r.n}</td>
                  <td className="cell-right cell-bold">${fmt(r.total)}</td>
                  <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.pagado)}</td>
                  <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.pendiente)}</td>
                  {!readOnly && (
                    <td className="cell-right">
                      {(parseFloat(r.pendiente) || 0) > 0.005 && (
                        <button className="btn-refresh btn-compacto" onClick={() => abrirCobro(r)}>
                          Cobrar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {filas.length > 1 && (
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid #374151', background: '#f9fafb' }}>
                  <td>TOTAL</td>
                  <td className="cell-right">{tot.n}</td>
                  <td className="cell-right">${fmt(tot.total)}</td>
                  <td className="cell-right">${fmt(tot.pagado)}</td>
                  <td className="cell-right">${fmt(tot.pendiente)}</td>
                  {!readOnly && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {pagoModal && (
        <ModalRegistrarPago
          grupo={pagoModal}
          onSuccess={() => { setPagoModal(null); cargar(); }}
          onCancel={() => setPagoModal(null)}
        />
      )}
    </>
  );
});

export default TablaCuentasPorCobrar;
