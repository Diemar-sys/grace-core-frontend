import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { reportesService } from '../services/frappeReportes';
import '../styles/global.css';

function hoyISO() { return new Date().toISOString().split('T')[0]; }
function iso(d) { return d.toISOString().split('T')[0]; }

function inicioSemanaISO() {
  const d = new Date();
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  return iso(d);
}
function inicioMesISO() {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}
function inicioAnioISO() {
  const d = new Date();
  return iso(new Date(d.getFullYear(), 0, 1));
}

function fmtMoney(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  });
}

function ReporteGastos() {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(inicioMesISO);
  const [hasta, setHasta] = useState(hoyISO);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(new Set());

  const cargar = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const result = await reportesService.getReporteGastos({ desde, hasta }, signal);
      setData(result);
      setExpandido(new Set());
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    const c = new AbortController();
    cargar(c.signal);
    return () => c.abort();
  }, [cargar]);

  const toggle = (cuenta) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(cuenta)) next.delete(cuenta); else next.add(cuenta);
      return next;
    });
  };

  const setRango = (ini) => { setDesde(ini); setHasta(hoyISO()); };

  const cuentas = data?.cuentas || [];
  const tot = data?.totales || { compras: 0, egresos: 0, total: 0 };

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group">
            <div>
              <h1 style={{ margin: 0 }}>Gasto por Cuenta</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Compras (inventario) + Egresos, por responsable fiscal y periodo
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-refresh" onClick={() => navigate('/panel?seccion=reportes')}>
              ← Volver
            </button>
          </div>
        </div>

        <div className="filtros-section" style={{ flexWrap: 'wrap' }}>
          <div className="filtro-group filtro-sm">
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="filtro-group filtro-sm">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <button className="btn-refresh" onClick={() => setRango(inicioSemanaISO())}>Esta semana</button>
          <button className="btn-refresh" onClick={() => setRango(inicioMesISO())}>Este mes</button>
          <button className="btn-refresh" onClick={() => setRango(inicioAnioISO())}>Este año</button>
          <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'flex-end', paddingBottom: 4 }}>
            <button className="btn-refresh" onClick={() => cargar()} disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#c00', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="table-container">
          <table className="sys-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Cuenta</th>
                <th style={{ textAlign: 'right' }}>Compras (inventario)</th>
                <th style={{ textAlign: 'right' }}>Egresos</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  Sin movimientos en el rango seleccionado.
                </td></tr>
              )}
              {cuentas.map(c => {
                const cats = Object.entries(c.egresos_por_categoria || {});
                const abierto = expandido.has(c.cuenta);
                const expandible = cats.length > 0;
                return (
                  <React.Fragment key={c.cuenta}>
                    <tr className={(expandible ? 'row-clickable' : '') + (abierto ? ' row-open' : '')}
                      onClick={() => expandible && toggle(c.cuenta)}>
                      <td>{expandible ? (abierto ? '▼' : '▶') : ''}</td>
                      <td><strong>{c.cuenta}</strong></td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(c.compras)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(c.egresos_total)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(c.total)}</td>
                    </tr>
                    {abierto && (
                      <tr className="row-detail">
                        <td colSpan={5}>
                          <div className="venta-detalle">
                            <table className="sys-table sys-table--nested">
                              <thead>
                                <tr>
                                  <th>Categoría de egreso</th>
                                  <th style={{ textAlign: 'right' }}>Total $</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cats.map(([cat, monto]) => (
                                  <tr key={cat}>
                                    <td>{cat}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtMoney(monto)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {cuentas.length > 0 && (
            <div className="venta-detalle-totales">
              <span className="vdt-items">
                Compras: {fmtMoney(tot.compras)} · Egresos: {fmtMoney(tot.egresos)}
              </span>
              <div className="vdt-grp vdt-total">
                <span className="vdt-lbl">Gasto total:</span>
                <span className="vdt-val">{fmtMoney(tot.total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default ReporteGastos;
