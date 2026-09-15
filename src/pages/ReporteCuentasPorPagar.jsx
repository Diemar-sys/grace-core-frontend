import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
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

// Vistas: el backend manda un renglón por (proveedor, facturado_a, tipo).
export const VISTAS = [
  { key: 'general', label: 'General' },
  { key: 'Compra',  label: 'Compras' },
  { key: 'Egreso',  label: 'Egresos' },
];

// Renglones (o documentos del desglose) de la vista elegida. General = todo.
export function deVista(rows, vista) {
  rows = rows || [];
  return vista === 'general' ? rows : rows.filter(r => r.tipo === vista);
}

// Filas por proveedor para la tabla. Siempre agrupa por proveedor: un mismo
// proveedor trae un renglón por tipo (compras y egresos) y por facturado_a.
export function filasCxP(rows, facturadoFiltro) {
  rows = rows || [];
  if (facturadoFiltro !== 'todas') rows = rows.filter(r => r.facturado_a === facturadoFiltro);
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

// Deuda total, partida en lo que viene de compras y lo que viene de egresos.
// Cada parte se suma por su tipo, no por resta: un renglón sin tipo no se cuela.
export function deudaTotal(rows) {
  const d = { total: 0, compras: 0, egresos: 0 };
  for (const r of rows || []) {
    const p = parseFloat(r.pendiente) || 0;
    d.total += p;
    if (r.tipo === 'Compra') d.compras += p;
    else if (r.tipo === 'Egreso') d.egresos += p;
  }
  return d;
}

// Qué se pide al desplegar un renglón: en "Todas" el renglón junta los tres
// facturados, así que su desglose va sin filtro; filtrado, solo el de ese facturado.
// La clave del caché lleva el filtro: el mismo proveedor debe distinto por facturado.
export function consultaPendientes(proveedor, facturado) {
  const facturado_a = facturado === 'todas' ? '' : facturado;
  return { proveedor, facturado_a, clave: `${proveedor}|${facturado_a}` };
}

// El desglose se pide completo (compras y egresos) y se filtra al pintar: cambiar
// de vista no vuelve a pedir. 'cargando' y {error} pasan tal cual.
export function docsDeVista(docs, vista) {
  return Array.isArray(docs) ? deVista(docs, vista) : docs;
}

function ReporteCuentasPorPagar() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soloSaldo, setSoloSaldo] = useState(true);
  const [vista, setVista] = useState('general');
  const [facturado, setFacturado] = useState('todas');
  const [abierto, setAbierto] = useState(null);
  const [pendientes, setPendientes] = useState({});

  const cargar = useCallback(async () => {
    setLoading(true);
    // Actualizar tira también los desgloses: un saldo viejo junto a uno fresco miente.
    setPendientes({});
    setAbierto(null);
    try { setData(await egresosService.getCuentasPorPagar()); }
    catch (err) { console.error('Error reporte CxP:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleProveedor = async (proveedor) => {
    const { facturado_a, clave } = consultaPendientes(proveedor, facturado);
    if (abierto === clave) { setAbierto(null); return; }
    setAbierto(clave);
    if (pendientes[clave]) return;
    setPendientes(prev => ({ ...prev, [clave]: 'cargando' }));
    try {
      const docs = await egresosService.getPendientesProveedor(proveedor, facturado_a);
      setPendientes(prev => ({ ...prev, [clave]: docs }));
    } catch (err) {
      setPendientes(prev => ({ ...prev, [clave]: { error: err.message || 'No se pudo cargar' } }));
    }
  };

  // Strip: sigue a la vista (General/Compras/Egresos), no al dropdown de facturado.
  const datosVista = useMemo(() => deVista(data, vista), [data, vista]);
  const strip = useMemo(() => pendientePorFacturado(datosVista), [datosVista]);
  const deuda = useMemo(() => deudaTotal(datosVista), [datosVista]);

  const filas = useMemo(() => {
    const base = filasCxP(datosVista, facturado);
    return soloSaldo ? base.filter(r => (parseFloat(r.pendiente) || 0) > 0.005) : base;
  }, [datosVista, facturado, soloSaldo]);

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
                Lo que se le debe a cada proveedor: compras + egresos
              </span>
            </div>
          </div>
          <button className="btn-refresh" onClick={() => navigate('/panel?seccion=reportes')}>← Volver</button>
        </div>

        {/* Strip: total + se debe por facturado_a — siempre visible */}
        <div className="cxp-strip" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: '1 1 220px', textAlign: 'left' }}>
            <span className="stat-number comp-stat-total" style={{ color: '#dc2626' }}>${fmt(deuda.total)}</span>
            <span className="stat-label">
              {vista === 'general'
                ? `Total que se debe · compras $${fmt(deuda.compras)} · egresos $${fmt(deuda.egresos)}`
                : `${VISTAS.find(v => v.key === vista).label} · total que se debe`}
            </span>
          </div>
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
            <label htmlFor="cxp-vista">Vista</label>
            <select id="cxp-vista" value={vista} onChange={e => setVista(e.target.value)}>
              {VISTAS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </div>
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
                  <th className="cell-right"># Docs</th>
                  <th className="cell-right">Total</th>
                  <th className="cell-right">Pagado</th>
                  <th className="cell-right">Se debe</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr><td colSpan={5} className="no-data">Sin cuentas por pagar.</td></tr>
                ) : filas.map(r => {
                  const { clave } = consultaPendientes(r.proveedor, facturado);
                  const desplegado = abierto === clave;
                  const debe = (parseFloat(r.pendiente) || 0) > 0.005;
                  return (
                    <Fragment key={r.proveedor}>
                      <tr>
                        <td className="cell-name">
                          {debe ? (
                            <button className="cxc-toggle" onClick={() => toggleProveedor(r.proveedor)}
                              title="Ver lo que se debe">
                              <span className={`cxc-caret${desplegado ? ' abierto' : ''}`}>▸</span>
                              {r.proveedor}
                            </button>
                          ) : r.proveedor}
                        </td>
                        <td className="cell-right">{r.n}</td>
                        <td className="cell-right cell-bold">${fmt(r.total)}</td>
                        <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.pagado)}</td>
                        <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.pendiente)}</td>
                      </tr>
                      {desplegado && (
                        <tr className="cxc-abonos-fila">
                          <td colSpan={5}>
                            <DesglosePendientes proveedor={r.proveedor} docs={docsDeVista(pendientes[clave], vista)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

/** Documentos sin pagar de un proveedor. 'cargando' | {error} | [] | docs. */
function DesglosePendientes({ proveedor, docs }) {
  if (!docs || docs === 'cargando') return <div className="cxc-abonos-vacio">Cargando lo que se debe…</div>;
  if (docs.error) return <div className="cxc-abonos-vacio" style={{ color: '#dc2626' }}>{docs.error}</div>;
  if (!docs.length) return <div className="cxc-abonos-vacio">No hay documentos pendientes.</div>;
  return (
    <div className="cxc-abonos">
      <div className="cxc-abonos-titulo">Lo que se le debe a {proveedor} ({docs.length})</div>
      <table className="cxc-abonos-tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Folio</th>
            <th>Factura</th>
            <th>Concepto</th>
            <th>Facturado a</th>
            <th className="cell-right">Se debe</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.name}>
              <td>{d.fecha}</td>
              <td>{d.tipo}</td>
              <td className="cell-code">{d.folio ? `#${d.folio}` : '—'}</td>
              <td>{d.factura || '—'}</td>
              <td>{d.concepto || '—'}</td>
              <td>{d.facturado_a}</td>
              <td className="cell-right cell-bold" style={{ color: '#dc2626' }}>${fmt(d.monto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>Total que se debe</td>
            <td className="cell-right cell-bold">${fmt(docs.reduce((s, d) => s + (parseFloat(d.monto) || 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default ReporteCuentasPorPagar;
