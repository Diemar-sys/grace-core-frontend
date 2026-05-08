// src/pages/Compras.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import NuevaCompra, { BuscadorProveedor } from "../components/NuevaCompra";
import ConfirmModal from "../components/ConfirmModal";
import { comprasService } from "../services/frappePurchase";
import useConfirmModal from "../hooks/useConfirmModal";
import { docToDatosImpresion, imprimirCompraPDF, imprimirCompraTicket } from "../utils/print/comprasPrint";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO_DOCSTATUS = { recibida: 1, en_espera: 0, cancelada: 2 };

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

/**
 * Vista Principal del histórico de Compras.
 * Permite buscar, filtrar por fechas, crear nuevas compras y administrar borradores.
 * Utiliza el servicio de FrappeComprasService.
 * @returns {JSX.Element} La página de gestión de compras.
 */
function Compras() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'nueva' | 'editar'
  const [borradorEditar, setBorradorEditar] = useState(null); // doc completo del borrador
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  const [vistaReporte, setVistaReporte] = useState(false);
  const [reporteData, setReporteData] = useState([]);
  const [reporteAño, setReporteAño] = useState(String(new Date().getFullYear()));
  const [reporteLoading, setReporteLoading] = useState(false);

  const cargarReporte = useCallback(async (año) => {
    setReporteLoading(true);
    try {
      const data = await comprasService.getReporteFiscalMensual(año || reporteAño);
      setReporteData(data);
    } catch (err) {
      console.error('Error reporte fiscal:', err);
    } finally {
      setReporteLoading(false);
    }
  }, [reporteAño]);

  useEffect(() => {
    if (vistaReporte) cargarReporte(reporteAño);
  }, [vistaReporte, reporteAño, cargarReporte]);

  // useCallback: el linter puede verificar dependencias. AbortSignal se recibe como
  // argumento para que el useEffect controle su ciclo de vida de forma explícita.
  const cargar = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await comprasService.getCompras({
        desde: desde || null,
        hasta: hasta || null,
      }, signal);
      setCompras(data);
    } catch (err) {
      if (err.name === 'AbortError') return;  // Cancelado intencionalmente, no es error
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  const deleteModal = useConfirmModal(
    (name) => comprasService.eliminarBorrador(name),
    { onSuccess: () => cargar() }
  );
  const cancelModal = useConfirmModal(
    (compra) => comprasService.cancelarCompra(compra.name),
    { onSuccess: () => cargar() }
  );

  // AbortController: cancela el fetch si el componente se desmonta o las fechas cambian.
  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const handleEditar = async (name) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      setBorradorEditar(doc);
      setModal('editar');
    } catch (err) {
      console.error(err);
    }
  };

  const handleImprimir = async (name, modo) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      const datos = docToDatosImpresion(doc);

      // Enriquecer con custom_cantidad_por_presentación del catálogo
      // (el PR de ERPNext no guarda ese campo en sus items)
      if (datos.filas?.length) {
        const codes = [...new Set(datos.filas.map(f => f.item_code).filter(Boolean))];
        const catItems = await comprasService.getItemsCatalogo(codes);
        const catMap = {};
        catItems.forEach(it => { catMap[it.item_code] = it; });
        datos.filas = datos.filas.map(f => ({
          ...f,
          kg_por_bulto: String(catMap[f.item_code]?.custom_cantidad_por_presentación || ''),
          uom: f.uom || catMap[f.item_code]?.stock_uom || '',
        }));
      }

      if (modo === 'ticket') imprimirCompraTicket(datos);
      else imprimirCompraPDF(datos);
    } catch (err) {
      console.error('Error imprimiendo compra:', err);
    }
  };

  const handleConfirmarBorrador = async (name) => {
    try {
      await comprasService.confirmarBorrador(name);
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

  // Filtrado local en vivo (igual que Catálogo / Proveedores)
  const filteredCompras = compras.filter(c => {
    if (estadoFiltro !== 'todas' && c.docstatus !== ESTADO_DOCSTATUS[estadoFiltro]) return false;
    const term = searchTerm.toLowerCase();
    const supName = (c.supplier_name || '').toLowerCase();
    const supId = (c.supplier || '').toLowerCase();
    const noCompra = String(c.custom_no_de_compra ?? '').toLowerCase();
    return supName.includes(term) || supId.includes(term) || noCompra.includes(term);
  });

  const totalPeriodo = filteredCompras
    .filter(c => c.docstatus === 1)
    .reduce((sum, c) => sum + (c.grand_total || 0), 0);

  return (
    <Layout>
      <div className="page-container">

        {/* HEADER */}
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                Compras
              </h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>Registro de recepciones de mercancia por proveedor</span>
            </div>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{filteredCompras.filter(c => c.docstatus === 1).length}</span>
              <span className="stat-label">Confirmadas</span>
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
              <div className="module-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </div>
              <h3>Registrar Compra</h3>
              <p>Capturar mercancía recibida</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('editar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Borrador</h3>
              <p>Modificar compras pendientes</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('confirmar')}>
              <div className="module-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3>Confirmar Borrador</h3>
              <p>Procesar definitivamente</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('eliminar')}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              </div>
              <h3>Eliminar Borrador</h3>
              <p>Descartar compras erradas</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('cancelar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3>Cancelar Compra</h3>
              <p>Revertir error en cantidades</p>
            </button>
            {/*<button className="panel-module" onClick={() => setAccionActiva('consultar')}>
              <div className="module-icon" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <h3>Consultar Compras</h3>
              <p>Ver historial completo</p>
            </button>*/}
          </div>
        ) : (
          <>
            {/* TABS DE ESTADO */}
            <div className="vistas-tabs">
              {[
                { key: 'todas',     label: 'Todas',     color: 'vista-registrado' },
                { key: 'recibida',  label: 'Recibida',  color: 'vista-stock' },
                { key: 'en_espera', label: 'En espera', color: 'vista-agotado' },
                { key: 'cancelada', label: 'Cancelada', color: 'vista-deshabilitado' },
              ].map(t => (
                <button key={t.key}
                  className={`vista-tab ${t.color} ${estadoFiltro === t.key ? 'activa' : ''}`}
                  onClick={() => setEstadoFiltro(t.key)}>
                  {t.label}
                  <span className="comp-tab-count">
                    {t.key === 'todas'
                      ? compras.length
                      : compras.filter(c => c.docstatus === ESTADO_DOCSTATUS[t.key]).length}
                  </span>
                </button>
              ))}
            </div>

            {/* FILTROS + BOTÓN */}
            <div className="filtros-section">
              <div className="filtro-group">
                <label>Desde</label>
                <input type="date" className="comp-date-input" value={desde}
                  onChange={e => setDesde(e.target.value)} />
              </div>
              <div className="filtro-group">
                <label>Hasta</label>
                <input type="date" className="comp-date-input" value={hasta}
                  onChange={e => setHasta(e.target.value)} />
              </div>
              <div className="filtro-group search">
                <label>Buscar proveedor / #</label>
                <input type="text" placeholder="Ej: LASTUR, #001"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <button className="btn-refresh"
                  style={vistaReporte ? { background: '#1e3a5f', color: '#fff' } : {}}
                  onClick={() => setVistaReporte(v => !v)}>
                  {vistaReporte ? '← Compras' : '📊 Reporte Fiscal'}
                </button>
                <button className="btn-refresh" onClick={cargar}>
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

            {/* REPORTE FISCAL */}
            {vistaReporte && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <label style={{ fontWeight: 600, fontSize: '14px' }}>Año:</label>
                  <select value={reporteAño} onChange={e => setReporteAño(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <button className="btn-refresh" onClick={() => cargarReporte(reporteAño)}>Actualizar</button>
                </div>
                {reporteLoading ? (
                  <div className="loading">Cargando reporte...</div>
                ) : (
                  <div className="table-container">
                    <table className="sys-table">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th className="cell-right"># Compras</th>
                          <th className="cell-right">Subtotal IVA 16%</th>
                          <th className="cell-right">Subtotal IEPS 8%</th>
                          <th className="cell-right">Subtotal IVA 0%</th>
                          <th className="cell-right">Subtotal</th>
                          <th className="cell-right">IVA 16%</th>
                          <th className="cell-right">IEPS 8%</th>
                          <th className="cell-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporteData.length === 0 ? (
                          <tr><td colSpan={9} className="no-data">Sin compras confirmadas en {reporteAño}</td></tr>
                        ) : reporteData.map(r => (
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
                          </tr>
                        ))}
                      </tbody>
                      {reporteData.length > 1 && (() => {
                        const tot = reporteData.reduce((a, r) => ({
                          compras: a.compras + r.compras,
                          subtotalIva16: a.subtotalIva16 + r.subtotalIva16,
                          subtotalIeps:  a.subtotalIeps  + r.subtotalIeps,
                          subtotalTasa0: a.subtotalTasa0 + r.subtotalTasa0,
                          subtotal: a.subtotal + r.subtotal,
                          iva:  a.iva  + r.iva,
                          ieps: a.ieps + r.ieps,
                          total: a.total + r.total,
                        }), { compras:0, subtotalIva16:0, subtotalIeps:0, subtotalTasa0:0, subtotal:0, iva:0, ieps:0, total:0 });
                        return (
                          <tfoot>
                            <tr style={{ fontWeight: 700, borderTop: '2px solid #374151', background: '#f9fafb' }}>
                              <td>TOTAL {reporteAño}</td>
                              <td className="cell-right">{tot.compras}</td>
                              <td className="cell-right">${fmt(tot.subtotalIva16)}</td>
                              <td className="cell-right">${fmt(tot.subtotalIeps)}</td>
                              <td className="cell-right">${fmt(tot.subtotalTasa0)}</td>
                              <td className="cell-right">${fmt(tot.subtotal)}</td>
                              <td className="cell-right">${fmt(tot.iva)}</td>
                              <td className="cell-right">${fmt(tot.ieps)}</td>
                              <td className="cell-right">${fmt(tot.total)}</td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TABLA */}
            {!vistaReporte && loading ? (
              <div className="loading">Cargando compras...</div>
            ) : !vistaReporte && (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th># Compra</th>
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th>Subtotal</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompras.length === 0 ? (
                      <tr><td colSpan={7} className="no-data">No hay compras registradas</td></tr>
                    ) : (
                      filteredCompras.map(c => (
                        <tr key={c.name}>
                          <td className="cell-code">
                            {c.custom_no_de_compra ? `#${c.custom_no_de_compra}` : '—'}
                          </td>
                          <td>{c.posting_date}</td>
                          <td className="comp-td-proveedor">{c.supplier_name || c.supplier}</td>
                          <td className="cell-right">${fmt(c.total)}</td>
                          <td className="cell-right cell-bold">${fmt(c.grand_total)}</td>
                          <td>
                            <span className={`status-badge ${c.docstatus === 0 ? 'status-low' :
                                c.docstatus === 2 ? 'status-cancelled' :
                                  'status-ok'
                              }`}>
                              {c.docstatus === 0 ? 'En Espera' : c.docstatus === 2 ? 'Cancelada' : 'Recibida'}
                            </span>
                          </td>
                          <td className="comp-td-acciones">
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {/* Imprimir PDF + Ticket — disponibles siempre */}
                              <button className="comp-btn-editar" onClick={() => handleImprimir(c.name, 'pdf')}
                                title="Imprimir PDF detallado"
                                style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              </button>
                              <button className="comp-btn-editar" onClick={() => handleImprimir(c.name, 'ticket')}
                                title="Imprimir Ticket"
                                style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                              </button>
                              {!soloLectura && (
                                <>
                                {c.docstatus === 0 && (
                                  <>
                                    {accionActiva === 'confirmar' && (
                                      <button className="comp-btn-confirmar" onClick={() => handleConfirmarBorrador(c.name)}
                                        title="Confirmar compra">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                      </button>
                                    )}
                                    {accionActiva === 'editar' && (
                                      <button className="comp-btn-editar" onClick={() => handleEditar(c.name)} title="Editar compra">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
                                      </button>
                                    )}
                                    {accionActiva === 'eliminar' && (
                                      <button className="comp-btn-eliminar" onClick={() => deleteModal.open(c.name)} title="Eliminar borrador">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                      </button>
                                    )}
                                  </>
                                )}
                                {c.docstatus === 1 && accionActiva === 'cancelar' && (
                                  <button className="comp-btn-eliminar" onClick={() => cancelModal.open(c)}
                                    title="Cancelar compra" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #f59e0b' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                  </button>
                                )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal nueva compra */}
      {modal === 'nueva' && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalCancel()}>
          <div className="edit-modal-wrapper">
            <NuevaCompra onSuccess={handleModalSuccess} onCancel={handleModalCancel} />
          </div>
        </div>
      )}

      {/* Modal editar borrador */}
      {modal === 'editar' && borradorEditar && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalCancel()}>
          <div className="edit-modal-wrapper">
            <NuevaCompra
              initialData={borradorEditar}
              onSuccess={handleModalSuccess}
              onCancel={handleModalCancel}
            />
          </div>
        </div>
      )}

      {/* Modal eliminar borrador */}
      {deleteModal.item && (
        <ConfirmModal
          title="Eliminar borrador"
          description={<>¿Seguro que deseas eliminar la compra <strong>{deleteModal.item}</strong>?</>}
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

      {/* Modal cancelar compra confirmada */}
      {cancelModal.item && (
        <ConfirmModal
          title={`Cancelar compra ${cancelModal.item?.custom_no_de_compra ? `#${cancelModal.item.custom_no_de_compra}` : cancelModal.item?.name}`}
          description={<>El stock recibido en esta compra será <strong>revertido automáticamente</strong>. La compra quedará en historial como cancelada.</>}
          subdescription="Después podrás registrar una nueva compra con las cantidades correctas."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar compra"
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

export default Compras;