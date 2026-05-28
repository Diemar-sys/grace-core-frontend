import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ventasService } from '../services/frappeSales';
import { fmtUom } from '../utils/uom';
import '../styles/global.css';

function hoyISO() { return new Date().toISOString().split('T')[0]; }

function primerDiaMesISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function fmtMoney(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  });
}

function fmtQty(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', {
    maximumFractionDigits: 3,
  });
}

function ReportesVentasCategoria() {
  const navigate = useNavigate();
  const [desde, setDesde] = useState(primerDiaMesISO);
  const [hasta, setHasta] = useState(hoyISO);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(new Set());

  const cargar = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const result = await ventasService.getVentasB2BPorCategoria({ desde, hasta }, signal);
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

  const toggleGrupo = (grp) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(grp)) next.delete(grp); else next.add(grp);
      return next;
    });
  };

  const setHoy = () => { const h = hoyISO(); setDesde(h); setHasta(h); };
  const setMes = () => { setDesde(primerDiaMesISO()); setHasta(hoyISO()); };

  const totales = useMemo(() => data.reduce(
    (acc, g) => ({
      qty: acc.qty + g.qtyTotal,
      monto: acc.monto + g.montoTotal,
      categorias: acc.categorias + 1,
    }),
    { qty: 0, monto: 0, categorias: 0 },
  ), [data]);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div>
              <h1 style={{ margin: 0 }}>Ventas por Categoría</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Ventas B2B agrupadas por categoría de producto
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data.length > 0 && (
              <span style={{ fontSize: 14, color: '#6b7280', marginRight: 8 }}>
                {totales.categorias} categorías · {fmtMoney(totales.monto)} total
              </span>
            )}
            <button className="btn-refresh" onClick={() => navigate('/panel?seccion=reportes')}>
              ← Volver
            </button>
          </div>
        </div>

        <div className="filtros-section" style={{ flexWrap: 'wrap' }}>
          <div className="filtro-group">
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="filtro-group">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <button className="btn-refresh" onClick={setHoy}>Hoy</button>
          <button className="btn-refresh" onClick={setMes}>Este mes</button>
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
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Items distintos</th>
                <th style={{ textAlign: 'right' }}>Cantidad total</th>
                <th style={{ textAlign: 'right' }}>Total $</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  Sin ventas B2B en el rango seleccionado.
                </td></tr>
              )}
              {data.map(g => {
                const abierto = expandido.has(g.item_group);
                return (
                  <React.Fragment key={g.item_group}>
                    <tr className={'row-clickable' + (abierto ? ' row-open' : '')} onClick={() => toggleGrupo(g.item_group)}>
                      <td>{abierto ? '▼' : '▶'}</td>
                      <td><strong>{g.item_group}</strong></td>
                      <td style={{ textAlign: 'right' }}>{g.items.length}</td>
                      <td style={{ textAlign: 'right' }}>{fmtQty(g.qtyTotal)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(g.montoTotal)}</td>
                    </tr>
                    {abierto && (
                      <tr className="row-detail">
                        <td colSpan={5}>
                          <div className="venta-detalle">
                            <table className="sys-table sys-table--nested">
                              <thead>
                                <tr>
                                  <th>Código</th>
                                  <th>Item</th>
                                  <th style={{ textAlign: 'right' }}>Ventas</th>
                                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                                  <th>UoM</th>
                                  <th style={{ textAlign: 'right' }}>Total $</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map(it => (
                                  <tr key={it.item_code}>
                                    <td>{it.item_code}</td>
                                    <td>{it.item_name}</td>
                                    <td style={{ textAlign: 'right' }}>{it.ventas}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtQty(it.qty)}</td>
                                    <td>{fmtUom(it.uom)}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtMoney(it.monto)}</td>
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

          {data.length > 0 && (
            <div className="venta-detalle-totales">
              <span className="vdt-items">
                {totales.categorias} categoría{totales.categorias === 1 ? '' : 's'} · Qty total: {fmtQty(totales.qty)}
              </span>
              <div className="vdt-grp vdt-total">
                <span className="vdt-lbl">Total ventas B2B:</span>
                <span className="vdt-val">{fmtMoney(totales.monto)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default ReportesVentasCategoria;

