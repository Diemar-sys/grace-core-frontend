import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { comprasService } from '../services/frappePurchase';
import '../styles/global.css';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function ReporteCompras() {
  const navigate = useNavigate();
  const añoActual = new Date().getFullYear();
  const [año, setAño] = useState(añoActual);
  const [mes, setMes] = useState(new Date().getMonth() + 1); // 1-12, default mes actual
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

  const mesKey = `${año}-${String(mes).padStart(2, '0')}`;
  const filtrada = useMemo(() => data.filter(r => r.mes === mesKey), [data, mesKey]);

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

        {/* Resumen del año + controles (mes / año / actualizar) en una sola fila */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch', marginBottom: 16 }}>
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

          {/* Controles: mismo alto que las tarjetas, alineado a la derecha */}
          <div style={{
            marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'flex-end',
            padding: '14px 20px', background: 'var(--tv-surface, #fff)',
            border: '1px solid var(--tv-hairline, #e5e7eb)', borderRadius: 12,
          }}>
            <div className="filtro-group filtro-sm">
              <label>Mes</label>
              <select value={mes} onChange={e => setMes(Number(e.target.value))} className="comp-date-input">
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="filtro-group filtro-sm">
              <label>Año</label>
              <select value={año} onChange={e => setAño(Number(e.target.value))} className="comp-date-input">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
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
                {filtrada.length === 0 ? (
                  <tr><td colSpan={16} className="no-data">Sin compras confirmadas en {MESES[mes - 1]} {año}</td></tr>
                ) : filtrada.map(r => (
                  <tr key={r.mes}>
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
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ReporteCompras;
