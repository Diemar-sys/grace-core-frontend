// src/components/HistorialMovimientos.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fmtUom } from '../utils/uom';
import { stockService } from '../services/frappeStock';
import '../styles/Compras.css'; // look carbón: thead, inputs, card (scoped .comprasv2)

function hoyISO() { return new Date().toISOString().split('T')[0]; }
function hace7ISO() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

const TIPO_LABEL = {
  'Material Receipt':  { txt: 'Entrada',       color: '#0284c7', bg: '#e0f2fe' },
  'Material Transfer': { txt: 'Transferencia', color: '#d97706', bg: '#fef3c7' },
  'Material Issue':    { txt: 'Merma/Salida',  color: '#dc2626', bg: '#fee2e2' },
  'Manufacture':       { txt: 'Producción',    color: '#16a34a', bg: '#dcfce7' },
};

function fmtQty(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 });
}

/**
 * Vista de historial de movimientos por almacén (Stock Entry submitted).
 * Filtros: almacén + rango de fechas. Tabla expandible por movimiento.
 */
function HistorialMovimientos({ almacenes }) {
  const [warehouse, setWarehouse] = useState(stockService.getBodegaCentral());
  const [desde, setDesde] = useState(hace7ISO);
  const [hasta, setHasta] = useState(hoyISO);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(new Set());
  const [filtroTipo, setFiltroTipo] = useState(''); // '' | tipo

  const cargar = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const r = await stockService.getHistorialMovimientos({ warehouse, desde, hasta }, signal);
      setData(r);
      setExpandido(new Set());
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [warehouse, desde, hasta]);

  useEffect(() => {
    const c = new AbortController();
    cargar(c.signal);
    return () => c.abort();
  }, [cargar]);

  const toggle = (name) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Dedup almacenes por name (fetchAllWarehousesInclusive puede traer duplicados)
  const almacenesUnicos = useMemo(() => {
    const seen = new Set();
    return almacenes.filter(a => { if (seen.has(a.name)) return false; seen.add(a.name); return true; });
  }, [almacenes]);

  const labelAlmacen = (name) => almacenesUnicos.find(a => a.name === name)?.label || name || '—';

  const filtrados = useMemo(
    () => filtroTipo ? data.filter(d => d.tipo === filtroTipo) : data,
    [data, filtroTipo],
  );

  const totales = useMemo(() => {
    const porTipo = {};
    filtrados.forEach(m => {
      porTipo[m.tipo] = (porTipo[m.tipo] || 0) + 1;
    });
    return { count: filtrados.length, porTipo };
  }, [filtrados]);

  return (
    <div className="comprasv2" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="filtros-section" style={{ flexWrap: 'wrap' }}>
        <div className="filtro-group filtro-sm">
          <label>Almacén</label>
          <select className="comp-date-input" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
            {almacenesUnicos.map(a => <option key={a.name} value={a.name}>{a.label}</option>)}
          </select>
        </div>
        <div className="filtro-group filtro-sm">
          <label>Desde</label>
          <input type="date" className="comp-date-input" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="filtro-group filtro-sm">
          <label>Hasta</label>
          <input type="date" className="comp-date-input" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <div className="filtro-group filtro-sm">
          <label>Tipo</label>
          <select className="comp-date-input" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v.txt}</option>
            ))}
          </select>
        </div>
        <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'flex-end', paddingBottom: 4 }}>
          <button className="btn-refresh btn-compacto" onClick={() => cargar()} disabled={loading}>
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
              <th>Fecha</th>
              <th>#</th>
              <th>Tipo</th>
              <th>Rol</th>
              <th>Origen → Destino</th>
              <th>Notas</th>
              <th style={{ textAlign: 'right' }}>Items</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && !loading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                Sin movimientos en el rango seleccionado.
              </td></tr>
            )}
            {filtrados.map(m => {
              const abierto = expandido.has(m.name);
              const tag = TIPO_LABEL[m.tipo] || { txt: m.tipo, color: '#555', bg: '#eee' };
              return (
                <React.Fragment key={m.name}>
                  <tr className={'row-clickable' + (abierto ? ' row-open' : '')} onClick={() => toggle(m.name)}>
                    <td>{abierto ? '▼' : '▶'}</td>
                    <td>{m.fecha}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.name}</td>
                    <td>
                      <span style={{ background: tag.bg, color: tag.color, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        {tag.txt}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#666' }}>
                      {m.rol === 'origen' ? '↗ Salió' : m.rol === 'destino' ? '↘ Entró' : '↔ Interno'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {labelAlmacen(m.origen)} → {labelAlmacen(m.destino)}
                    </td>
                    <td style={{ fontSize: 12, color: '#666', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.remarks}
                    </td>
                    <td style={{ textAlign: 'right' }}>{m.items.length}</td>
                  </tr>
                  {abierto && (
                    <tr className="row-detail">
                      <td colSpan={8}>
                        <div className="venta-detalle">
                          <table className="sys-table sys-table--nested">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Item</th>
                                <th>Origen</th>
                                <th>Destino</th>
                                <th style={{ textAlign: 'right' }}>Cantidad</th>
                                <th>UoM</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.items.map((it, idx) => (
                                <tr key={`${it.item_code}-${idx}`}>
                                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{it.item_code}</td>
                                  <td>{it.item_name}</td>
                                  <td style={{ fontSize: 12, color: '#666' }}>{labelAlmacen(it.s_warehouse)}</td>
                                  <td style={{ fontSize: 12, color: '#666' }}>{labelAlmacen(it.t_warehouse)}</td>
                                  <td style={{ textAlign: 'right' }}>{fmtQty(it.qty)}</td>
                                  <td>{fmtUom(it.uom)}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    {it.amount > 0
                                      ? it.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
                                      : '—'}
                                  </td>
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

        {/* Barra de totales sticky — pegada al fondo del scroll */}
        <div className="venta-detalle-totales">
          <span className="vdt-items">
            {loading ? 'Cargando...' : `${totales.count} movimiento${totales.count !== 1 ? 's' : ''}`}
          </span>
          {Object.entries(totales.porTipo).map(([tipo, n]) => {
            const tag = TIPO_LABEL[tipo] || { txt: tipo, color: '#555', bg: '#eee' };
            return (
              <span key={tipo} className="vdt-grp">
                <span className="vdt-lbl" style={{ color: tag.color }}>{tag.txt}</span>
                <span className="vdt-val" style={{ fontSize: 15, color: tag.color }}>{n}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HistorialMovimientos;
