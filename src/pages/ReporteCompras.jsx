import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { comprasService } from '../services/frappePurchase';
import '../styles/global.css';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReporteCompras() {
  const navigate = useNavigate();
  const añoActual = new Date().getFullYear();
  const [año, setAño] = useState(añoActual);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async (a) => {
    setLoading(true);
    try {
      setData(await comprasService.getReporteFiscalMensual(a || año));
    } catch (err) {
      console.error('Error reporte compras:', err);
    } finally {
      setLoading(false);
    }
  }, [año]);

  useEffect(() => { cargar(año); }, [cargar, año]);

  const tot = useMemo(() => data.reduce((a, r) => ({
    compras: a.compras + r.compras,
    subtotalIva16: a.subtotalIva16 + r.subtotalIva16,
    subtotalIeps:  a.subtotalIeps  + r.subtotalIeps,
    subtotalTasa0: a.subtotalTasa0 + r.subtotalTasa0,
    subtotal: a.subtotal + r.subtotal,
    iva:  a.iva  + r.iva,
    ieps: a.ieps + r.ieps,
    total: a.total + r.total,
    pagado: a.pagado + (r.pagado || 0),
    pendiente: a.pendiente + (r.pendiente || 0),
    almaPag:  a.almaPag  + (r.porFacturado?.alma?.pagado || 0),
    almaDebe: a.almaDebe + (r.porFacturado?.alma?.pendiente || 0),
    luisPag:  a.luisPag  + (r.porFacturado?.luis?.pagado || 0),
    luisDebe: a.luisDebe + (r.porFacturado?.luis?.pendiente || 0),
    sfPag:    a.sfPag    + (r.porFacturado?.sinFactura?.pagado || 0),
    sfDebe:   a.sfDebe   + (r.porFacturado?.sinFactura?.pendiente || 0),
  }), { compras:0, subtotalIva16:0, subtotalIeps:0, subtotalTasa0:0, subtotal:0, iva:0, ieps:0, total:0, pagado:0, pendiente:0,
        almaPag:0, almaDebe:0, luisPag:0, luisDebe:0, sfPag:0, sfDebe:0 }), [data]);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group">
            <div>
              <h1 style={{ margin: 0 }}>Reporte de Compras</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Resumen fiscal mensual por proveedor y responsable fiscal
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-refresh" onClick={() => navigate('/panel?seccion=reportes')}>← Volver</button>
          </div>
        </div>

        {/* Resumen del año (lo que antes vivía en la vista de Compras) */}
        <div className="stats-cards" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <span className="stat-number">{tot.compras}</span>
            <span className="stat-label">Confirmadas</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-number comp-stat-total">${fmt(tot.total)}</span>
            <span className="stat-label">Total {año}</span>
          </div>
          <div className="stat-card">
            <span className="stat-number comp-stat-total" style={{ color: '#16a34a' }}>${fmt(tot.pagado)}</span>
            <span className="stat-label">Pagado</span>
          </div>
          <div className="stat-card">
            <span className="stat-number comp-stat-total" style={{ color: '#dc2626' }}>${fmt(tot.pendiente)}</span>
            <span className="stat-label">Se debe</span>
          </div>
        </div>

        <div className="filtros-section" style={{ alignItems: 'center' }}>
          <div className="filtro-group filtro-sm">
            <label>Año</label>
            <select value={año} onChange={e => setAño(Number(e.target.value))} className="comp-date-input">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="header-actions" style={{ marginLeft: 'auto' }}>
            <button className="btn-refresh btn-compacto" onClick={() => cargar(año)} disabled={loading}>
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
                  <th rowSpan={2}>Mes</th>
                  <th className="cell-right" rowSpan={2}># Compras</th>
                  <th className="cell-right" rowSpan={2}>Subtotal IVA 16%</th>
                  <th className="cell-right" rowSpan={2}>Subtotal IEPS 8%</th>
                  <th className="cell-right" rowSpan={2}>Subtotal IVA 0%</th>
                  <th className="cell-right" rowSpan={2}>Subtotal</th>
                  <th className="cell-right" rowSpan={2}>IVA 16%</th>
                  <th className="cell-right" rowSpan={2}>IEPS 8%</th>
                  <th className="cell-right" rowSpan={2}>Total</th>
                  <th className="cell-right" rowSpan={2}>Pagado</th>
                  <th className="cell-right" rowSpan={2}>Se debe</th>
                  <th className="cell-right" colSpan={2}>Alma</th>
                  <th className="cell-right" colSpan={2}>Luis</th>
                  <th className="cell-right" colSpan={2}>S/F</th>
                </tr>
                <tr>
                  <th className="cell-right">Pagado</th><th className="cell-right">Debe</th>
                  <th className="cell-right">Pagado</th><th className="cell-right">Debe</th>
                  <th className="cell-right">Pagado</th><th className="cell-right">Debe</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={17} className="no-data">Sin compras confirmadas en {año}</td></tr>
                ) : data.map(r => (
                  <tr key={r.mes}>
                    <td className="cell-name">{new Date(r.mes + '-02').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</td>
                    <td className="cell-right">{r.compras}</td>
                    <td className="cell-right">${fmt(r.subtotalIva16)}</td>
                    <td className="cell-right">${fmt(r.subtotalIeps)}</td>
                    <td className="cell-right">${fmt(r.subtotalTasa0)}</td>
                    <td className="cell-right cell-bold">${fmt(r.subtotal)}</td>
                    <td className="cell-right">${fmt(r.iva)}</td>
                    <td className="cell-right">${fmt(r.ieps)}</td>
                    <td className="cell-right cell-bold">${fmt(r.total)}</td>
                    <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.pagado)}</td>
                    <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.pendiente)}</td>
                    <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.porFacturado?.alma?.pagado || 0)}</td>
                    <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.porFacturado?.alma?.pendiente || 0)}</td>
                    <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.porFacturado?.luis?.pagado || 0)}</td>
                    <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.porFacturado?.luis?.pendiente || 0)}</td>
                    <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.porFacturado?.sinFactura?.pagado || 0)}</td>
                    <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.porFacturado?.sinFactura?.pendiente || 0)}</td>
                  </tr>
                ))}
              </tbody>
              {data.length > 1 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid #374151', background: '#f9fafb' }}>
                    <td>TOTAL {año}</td>
                    <td className="cell-right">{tot.compras}</td>
                    <td className="cell-right">${fmt(tot.subtotalIva16)}</td>
                    <td className="cell-right">${fmt(tot.subtotalIeps)}</td>
                    <td className="cell-right">${fmt(tot.subtotalTasa0)}</td>
                    <td className="cell-right">${fmt(tot.subtotal)}</td>
                    <td className="cell-right">${fmt(tot.iva)}</td>
                    <td className="cell-right">${fmt(tot.ieps)}</td>
                    <td className="cell-right">${fmt(tot.total)}</td>
                    <td className="cell-right">${fmt(tot.pagado)}</td>
                    <td className="cell-right">${fmt(tot.pendiente)}</td>
                    <td className="cell-right">${fmt(tot.almaPag)}</td>
                    <td className="cell-right">${fmt(tot.almaDebe)}</td>
                    <td className="cell-right">${fmt(tot.luisPag)}</td>
                    <td className="cell-right">${fmt(tot.luisDebe)}</td>
                    <td className="cell-right">${fmt(tot.sfPag)}</td>
                    <td className="cell-right">${fmt(tot.sfDebe)}</td>
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

export default ReporteCompras;
