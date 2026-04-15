// src/pages/POS.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { posService } from '../services/frappePOS';
import '../styles/global.css';
import '../styles/POS.css';

// ── Colores por departamento ───────────────────────────
const DEPT_COLORS = {
  'PAN BLANCO':  '#f59e0b',
  'PAN DULCE':   '#f97316',
  'PANQUELERIA': '#ec4899',
  'REPOSTERIA':  '#8b5cf6',
  'PIZZERIA':    '#ef4444',
};
const deptColor = (dept = '') => {
  const key = Object.keys(DEPT_COLORS).find(k => dept.toUpperCase().includes(k));
  return DEPT_COLORS[key] || '#7a3f0a';
};

// Formato de moneda
const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

// Hora actual legible (se re-calcula al hacer cobro)
const horaActual = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const fechaActual = () =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Módulo de Punto de Venta (POS).
 * Flujo basado en SICAR:
 *   1. Buscar y agregar productos al ticket.
 *   2. Ajustar cantidades con +/- o input directo.
 *   3. Seleccionar cliente (default: Público en General).
 *   4. Cobrar → elegir forma de pago → confirmar.
 * Historial del día accesible con el botón "Historial".
 *
 * @returns {JSX.Element}
 */
function POS() {
  // ── Estado — catálogo ─────────────────────────────
  // Todos los productos cargados UNA sola vez al montar (caché local)
  const [todosProductos,  setTodosProductos]  = useState([]);
  const [departamentos,   setDepartamentos]   = useState([]);
  const [busqueda,        setBusqueda]        = useState('');
  const [departamento,    setDepartamento]    = useState('');
  const [loadingProds,    setLoadingProds]    = useState(false);

  // ── Estado — ticket ───────────────────────────────
  const [ticket,  setTicket]  = useState([]);
  const [cliente, setCliente] = useState('Público en General');

  // ── Estado — cobro ────────────────────────────────
  const [modalCobrar,     setModalCobrar]     = useState(false);
  const [formaPago,       setFormaPago]       = useState('Efectivo');
  const [importeRecibido, setImporteRecibido] = useState('');
  const [loadingCobro,    setLoadingCobro]    = useState(false);
  const [errorCobro,      setErrorCobro]      = useState('');

  // ── Estado — historial ────────────────────────────
  const [vista,           setVista]           = useState('venta'); // 'venta' | 'historial'
  const [ventasHoy,       setVentasHoy]       = useState([]);
  const [loadingHist,     setLoadingHist]     = useState(false);
  const [fechaHistorial,  setFechaHistorial]  = useState(
    () => new Date().toISOString().split('T')[0]
  );

  // ── Estado — corte de caja ────────────────────────
  const [modalCorte,      setModalCorte]      = useState(false);
  const [datosCorte,      setDatosCorte]      = useState(null);
  const [loadingCorte,    setLoadingCorte]    = useState(false);
  const [errorCorte,      setErrorCorte]      = useState('');

  // ── Estado — rango de fechas para reporte ───────────
  const hoyISO = () => new Date().toISOString().split('T')[0];
  const [rangoInicio,     setRangoInicio]     = useState(hoyISO);
  const [rangoFin,        setRangoFin]        = useState(hoyISO);
  const [datosReporte,    setDatosReporte]    = useState(null);
  const [loadingReporte,  setLoadingReporte]  = useState(false);

  // ── Estado — notificación ─────────────────────────
  const [toast,     setToast]     = useState('');
  const toastTimer               = useRef(null);

  // ─────────────────────────────────────────────────
  // CARGA INICIAL — UNA sola llamada al backend
  // El filtrado se hace en el cliente con useMemo
  // ─────────────────────────────────────────────────
  const cargarProductos = useCallback(async () => {
    setLoadingProds(true);
    try {
      const data = await posService.buscarProductos();
      setTodosProductos(data);
      // Extraer departamentos únicos del mismo listado (sin llamada extra)
      const depts = new Set();
      data.forEach(p => {
        if (p.custom_departamento) {
          p.custom_departamento.split(',').forEach(d => {
            const t = d.trim();
            if (t) depts.add(t);
          });
        }
      });
      setDepartamentos(Array.from(depts).sort());
    } catch (e) {
      console.error('Error cargando productos:', e);
    } finally {
      setLoadingProds(false);
    }
  }, []);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  // ─────────────────────────────────────────────────
  // FILTRADO 100% EN CLIENTE — sin llamadas al backend
  // ─────────────────────────────────────────────────
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return todosProductos.filter(p => {
      const matchBusq = !q ||
        p.item_name.toLowerCase().includes(q) ||
        (p.item_code || '').toLowerCase().includes(q) ||
        (p.custom_código_interno || '').toLowerCase().includes(q);
      const matchDept = !departamento ||
        (p.custom_departamento || '').toLowerCase().includes(departamento.toLowerCase());
      return matchBusq && matchDept;
    });
  }, [todosProductos, busqueda, departamento]);

  // ─────────────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'historial') return;
    setLoadingHist(true);
    posService.getVentasDelDia(fechaHistorial)
      .then(setVentasHoy)
      .catch(console.error)
      .finally(() => setLoadingHist(false));
  }, [vista, fechaHistorial]);

  // Reporte — se recarga con debounce cuando cambia el rango
  useEffect(() => {
    if (vista !== 'historial') return;
    setLoadingReporte(true);
    setDatosReporte(null);
    const t = setTimeout(() => {
      posService.getReporteVentas(rangoInicio, rangoFin)
        .then(setDatosReporte)
        .catch(console.error)
        .finally(() => setLoadingReporte(false));
    }, 400);
    return () => clearTimeout(t);
  }, [vista, rangoInicio, rangoFin]);

  // Accesos rápidos para el rango
  const setHoy = useCallback(() => {
    const h = new Date().toISOString().split('T')[0];
    setRangoInicio(h); setRangoFin(h);
  }, []);

  const setEstaSemana = useCallback(() => {
    const d = new Date();
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    setRangoInicio(lunes.toISOString().split('T')[0]);
    setRangoFin(d.toISOString().split('T')[0]);
  }, []);

  const setEsteMes = useCallback(() => {
    const d = new Date();
    const primero = new Date(d.getFullYear(), d.getMonth(), 1);
    setRangoInicio(primero.toISOString().split('T')[0]);
    setRangoFin(d.toISOString().split('T')[0]);
  }, []);

  // ─────────────────────────────────────────────────
  // CORTE DE CAJA
  // ─────────────────────────────────────────────────
  const abrirCorte = useCallback(async () => {
    setModalCorte(true);
    setErrorCorte('');
    setDatosCorte(null);
    setLoadingCorte(true);
    try {
      const data = await posService.getCorteCaja(rangoInicio, rangoFin);
      setDatosCorte(data);
    } catch (err) {
      setErrorCorte(err.message || 'Error al generar el corte');
    } finally {
      setLoadingCorte(false);
    }
  }, [rangoInicio, rangoFin]);

  const imprimirCorte = useCallback(() => {
    if (!datosCorte) return;
    const fmtVal = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
    const esRango = rangoInicio !== rangoFin;
    const fmtFecha = (iso) =>
      new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

    const filasPago = datosCorte.por_forma_pago.map(fp => `
      <tr>
        <td>${fp.forma_pago.toUpperCase()}</td>
        <td style="text-align:right">${fmtVal(fp.total)}</td>
      </tr>`).join('') || `<tr><td colspan="2" style="text-align:center;color:#888">Sin movimientos</td></tr>`;

    const filasDept = datosCorte.por_departamento.map(dep => `
      <tr>
        <td>${dep.departamento}</td>
        <td style="text-align:center">${dep.cantidad}</td>
        <td style="text-align:right">${fmtVal(dep.total)}</td>
      </tr>`).join('') || `<tr><td colspan="3" style="text-align:center;color:#888">Sin datos</td></tr>`;

    const periodoStr = esRango
      ? `${fmtFecha(rangoInicio)} al ${fmtFecha(rangoFin)}`
      : fmtFecha(rangoInicio);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Corte de Caja — ${periodoStr}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111;
           max-width: 380px; margin: 0 auto; padding: 24px 16px; }
    .center { text-align: center; }
    .empresa { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
    .subtitulo { font-size: 11px; color: #555; margin-top: 2px; }
    .div-eq { border-top: 2px solid #111; margin: 10px 0; }
    .div-dash { border-top: 1px dashed #aaa; margin: 8px 0; }
    .section-title { text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 1px; }
    .info-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #333;
         padding: 3px 4px; text-align: left; }
    td { padding: 3px 4px; font-size: 11px; border-bottom: 1px dashed #e5e5e5; }
    .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid #111;
                 padding-top: 6px; margin-top: 4px; display: flex;
                 justify-content: space-between; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #888; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="empresa">PANADERÍAS GRACE</div>
    <div class="subtitulo">Panadería &amp; Repostería</div>
  </div>
  <div class="div-eq"></div>
  <div class="info-row"><span>PERÍODO:</span><span>${periodoStr}</span></div>
  <div class="info-row"><span>HORA CORTE:</span><span>${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="info-row"><span>No. VENTAS:</span><span>${datosCorte.num_transacciones}</span></div>
  <div class="div-eq"></div>
  <div class="section-title">** CORTE DE CAJA **</div>
  <div class="div-eq"></div>

  <div class="section-title" style="font-size:11px;margin-bottom:4px">FORMA DE PAGO</div>
  <div class="div-dash"></div>
  <table>
    <thead><tr><th>Método</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${filasPago}</tbody>
  </table>

  <div class="div-dash" style="margin-top:10px"></div>
  <div class="section-title" style="font-size:11px;margin-bottom:4px">VENTAS POR CATEGORÍA</div>
  <div class="div-dash"></div>
  <table>
    <thead><tr><th>Categoría</th><th style="text-align:center">Pzas</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${filasDept}</tbody>
  </table>

  <div class="div-eq" style="margin-top:10px"></div>
  <div class="total-row">
    <span>TOTAL DEL DÍA:</span>
    <span>${fmtVal(datosCorte.total_ventas)}</span>
  </div>
  <div class="div-eq"></div>
  <div class="footer">
    Corte generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=500,height=700');
    win.document.write(html);
    win.document.close();
  }, [datosCorte, rangoInicio, rangoFin]);

  // ─────────────────────────────────────────────────
  // HELPERS — TICKET
  // ─────────────────────────────────────────────────
  const agregarProducto = useCallback((prod) => {
    setTicket(prev => {
      const existing = prev.find(i => i.item_code === prod.item_code);
      if (existing) {
        return prev.map(i =>
          i.item_code === prod.item_code ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, {
        item_code: prod.item_code,
        item_name: prod.item_name,
        qty:       1,
        precio:    parseFloat(prod.custom_precio_de_venta) || 0,
        stock_uom: prod.stock_uom || 'PZA',
      }];
    });
  }, []);

  const cambiarCantidad = useCallback((itemCode, delta) => {
    setTicket(prev =>
      prev
        .map(i => i.item_code === itemCode ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter(i => i.qty > 0)
    );
  }, []);

  const setCantidadDirecta = useCallback((itemCode, val) => {
    const qty = Math.max(0, parseInt(val, 10) || 0);
    if (qty === 0) {
      setTicket(prev => prev.filter(i => i.item_code !== itemCode));
    } else {
      setTicket(prev => prev.map(i => i.item_code === itemCode ? { ...i, qty } : i));
    }
  }, []);

  const quitarItem = useCallback((itemCode) => {
    setTicket(prev => prev.filter(i => i.item_code !== itemCode));
  }, []);

  const limpiarTicket = useCallback(() => {
    setTicket([]);
    setCliente('Público en General');
  }, []);

  // ── Totales ───────────────────────────────────────
  const total  = ticket.reduce((s, i) => s + i.qty * i.precio, 0);
  const cambio = formaPago === 'Efectivo'
    ? Math.max(0, parseFloat(importeRecibido || 0) - total)
    : 0;
  const importeOk = formaPago !== 'Efectivo'
    || parseFloat(importeRecibido || 0) >= total;

  // ─────────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };

  // ─────────────────────────────────────────────────
  // CONFIRMAR VENTA
  // ─────────────────────────────────────────────────
  const confirmarVenta = async () => {
    if (!ticket.length || !importeOk) return;
    setLoadingCobro(true);
    setErrorCobro('');
    try {
      await posService.crearVenta({ items: ticket, customer: cliente, formaPago });
      const cambioFmt = formaPago === 'Efectivo' ? ` | Cambio: ${fmt(cambio)}` : '';
      showToast(`✅ Venta registrada — Total: ${fmt(total)}${cambioFmt}`);
      limpiarTicket();
      setModalCobrar(false);
      setImporteRecibido('');
      setFormaPago('Efectivo');
    } catch (err) {
      setErrorCobro(err.message || 'Error al registrar la venta');
    } finally {
      setLoadingCobro(false);
    }
  };

  // ─────────────────────────────────────────────────
  // CANCELAR VENTA (historial)
  // ─────────────────────────────────────────────────
  const cancelarVenta = async (name) => {
    if (!window.confirm(`¿Cancelar la venta ${name}?`)) return;
    try {
      await posService.cancelarVenta(name);
      setVentasHoy(prev => prev.filter(v => v.name !== name));
      showToast(`🚫 Venta ${name} cancelada`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  };

  // ── Totales historial ─────────────────────────────
  const totalVentasHoy   = ventasHoy.reduce((s, v) => s + parseFloat(v.grand_total || 0), 0);
  const ventasActivas    = ventasHoy.filter(v => v.docstatus === 1);

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <Layout>

      {/* ── Vista Historial ──────────────────────── */}
      {vista === 'historial' ? (
        <div className="pos-historial-view">

          {/* Header */}
          <div className="pos-historial-header">
            <div>
              <h2>📋 Historial de Ventas</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                {fechaActual()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="pos-historial-btn activo"
                onClick={() => setVista('venta')}
              >
                ← Volver al POS
              </button>
            </div>
          </div>

          {/* Selector de rango de fechas */}
          <div className="pos-rango-row">
            {/* Inputs de fecha */}
            <div className="pos-rango-inputs">
              <label className="pos-rango-label">Desde</label>
              <input
                type="date"
                className="pos-rango-date"
                value={rangoInicio}
                max={rangoFin}
                onChange={e => setRangoInicio(e.target.value)}
              />
              <span className="pos-rango-sep">→</span>
              <label className="pos-rango-label">Hasta</label>
              <input
                type="date"
                className="pos-rango-date"
                value={rangoFin}
                min={rangoInicio}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setRangoFin(e.target.value)}
              />
            </div>
            {/* Accesos rápidos */}
            <div className="pos-rango-shortcuts">
              <button className="pos-periodo-tab" onClick={setHoy}>Hoy</button>
              <button className="pos-periodo-tab" onClick={setEstaSemana}>Esta semana</button>
              <button className="pos-periodo-tab" onClick={setEsteMes}>Este mes</button>
            </div>
            {/* Corte de caja */}
            <button
              className="pos-historial-btn"
              id="btn-corte-caja"
              onClick={abrirCorte}
              title="Generar corte de caja del período seleccionado"
            >
              💰 Corte de Caja
            </button>
          </div>

          {/* Resumen del período */}
          {loadingReporte ? (
            <div className="pos-historial-stats">
              <div className="pos-historial-stat"><div className="stat-n">…</div><div className="stat-l">Cargando reporte</div></div>
            </div>
          ) : datosReporte ? (
            <div className="pos-reporte-resumen">
              {/* Cards de totales */}
              <div className="pos-historial-stats" style={{ flexShrink: 0 }}>
                <div className="pos-historial-stat">
                  <div className="stat-n">{datosReporte.num_transacciones}</div>
                  <div className="stat-l">Ventas</div>
                </div>
                <div className="pos-historial-stat">
                  <div className="stat-n">{fmt(datosReporte.total_ventas)}</div>
                  <div className="stat-l">Total</div>
                </div>
                {datosReporte.por_forma_pago.map(fp => (
                  <div key={fp.forma_pago} className="pos-historial-stat">
                    <div className="stat-n" style={{ fontSize: 20 }}>{fmt(fp.total)}</div>
                    <div className="stat-l">
                      {fp.forma_pago === 'Efectivo' ? '💵' : fp.forma_pago === 'Tarjeta' ? '💳' : '🏦'} {fp.forma_pago}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desglose por departamento */}
              {datosReporte.por_departamento.length > 0 && (
                <div className="pos-dept-reporte">
                  {datosReporte.por_departamento.map(dep => {
                    const pct = datosReporte.total_ventas > 0
                      ? (dep.total / datosReporte.total_ventas * 100).toFixed(1)
                      : 0;
                    const color = deptColor(dep.departamento);
                    return (
                      <div key={dep.departamento} className="pos-dept-reporte-row">
                        <div className="pos-dept-reporte-label">
                          <span style={{ color, fontWeight: 700 }}>{dep.departamento}</span>
                          <span className="pos-dept-pct">{pct}%</span>
                        </div>
                        <div className="pos-dept-bar-wrap">
                          <div
                            className="pos-dept-bar-fill"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                        <span className="pos-dept-total">{fmt(dep.total)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Tabla de transacciones */}
          <div className="table-container">
            {loadingHist ? (
              <p className="loading">Cargando historial...</p>
            ) : ventasHoy.length === 0 ? (
              <p className="no-data">No hay ventas registradas para esta fecha.</p>
            ) : (
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th className="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasHoy.map(v => {
                    const hora = new Date(v.creation).toLocaleTimeString('es-MX', {
                      hour: '2-digit', minute: '2-digit'
                    });
                    const cancelada = v.docstatus === 2;
                    return (
                      <tr key={v.name} style={cancelada ? { opacity: 0.5 } : {}}>
                        <td className="cell-code">{v.name}</td>
                        <td>{hora}</td>
                        <td>{v.customer}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-brand)' }}>
                          {fmt(v.grand_total)}
                        </td>
                        <td>
                          <span className={`status-badge ${cancelada ? 'status-out' : 'status-ok'}`}>
                            {cancelada ? 'Cancelada' : 'Activa'}
                          </span>
                        </td>
                        <td className="col-actions">
                          {!cancelada && (
                            <button
                              className="btn-delete-row"
                              title="Cancelar venta"
                              onClick={() => cancelarVenta(v.name)}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      ) : (
        /* ── Vista Punto de Venta ────────────────── */
        <div className="pos-view">

          {/* ═══ PANEL IZQUIERDO — CATÁLOGO ═══════ */}
          <div className="pos-left">

            {/* Barra de búsqueda + filtros */}
            <div className="pos-toolbar">
              <input
                id="pos-busqueda"
                type="search"
                className="pos-search-input"
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoFocus
              />
              <select
                className="pos-dept-select"
                value={departamento}
                onChange={e => setDepartamento(e.target.value)}
              >
                <option value="">Todos los depts.</option>
                {departamentos.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button
                className="pos-historial-btn"
                onClick={cargarProductos}
                title="Recargar catálogo de productos"
                disabled={loadingProds}
              >
                🔄
              </button>
              <button
                className={`pos-historial-btn${vista === 'historial' ? ' activo' : ''}`}
                onClick={() => setVista('historial')}
                title="Ver historial de ventas del día"
              >
                📋 Historial
              </button>
            </div>

            {/* Cuadrícula de productos */}
            <div className="pos-products-grid">
              {loadingProds ? (
                <div className="pos-empty-products">
                  <span>⏳</span>
                  <p>Cargando productos...</p>
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="pos-empty-products">
                  <span>🔍</span>
                  <p>{todosProductos.length === 0 ? 'No hay productos terminados registrados.' : 'Sin resultados para tu búsqueda.'}</p>
                </div>
              ) : (
                productosFiltrados.map(prod => {
                  const color = deptColor(prod.custom_departamento || '');
                  const precio = parseFloat(prod.custom_precio_de_venta) || 0;
                  return (
                    <div
                      key={prod.item_code}
                      id={`prod-${prod.item_code}`}
                      className="pos-product-card"
                      onClick={() => agregarProducto(prod)}
                      style={{ borderTop: `3px solid ${color}` }}
                      title={`Agregar ${prod.item_name} al ticket`}
                    >
                      <span className="pos-card-dept" style={{ color }}>
                        {prod.custom_departamento || '—'}
                      </span>
                      <span className="pos-card-name">{prod.item_name}</span>
                      <span className="pos-card-price">{fmt(precio)}</span>
                      <span className="pos-card-uom">por {prod.stock_uom || 'PZA'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ PANEL DERECHO — TICKET ════════════ */}
          <div className="pos-right">

            {/* Encabezado */}
            <div className="pos-ticket-header">
              <p className="pos-ticket-title">🧾 Ticket de Venta</p>
              <p className="pos-ticket-date">{fechaActual()}</p>
            </div>

            {/* Lista de artículos */}
            <div className="pos-ticket-items">
              {ticket.length === 0 ? (
                <div className="pos-ticket-empty">
                  <span>🛒</span>
                  <p>Agrega productos haciendo clic en la cuadrícula</p>
                </div>
              ) : (
                ticket.map(item => (
                  <div key={item.item_code} className="pos-ticket-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pos-ticket-item-name">{item.item_name}</div>
                      <div className="pos-ticket-item-price">{fmt(item.precio)} c/u</div>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="pos-qty-controls">
                      <button
                        className="pos-qty-btn"
                        onClick={() => cambiarCantidad(item.item_code, -1)}
                        aria-label="Reducir cantidad"
                      >−</button>
                      <input
                        className="pos-qty-input"
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={e => setCantidadDirecta(item.item_code, e.target.value)}
                        id={`qty-${item.item_code}`}
                      />
                      <button
                        className="pos-qty-btn"
                        onClick={() => cambiarCantidad(item.item_code, +1)}
                        aria-label="Aumentar cantidad"
                      >+</button>
                    </div>

                    {/* Subtotal */}
                    <div className="pos-ticket-item-subtotal">
                      {fmt(item.qty * item.precio)}
                    </div>

                    {/* Quitar */}
                    <button
                      className="pos-remove-btn"
                      onClick={() => quitarItem(item.item_code)}
                      aria-label={`Quitar ${item.item_name}`}
                      title="Quitar del ticket"
                    >✕</button>
                  </div>
                ))
              )}
            </div>

            {/* Footer: cliente + total + cobrar */}
            <div className="pos-ticket-footer">
              {/* Cliente */}
              <div className="pos-cliente-row">
                <span className="pos-cliente-label">Cliente</span>
                <input
                  id="pos-cliente"
                  className="pos-cliente-input"
                  type="text"
                  value={cliente}
                  onChange={e => setCliente(e.target.value)}
                  placeholder="Público en General"
                />
              </div>

              {/* Artículos + Total */}
              <div className="pos-total-row">
                <span className="pos-total-label">
                  {ticket.reduce((s, i) => s + i.qty, 0)} artículo(s)
                </span>
                <span className="pos-total-amount">{fmt(total)}</span>
              </div>

              {/* Botón Cobrar */}
              <button
                id="pos-btn-cobrar"
                className="pos-cobrar-btn"
                disabled={ticket.length === 0}
                onClick={() => {
                  setErrorCobro('');
                  setModalCobrar(true);
                }}
              >
                COBRAR
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ═══ MODAL DE COBRO ════════════════════════ */}
      {modalCobrar && (
        <div
          id="pos-modal-cobrar"
          className="pos-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setModalCobrar(false); }}
        >
          <div className="pos-cobrar-modal">

            {/* Header con total */}
            <div className="pos-modal-header">
              <h3>Cobro de Venta</h3>
              <div className="pos-modal-total">{fmt(total)}</div>
              <div style={{ fontSize: 13, color: '#fde68a', marginTop: 2 }}>
                {horaActual()} · {cliente}
              </div>
            </div>

            <div className="pos-modal-body">

              {/* Forma de pago */}
              <div className="pos-modal-field">
                <span className="pos-modal-label">Forma de Pago</span>
                <div className="pos-pago-tabs">
                  {['Efectivo', 'Tarjeta', 'Transferencia'].map(fp => (
                    <button
                      key={fp}
                      id={`pago-${fp.toLowerCase()}`}
                      className={`pos-pago-tab${formaPago === fp ? ' activo' : ''}`}
                      onClick={() => { setFormaPago(fp); setImporteRecibido(''); }}
                    >
                      {fp === 'Efectivo' ? '💵' : fp === 'Tarjeta' ? '💳' : '🏦'} {fp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Importe recibido (solo Efectivo) */}
              {formaPago === 'Efectivo' && (
                <div className="pos-modal-field">
                  <span className="pos-modal-label">Importe Recibido</span>
                  <input
                    id="pos-importe-recibido"
                    className="pos-importe-input"
                    type="number"
                    min={total}
                    step="0.50"
                    placeholder={fmt(total)}
                    value={importeRecibido}
                    onChange={e => setImporteRecibido(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              {/* Cambio */}
              {formaPago === 'Efectivo' && parseFloat(importeRecibido || 0) > 0 && (
                <div className="pos-cambio-box">
                  <span className="pos-cambio-label">💰 Cambio a entregar</span>
                  <span className="pos-cambio-value">{fmt(cambio)}</span>
                </div>
              )}

              {/* Error */}
              {errorCobro && (
                <div className="pos-modal-error">⚠️ {errorCobro}</div>
              )}

            </div>

            {/* Acciones */}
            <div className="pos-modal-footer">
              <button
                id="pos-modal-cancelar"
                className="pos-modal-cancel"
                onClick={() => setModalCobrar(false)}
                disabled={loadingCobro}
              >
                Cancelar
              </button>
              <button
                id="pos-modal-confirmar"
                className="pos-modal-confirm"
                onClick={confirmarVenta}
                disabled={loadingCobro || !importeOk || ticket.length === 0}
              >
                {loadingCobro ? 'Registrando...' : '✔ Confirmar Venta'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ═══ MODAL CORTE DE CAJA — formato ticket ══════ */}
      {modalCorte && (
        <div
          className="pos-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setModalCorte(false); }}
        >
          <div className="pos-ticket-receipt-wrap">

            {/* Botones FUERA del ticket (no se imprimen) */}
            <div className="pos-ticket-actions no-print">
              <button className="pos-modal-cancel" onClick={() => setModalCorte(false)}>
                Cerrar
              </button>
              {datosCorte && (
                <button
                  className="pos-modal-confirm"
                  style={{ background: 'var(--color-brand)' }}
                  onClick={imprimirCorte}
                >
                  🖨️ Imprimir Corte
                </button>
              )}
            </div>

            {/* ── EL TICKET ──────────────────────────── */}
            <div className="pos-ticket-receipt" id="ticket-corte-imprimible">

              {/* Cabecera */}
              <div className="tkt-center tkt-logo">
                <strong>GRACE</strong><br />
                <span>Panadería &amp; Repostería</span>
              </div>

              <div className="tkt-center tkt-store">
                PANADERÍAS GRACE<br />
                AV. SANTUARIOS DEL MILAGRO<br />
                TEL. 4425991147
              </div>

              <div className="tkt-divider-dash" />

              {/* Info del corte */}
              {loadingCorte ? (
                <div className="tkt-center" style={{ padding: '20px 0' }}>Generando corte...</div>
              ) : errorCorte ? (
                <div className="tkt-center" style={{ padding: 16, color: '#b91c1c' }}>
                  ⚠️ {errorCorte}<br />
                  <small>Ejecuta <code>bench restart</code> en el backend.</small>
                </div>
              ) : datosCorte ? (
                <>
                  {rangoInicio === rangoFin ? (
                    <div className="tkt-row">
                      <span>FECHA:</span>
                      <span>{new Date(rangoInicio + 'T12:00:00').toLocaleDateString('es-MX')}</span>
                    </div>
                  ) : (
                    <div className="tkt-row">
                      <span>PERÍODO:</span>
                      <span>
                        {new Date(rangoInicio + 'T12:00:00').toLocaleDateString('es-MX')}
                        {' al '}
                        {new Date(rangoFin + 'T12:00:00').toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  )}
                  <div className="tkt-row">
                    <span>HORA CORTE:</span>
                    <span>{new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="tkt-row">
                    <span>No. VENTAS:</span>
                    <span>{datosCorte.num_transacciones}</span>
                  </div>

                  <div className="tkt-divider-eq" />
                  <div className="tkt-center tkt-section-title">** CORTE DE CAJA **</div>
                  <div className="tkt-divider-eq" />

                  {/* Forma de pago */}
                  <div className="tkt-subtitle">FORMA DE PAGO</div>
                  <div className="tkt-divider-dash" />
                  {datosCorte.por_forma_pago.length === 0 ? (
                    <div className="tkt-center tkt-muted">Sin movimientos</div>
                  ) : (
                    datosCorte.por_forma_pago.map(fp => (
                      <div key={fp.forma_pago} className="tkt-row">
                        <span>{fp.forma_pago.toUpperCase()}:</span>
                        <span>{fmt(fp.total)}</span>
                      </div>
                    ))
                  )}

                  <div className="tkt-divider-dash" />

                  {/* Desglose por categoría */}
                  <div className="tkt-subtitle">VENTAS POR CATEGORÍA</div>
                  <div className="tkt-divider-dash" />
                  {datosCorte.por_departamento.length === 0 ? (
                    <div className="tkt-center tkt-muted">Sin datos</div>
                  ) : (
                    datosCorte.por_departamento.map(dep => (
                      <div key={dep.departamento} className="tkt-row">
                        <span>{dep.departamento}:</span>
                        <span>{fmt(dep.total)}</span>
                      </div>
                    ))
                  )}

                  <div className="tkt-divider-eq" />

                  {/* Total */}
                  <div className="tkt-row tkt-total">
                    <span>TOTAL DEL DÍA:</span>
                    <span>{fmt(datosCorte.total_ventas)}</span>
                  </div>

                  <div className="tkt-divider-eq" />

                  <div className="tkt-center tkt-thanks">
                    GRACIAS POR SU COMPRA
                  </div>
                  <div className="tkt-center tkt-muted" style={{ marginTop: 4 }}>
                    www.panaderiasgrace.mx
                  </div>
                </>
              ) : null}

            </div>{/* /pos-ticket-receipt */}
          </div>
        </div>
      )}

      {/* ═══ TOAST ══════════════════════════════════ */}
      {toast && <div className="pos-toast">{toast}</div>}

    </Layout>
  );
}

export default POS;