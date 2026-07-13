// src/pages/VentaB2B.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import NuevaVentaB2B from "../components/NuevaVentaB2B";
import ConfirmModal from "../components/modals/ConfirmModal";
import TablaCuentasPorCobrar from "../components/TablaCuentasPorCobrar";
import ModalReciboPDF from "../components/modals/ModalReciboPDF";
import { ventasService } from "../services/frappeSales";
import { IMPUESTOS_MAP } from "../config/impuestos";
import { horaFrappe } from "../utils/hora";
import useConfirmModal from "../hooks/useConfirmModal";
import { fmtUom } from "../utils/uom";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO_DOCSTATUS = { registrada: 1, preventa: 0, cancelada: 2 };

const ICON_TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const ICON_WARNING = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

function VentaB2B() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'nueva' | 'editar'
  const [borradorEditar, setBorradorEditar] = useState(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [estadoFiltro, setEstadoFiltro] = useState('registrada');
  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  // Detalle de venta expandible inline (lazy load de items)
  const [ventaExpandida, setVentaExpandida] = useState({});
  const [ventaItems, setVentaItems] = useState({});
  const [ventaItemsLoading, setVentaItemsLoading] = useState({});

  const toggleVenta = async (name) => {
    const abrir = !ventaExpandida[name];
    setVentaExpandida(prev => ({ ...prev, [name]: abrir }));
    if (!abrir || ventaItems[name]) return;
    setVentaItemsLoading(prev => ({ ...prev, [name]: true }));
    try {
      const items = await ventasService.getFacturaItems(name);
      setVentaItems(prev => ({ ...prev, [name]: items }));
    } catch (err) {
      console.error('Error items venta:', err);
    } finally {
      setVentaItemsLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const [pdfData, setPdfData] = useState(null);
  const libretaRef = useRef(null);

  const cargar = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await ventasService.getVentas({
        desde: desde || null,
        hasta: hasta || null,
      }, signal);
      setVentas(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  const deleteModal = useConfirmModal(
    (name) => ventasService.eliminarBorrador(name),
    { onSuccess: () => cargar() }
  );
  const cancelModal = useConfirmModal(
    (venta) => ventasService.cancelarVenta(venta.name),
    { onSuccess: () => cargar() }
  );

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const handleEditar = async (name) => {
    try {
      const doc = await ventasService.getVentaBorrador(name);
      setBorradorEditar(doc);
      setModal('editar');
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerPDF = async (v) => {
    try {
      const [doc, items] = await Promise.all([
        ventasService.getVentaBorrador(v.name),
        ventasService.getFacturaItems(v.name),
      ]);
      const parseImpuesto = (description = '') => {
        if (description.includes('IEPS')) return IMPUESTOS_MAP['ieps'];
        if (description.includes('IVA')) return IMPUESTOS_MAP['iva16'];
        return IMPUESTOS_MAP['tasa0'];
      };
      const filas = items.map(it => {
        const imp = parseImpuesto(it.description || '');
        return {
          item_code: it.item_code,
          item_name: it.item_name,
          qty: it.qty,
          rate: it.rate,
          uom: it.uom,
          cantidad_por_presentacion: it.cantidad_por_presentacion,
          presentacion: it.presentacion,
          impuesto_key: imp.key,
          impuesto_label: imp.label,
          impuesto_rate: imp.rate,
        };
      });
      let iva = 0, ieps = 0, ajuste = 0;
      (doc.taxes || []).forEach(t => {
        const d = (t.description || '').toUpperCase();
        if (d.includes('AJUSTE')) ajuste += parseFloat(t.tax_amount || 0);
        else if (d.includes('IEPS')) ieps += parseFloat(t.tax_amount || 0);
        else if (d.includes('IVA')) iva += parseFloat(t.tax_amount || 0);
      });
      const subtotalIva16 = parseFloat(doc.custom_subtotal_iva_16 || 0);
      const subtotalIeps = parseFloat(doc.custom_subtotal_ieps || 0);
      const subtotalTasa0 = parseFloat(doc.custom_subtotal_iva_0 || 0);
      const subtotal = parseFloat(doc.total || 0);
      const total = parseFloat(doc.grand_total || 0);
      const fecha = doc.posting_date;
      const hora = horaFrappe(doc.posting_time);
      setPdfData({
        noVenta: doc.custom_no_de_venta,
        fecha, hora,
        cliente: doc.customer_name || doc.customer,
        filas,
        totales: { subtotal, iva, ieps, subtotalIva16, subtotalIeps, subtotalTasa0, total },
        ajuste,
        esBorrador: doc.docstatus === 0,
      });
    } catch (err) {
      console.error('PDF fetch error:', err);
    }
  };

  const handleConfirmarBorrador = async (name) => {
    try {
      await ventasService.confirmarBorrador(name);
      cargar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleModalSuccess = () => {
    setModal(null);
    setBorradorEditar(null);
    cargar();
  };

  const handleModalCancel = () => {
    setModal(null);
    setBorradorEditar(null);
  };

  const filteredVentas = ventas.filter(v => {
    if (estadoFiltro !== 'todas' && v.docstatus !== ESTADO_DOCSTATUS[estadoFiltro]) return false;
    const term = searchTerm.toLowerCase();
    const custName = (v.customer_name || '').toLowerCase();
    const custId = (v.customer || '').toLowerCase();
    const noVenta = String(v.custom_no_de_venta ?? '').toLowerCase();
    return custName.includes(term) || custId.includes(term) || noVenta.includes(term);
  });

  const totalPeriodo = filteredVentas
    .filter(v => v.docstatus === 1)
    .reduce((sum, v) => sum + (v.grand_total || 0), 0);

  return (
    <Layout>
      <div className="page-container">

        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                Venta B2B
              </h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>
                Ventas mayoristas a clientes B2B externos
              </span>
            </div>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{filteredVentas.filter(v => v.docstatus === 1).length}</span>
              <span className="stat-label">Registradas</span>
            </div>
            <div className="stat-card warning">
              <span className="stat-number comp-stat-total">${fmt(totalPeriodo)}</span>
              <span className="stat-label">Total periodo</span>
            </div>
          </div>
        </div>

        {accionActiva === 'menu' ? (
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => setModal('nueva')}>
              <div className="module-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </div>
              <h3>Registrar Venta</h3>
              <p>Capturar venta a cliente B2B</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('editar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Preventa</h3>
              <p>Modificar ventas pendientes</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('confirmar')}>
              <div className="module-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3>Confirmar Preventa</h3>
              <p>Procesar definitivamente</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('eliminar')}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              </div>
              <h3>Eliminar Preventa</h3>
              <p>Descartar ventas erradas</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('cancelar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3>Cancelar Venta</h3>
              <p>Revertir venta confirmada</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('libreta')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#ca8a04' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </div>
              <h3>Registrar Cobro</h3>
              <p>Saldos por cliente y pagos</p>
            </button>
          </div>
        ) : accionActiva === 'libreta' ? (
          <>
            <div className="filtros-section">
              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <button className="btn-refresh"
                  onClick={() => setAccionActiva(soloLectura ? 'consultar' : 'menu')}>
                  ← Volver
                </button>
                <button className="btn-refresh" onClick={() => libretaRef.current?.recargar()}>
                  Actualizar
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ marginLeft: "8px", verticalAlign: "middle" }}>
                    <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
            </div>

            <TablaCuentasPorCobrar ref={libretaRef} readOnly={soloLectura} />
          </>
        ) : (
          <>
            <div className="filtros-section">
              <div className="filtro-group filtro-sm">
                <label>Estado</label>
                <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
                  <option value="registrada">Registrada ({ventas.filter(v => v.docstatus === ESTADO_DOCSTATUS.registrada).length})</option>
                  <option value="preventa">Preventa ({ventas.filter(v => v.docstatus === ESTADO_DOCSTATUS.preventa).length})</option>
                  <option value="cancelada">Cancelada ({ventas.filter(v => v.docstatus === ESTADO_DOCSTATUS.cancelada).length})</option>
                  <option value="todas">Todas ({ventas.length})</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Desde</label>
                <input type="date" className="comp-date-input" value={desde}
                  onChange={e => setDesde(e.target.value)} />
              </div>
              <div className="filtro-group filtro-sm">
                <label>Hasta</label>
                <input type="date" className="comp-date-input" value={hasta}
                  onChange={e => setHasta(e.target.value)} />
              </div>
              <div className="filtro-group search filtro-sm">
                <label>Buscar cliente / #</label>
                <input type="text" placeholder="Ej: ZAKIA, #001"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <button className="btn-refresh btn-compacto" onClick={() => cargar()}>
                  Actualizar
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ marginLeft: "8px", verticalAlign: "middle" }}>
                    <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Cargando ventas...</div>
            ) : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th># Venta</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVentas.length === 0 ? (
                      <tr><td colSpan={6} className="no-data">No hay ventas registradas</td></tr>
                    ) : (
                      filteredVentas.map(v => {
                        const open = !!ventaExpandida[v.name];
                        const items = ventaItems[v.name] || [];
                        const itLoading = !!ventaItemsLoading[v.name];
                        return (
                        <React.Fragment key={v.name}>
                        <tr className={`row-clickable${open ? ' row-open' : ''}`}
                          onClick={() => toggleVenta(v.name)}>
                          <td style={{ color: '#9a6a3a', textAlign: 'center' }}>
                            {open ? '▼' : '▶'}
                          </td>
                          <td className="cell-code">
                            {v.custom_no_de_venta ? `#${v.custom_no_de_venta}` : '—'}
                          </td>
                          <td>{v.posting_date}</td>
                          <td className="comp-td-proveedor">{v.customer_name || v.customer}</td>
                          <td>
                            <span className={`status-badge ${v.docstatus === 0 ? 'status-low' :
                                v.docstatus === 2 ? 'status-cancelled' :
                                  'status-ok'
                              }`}>
                              {v.docstatus === 0 ? 'Preventa' : v.docstatus === 2 ? 'Cancelada' : 'Registrada'}
                            </span>
                          </td>
                          <td className="comp-td-acciones" onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {(v.docstatus === 0 || v.docstatus === 1) && (
                                <button className="comp-btn-editar" onClick={() => handleVerPDF(v)}
                                  title="Ver / Imprimir PDF"
                                  style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #d4af37' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                                </button>
                              )}
                              {!soloLectura && (
                                <>
                                  {v.docstatus === 0 && (
                                    <>
                                      {accionActiva === 'confirmar' && (
                                        <button className="comp-btn-confirmar" onClick={() => handleConfirmarBorrador(v.name)}
                                          title="Confirmar venta">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </button>
                                      )}
                                      {accionActiva === 'editar' && (
                                        <button className="comp-btn-editar" onClick={() => handleEditar(v.name)} title="Editar venta">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
                                        </button>
                                      )}
                                      {accionActiva === 'eliminar' && (
                                        <button className="comp-btn-eliminar" onClick={() => deleteModal.open(v.name)} title="Eliminar preventa">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {v.docstatus === 1 && accionActiva === 'cancelar' && (
                                    <button className="comp-btn-eliminar" onClick={() => cancelModal.open(v)}
                                      title="Cancelar venta" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #f59e0b' }}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr className="row-detail">
                            <td colSpan={6} style={{ padding: 0, background: '#fbf6ee' }}>
                              {itLoading ? (
                                <div style={{ padding: '16px 24px', color: '#9a6a3a', fontSize: 13 }}>
                                  Cargando productos...
                                </div>
                              ) : items.length === 0 ? (
                                <div style={{ padding: '16px 24px', color: '#9a6a3a', fontSize: 13 }}>
                                  Sin productos
                                </div>
                              ) : (
                                <div className="venta-detalle">
                                  <div className="venta-detalle-scroll">
                                    <table className="sys-table sys-table--nested">
                                      <thead>
                                        <tr>
                                          <th>Producto</th>
                                          <th className="cell-right">Cantidad</th>
                                          <th className="cell-right">Medida</th>
                                          <th className="cell-right">Precio unit.</th>
                                          <th className="cell-right">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((it, idx) => {
                                          const hasPres = it.cantidad_por_presentacion > 1 && it.presentacion;
                                          const base = `${Number(it.qty || 0).toFixed(2)} ${fmtUom(it.uom || '')}`;
                                          return (
                                          <tr key={`${it.item_code}-${idx}`}>
                                            <td>
                                              <div className="cell-name">{it.item_name || it.item_code}</div>
                                              <div className="cell-code" style={{ fontSize: 12, color: '#9a8a78' }}>
                                                {it.item_code}
                                              </div>
                                            </td>
                                            <td className="cell-right cell-bold">
                                              {hasPres
                                                ? `${Number(it.qty_presentacion).toFixed(2)} ${it.presentacion}`
                                                : base}
                                            </td>
                                            <td className="cell-right" style={{ color: '#9a8a78' }}>
                                              {hasPres ? base : '—'}
                                            </td>
                                            <td className="cell-right">${fmt(it.rate)}</td>
                                            <td className="cell-right cell-bold">${fmt(it.amount)}</td>
                                          </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="venta-detalle-totales">
                                    <span className="vdt-items">{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
                                    <span className="vdt-grp">
                                      <span className="vdt-lbl">Subtotal</span>
                                      <span className="vdt-val">${fmt(v.total)}</span>
                                    </span>
                                    <span className="vdt-grp vdt-total">
                                      <span className="vdt-lbl">Total</span>
                                      <span className="vdt-val">${fmt(v.grand_total)}</span>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modal === 'nueva' && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalCancel()}>
          <div className="edit-modal-wrapper">
            <NuevaVentaB2B onSuccess={handleModalSuccess} onCancel={handleModalCancel} />
          </div>
        </div>
      )}

      {modal === 'editar' && borradorEditar && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalCancel()}>
          <div className="edit-modal-wrapper">
            <NuevaVentaB2B
              initialData={borradorEditar}
              onSuccess={handleModalSuccess}
              onCancel={handleModalCancel}
            />
          </div>
        </div>
      )}

      {pdfData && (
        <ModalReciboPDF datos={pdfData} onClose={() => setPdfData(null)} />
      )}

      {deleteModal.item && (
        <ConfirmModal
          title="Eliminar preventa"
          description={<>¿Seguro que deseas eliminar la venta <strong>{deleteModal.item}</strong>?</>}
          subdescription="Esta acción es permanente y no se puede deshacer."
          icon={ICON_TRASH}
          confirmLabel="Sí, eliminar"
          loadingLabel="Eliminando..."
          onConfirm={deleteModal.confirm}
          onCancel={deleteModal.close}
          loading={deleteModal.loading}
          error={deleteModal.error}
        />
      )}

      {cancelModal.item && (
        <ConfirmModal
          title={`Cancelar venta ${cancelModal.item?.custom_no_de_venta ? `#${cancelModal.item.custom_no_de_venta}` : cancelModal.item?.name}`}
          description={<>El stock vendido será <strong>revertido automáticamente</strong>. La venta quedará en historial como cancelada.</>}
          subdescription="Después podrás registrar una nueva venta con los datos correctos."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar venta"
          loadingLabel="Cancelando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Regresar"
          onConfirm={cancelModal.confirm}
          onCancel={cancelModal.close}
          loading={cancelModal.loading}
          error={cancelModal.error}
        />
      )}
    </Layout>
  );
}

export default VentaB2B;
