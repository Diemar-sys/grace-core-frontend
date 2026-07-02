import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { egresosService } from '../services/frappeEgresos';
import '../styles/global.css';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const FACTURADOS = ['ALMA RODRIGUEZ', 'LUIS TORRES', 'SIN FACTURA'];
const FACT_LABEL = { 'ALMA RODRIGUEZ': 'Alma Rodríguez', 'LUIS TORRES': 'Luis Torres', 'SIN FACTURA': 'Sin factura' };

// Saldo pendiente por facturado_a — siempre los 3 buckets (aunque vengan en 0).
export function pendientePorFacturado(rows) {
  const acc = Object.fromEntries(FACTURADOS.map(f => [f, 0]));
  for (const r of rows || []) {
    const k = FACTURADOS.includes(r.facturado_a) ? r.facturado_a : 'SIN FACTURA';
    acc[k] += parseFloat(r.pendiente) || 0;
  }
  return acc;
}

// Filas por proveedor para la tabla. 'todas' re-agrega los facturado_a (= reporte original).
export function filasCxP(rows, facturadoFiltro) {
  rows = rows || [];
  if (facturadoFiltro !== 'todas') return rows.filter(r => r.facturado_a === facturadoFiltro);
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.proveedor) || { proveedor: r.proveedor, n: 0, total: 0, pagado: 0, pendiente: 0 };
    cur.n        += r.n || 0;
    cur.total    += parseFloat(r.total) || 0;
    cur.pagado   += parseFloat(r.pagado) || 0;
    cur.pendiente += parseFloat(r.pendiente) || 0;
    map.set(r.proveedor, cur);
  }
  return [...map.values()].sort((a, b) => b.pendiente - a.pendiente);
}

function ReporteCuentasPorPagar() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soloSaldo, setSoloSaldo] = useState(true);
  const [facturado, setFacturado] = useState('todas');

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setData(await egresosService.getCuentasPorPagar()); }
    catch (err) { console.error('Error reporte CxP:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Strip: siempre sobre TODO el dato, no afectado por el dropdown.
  const strip = useMemo(() => pendientePorFacturado(data), [data]);

  const filas = useMemo(() => {
    const base = filasCxP(data, facturado);
    return soloSaldo ? base.filter(r => (parseFloat(r.pendiente) || 0) > 0.005) : base;
  }, [data, facturado, soloSaldo]);

  const tot = useMemo(() => filas.reduce((a, r) => ({
    n: a.n + (r.n || 0),
    total: a.total + (parseFloat(r.total) || 0),
    pagado: a.pagado + (parseFloat(r.pagado) || 0),
    pendiente: a.pendiente + (parseFloat(r.pendiente) || 0),
  }), { n: 0, total: 0, pagado: 0, pendiente: 0 }), [filas]);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group">
            <div>
              <h1 style={{ margin: 0 }}>Cuentas por Pagar</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Saldo de egresos por proveedor (pendiente vs pagado)
              </span>
            </div>
          </div>
          <button className="btn-refresh" onClick={() => navigate('/panel?seccion=reportes')}>← Volver</button>
        </div>

        {/* Strip: se debe por facturado_a — siempre visible, los 3 */}
        <div className="cxp-strip" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {FACTURADOS.map(f => (
            <button key={f} type="button"
              onClick={() => setFacturado(facturado === f ? 'todas' : f)}
              className="stat-card"
              style={{
                flex: '1 1 180px', textAlign: 'left', cursor: 'pointer',
                border: facturado === f ? '2px solid var(--tv-marca)' : '1px solid var(--tv-hairline)',
                background: facturado === f ? 'var(--tv-marca-wash)' : undefined,
              }}>
              <span className="stat-number comp-stat-total" style={{ color: '#dc2626' }}>${fmt(strip[f])}</span>
              <span className="stat-label">{FACT_LABEL[f]} · se debe</span>
            </button>
          ))}
        </div>

        <div className="filtros-section" style={{ alignItems: 'center' }}>
          <div className="filtro-group filtro-sm">
            <label>Facturado a</label>
            <select value={facturado} onChange={e => setFacturado(e.target.value)}>
              <option value="todas">Todas</option>
              {FACTURADOS.map(f => <option key={f} value={f}>{FACT_LABEL[f]}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloSaldo} onChange={e => setSoloSaldo(e.target.checked)} />
            Solo con saldo pendiente
          </label>
          <div className="header-actions" style={{ marginLeft: 'auto' }}>
            <button className="btn-refresh btn-compacto" onClick={cargar} disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Cargando reporte...</div>
        ) : (
          <div className="table-container">
            <table className="sys-table report-compact">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th className="cell-right"># Egresos</th>
                  <th className="cell-right">Total</th>
                  <th className="cell-right">Pagado</th>
                  <th className="cell-right">Se debe</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr><td colSpan={5} className="no-data">Sin cuentas por pagar.</td></tr>
                ) : filas.map(r => (
                  <tr key={r.proveedor}>
                    <td className="cell-name">{r.proveedor}</td>
                    <td className="cell-right">{r.n}</td>
                    <td className="cell-right cell-bold">${fmt(r.total)}</td>
                    <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.pagado)}</td>
                    <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.pendiente)}</td>
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
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ReporteCuentasPorPagar;
