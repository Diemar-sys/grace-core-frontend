import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { egresosService } from '../services/frappeEgresos';
import '../styles/global.css';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReporteCuentasPorPagar() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soloSaldo, setSoloSaldo] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setData(await egresosService.getCuentasPorPagar()); }
    catch (err) { console.error('Error reporte CxP:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filas = useMemo(
    () => soloSaldo ? data.filter(r => (parseFloat(r.pendiente) || 0) > 0.005) : data,
    [data, soloSaldo],
  );

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

        <div className="stats-cards" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <span className="stat-number">{filas.length}</span>
            <span className="stat-label">Proveedores</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-number comp-stat-total" style={{ color: '#dc2626' }}>${fmt(tot.pendiente)}</span>
            <span className="stat-label">Se debe</span>
          </div>
          <div className="stat-card">
            <span className="stat-number comp-stat-total" style={{ color: '#16a34a' }}>${fmt(tot.pagado)}</span>
            <span className="stat-label">Pagado</span>
          </div>
          <div className="stat-card">
            <span className="stat-number comp-stat-total">${fmt(tot.total)}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>

        <div className="filtros-section" style={{ alignItems: 'center' }}>
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
