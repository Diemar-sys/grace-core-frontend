import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { kardexService } from '../services/frappeKardex';
import { inventory } from '../services/frappeInventory';
import '../styles/global.css';

// Cantidades (kg/pza/lt), no moneda.
function qty(n) {
  return (parseFloat(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 });
}

const hoyStr = () => new Date().toISOString().split('T')[0];
const primeroMesStr = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };

function Kardex() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Combobox producto
  const [itemCode, setItemCode] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const blurTimer = useRef(null);

  const [uomInfo, setUomInfo] = useState(null); // { base, pres, factor }
  const [warehouse, setWarehouse] = useState('');
  const [desde, setDesde] = useState(primeroMesStr());
  const [hasta, setHasta] = useState(hoyStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Catálogos: items + almacenes. Default almacén = Bodega Central.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const [its, whs] = await Promise.all([
          kardexService.getItems(ctrl.signal),
          inventory.getWarehouses(),
        ]);
        setItems(its);
        setWarehouses(whs);
        const central = whs.find(w => w.name.includes('BODEGA CENTRAL'));
        setWarehouse(central ? central.name : (whs[0]?.name || ''));
      } catch (err) { if (err.name !== 'AbortError') console.error(err); }
    })();
    return () => ctrl.abort();
  }, []);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? items.filter(it =>
      (it.item_name || '').toLowerCase().includes(q) || (it.name || '').toLowerCase().includes(q)
    ) : items;
    return base.slice(0, 50);
  }, [items, query]);

  const seleccionarItem = useCallback(async (it) => {
    setItemCode(it.name);
    setQuery(it.item_name);
    setOpen(false);
    setUomInfo(null);
    try {
      const d = await inventory.getItemCompleto(it.name);
      const factor = parseFloat(d.custom_cantidad_por_presentación) || 0;
      setUomInfo({ base: d.stock_uom || '', pres: d.custom_presentación || '', factor });
    } catch (err) { console.error(err); }
  }, []);

  const onQueryKey = (e) => {
    if (!open || !filtrados.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtrados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtrados[cursor]) seleccionarItem(filtrados[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const consultar = useCallback(async () => {
    if (!itemCode || !warehouse) { setError('Elige producto y almacén.'); return; }
    setError(''); setLoading(true);
    try {
      setData(await kardexService.getKardex({ itemCode, warehouse, desde, hasta }));
    } catch (err) {
      console.error('Error kardex:', err);
      setError(err?.message || 'No se pudo cargar el kardex.');
      setData(null);
    } finally { setLoading(false); }
  }, [itemCode, warehouse, desde, hasta]);

  const filas = data?.filas || [];
  const tot = data?.totales;

  // Mostrar en presentación (Bulto/Caja) si el item la tiene; si no, en base (Kg/Lt/Pza).
  const enPres = !!(uomInfo?.factor > 0 && uomInfo?.pres);
  const unidad = enPres ? uomInfo.pres : (uomInfo?.base || '');
  const u = unidad ? ` ${unidad}` : '';
  const conv = (v) => enPres ? (parseFloat(v) || 0) / uomInfo.factor : (parseFloat(v) || 0);

  // Ajuste (Stock Reconciliation): entrada/salida 0 pero fija el saldo →
  // spec cliente "ajuste dice 50 → existencia 50": pintar existencia = resultado.
  const existenciaDe = (f) => f.voucher_type === 'Stock Reconciliation' ? f.resultado : f.entrada;

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group">
            <div>
              <h1 style={{ margin: 0 }}>Kardex</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: 4 }}>
                Movimientos de un producto por almacén (entradas, salidas y saldo)
              </span>
            </div>
          </div>
          <button className="btn-refresh" onClick={() => navigate('/panel?seccion=consultas')}>← Volver</button>
        </div>

        <div className="filtros-section" style={{ flexWrap: 'wrap' }}>
          <div className="filtro-group kardex-combo" style={{ minWidth: 280 }}>
            <label>Producto</label>
            <input
              type="text" value={query} placeholder="Escribe para buscar..."
              onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(0); if (itemCode) setItemCode(''); }}
              onFocus={() => setOpen(true)}
              onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
              onKeyDown={onQueryKey}
            />
            {open && filtrados.length > 0 && (
              <div className="kardex-combo-dropdown"
                onMouseDown={() => clearTimeout(blurTimer.current)}>
                {filtrados.map((it, i) => (
                  <div key={it.name}
                    className={'kardex-combo-item' + (i === cursor ? ' active' : '')}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => seleccionarItem(it)}>
                    {it.item_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="filtro-group">
            <label>Almacén</label>
            <select value={warehouse} onChange={e => setWarehouse(e.target.value)}>
              {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
            </select>
          </div>
          <div className="filtro-group">
            <label>Desde</label>
            <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="filtro-group">
            <label>Hasta</label>
            <input type="date" value={hasta} max={hoyStr()} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <button className="btn-refresh btn-compacto" onClick={consultar} disabled={loading}>
              {loading ? 'Cargando...' : 'Consultar'}
            </button>
          </div>
        </div>

        {error && <div className="loading" style={{ color: '#dc2626' }}>{error}</div>}

        {tot && (
          <div className="stats-cards" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <span className="stat-number comp-stat-total" style={{ color: '#16a34a' }}>{qty(conv(tot.comprado))}{u}</span>
              <span className="stat-label">Comprado</span>
            </div>
            <div className="stat-card warning">
              <span className="stat-number comp-stat-total" style={{ color: '#dc2626' }}>{qty(conv(tot.usado))}{u}</span>
              <span className="stat-label">Usado / salió</span>
            </div>
            <div className="stat-card">
              <span className="stat-number comp-stat-total">{qty(conv(tot.saldo_final))}{u}</span>
              <span className="stat-label">Saldo final</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">Cargando kardex...</div>
        ) : data && (
          <div className="table-container">
            <table className="sys-table report-compact kardex-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th className="cell-right">Existencia</th>
                  <th className="cell-right">Salida</th>
                  <th className="cell-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr><td colSpan={5} className="no-data">Sin movimientos en el rango.</td></tr>
                ) : filas.map((f, i) => (
                  <tr key={f.voucher_no + '-' + i}>
                    <td>{f.fecha}</td>
                    <td className="cell-name">{f.movimiento}</td>
                    <td className="cell-right" style={{ color: existenciaDe(f) ? '#16a34a' : undefined }}>
                      {existenciaDe(f) ? qty(conv(existenciaDe(f))) + u : '—'}
                    </td>
                    <td className="cell-right" style={{ color: f.salida ? '#dc2626' : undefined }}>
                      {f.salida ? qty(conv(f.salida)) + u : '—'}
                    </td>
                    <td className="cell-right cell-bold">{qty(conv(f.resultado))}{u}</td>
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

export default Kardex;
