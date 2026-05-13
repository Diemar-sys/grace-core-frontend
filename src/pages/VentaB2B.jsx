// src/pages/VentaB2B.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import NuevaVentaB2B from "../components/NuevaVentaB2B";
import ModalRegistrarPago from "../components/ModalRegistrarPago";
import ConfirmModal from "../components/ConfirmModal";
import { ventasService } from "../services/frappeSales";
import useConfirmModal from "../hooks/useConfirmModal";
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

  // Vista líneas detalladas (solo modo consulta)
  const [vistaLineas, setVistaLineas] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [gruposLoading, setGruposLoading] = useState(false);
  const [clienteExpandido, setClienteExpandido] = useState({});

  const cargarGrupos = useCallback(async (signal) => {
    setGruposLoading(true);
    try {
      const data = await ventasService.getLineasVentas({
        desde: desde || null,
        hasta: hasta || null,
      }, signal);
      setGrupos(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error líneas ventas:', err);
    } finally {
      setGruposLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    if (!vistaLineas) return;
    const controller = new AbortController();
    cargarGrupos(controller.signal);
    return () => controller.abort();
  }, [vistaLineas, cargarGrupos]);

  const toggleCliente = (customer) => {
    setClienteExpandido(prev => ({ ...prev, [customer]: !prev[customer] }));
  };

  // Libreta de cobros — clientes con deuda pendiente
  const [deudas, setDeudas] = useState([]);
  const [deudasLoading, setDeudasLoading] = useState(false);
  const [deudaExpandida, setDeudaExpandida] = useState({});
  const [pagoModal, setPagoModal] = useState(null); // grupo seleccionado para cobro

  const cargarDeudas = useCallback(async (signal) => {
    setDeudasLoading(true);
    try {
      const data = await ventasService.getDeudaPorCliente(signal);
      setDeudas(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error deudas:', err);
    } finally {
      setDeudasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accionActiva !== 'libreta') return;
    const controller = new AbortController();
    cargarDeudas(controller.signal);
    return () => controller.abort();
  }, [accionActiva, cargarDeudas]);

  const toggleDeuda = (customer) => {
    setDeudaExpandida(prev => ({ ...prev, [customer]: !prev[customer] }));
  };

  const handlePagoSuccess = () => {
    setPagoModal(null);
    cargarDeudas();
  };

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
              <h3>Libreta / Cobros</h3>
              <p>Saldos por cliente y pagos</p>
            </button>
          </div>
        ) : accionActiva === 'libreta' ? (
          <>
            <div className="filtros-section">
              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <button className="btn-refresh" onClick={() => setAccionActiva('menu')}>← Volver</button>
                <button className="btn-refresh" onClick={cargarDeudas}>
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

            {deudasLoading ? (
              <div className="loading">Cargando libreta...</div>
            ) : deudas.length === 0 ? (
              <div className="no-data" style={{ padding: '40px', textAlign: 'center' }}>
                Sin saldos pendientes — todos los clientes están al corriente
              </div>
            ) : (
              <div style={{ marginTop: '16px' }}>
                {deudas.map(g => {
                  const open = !!deudaExpandida[g.customer];
                  return (
                    <div key={g.customer} className="grupo-cliente"
                      style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 18px', background: open ? '#fef3c7' : '#fffbeb',
                        borderBottom: open ? '1px solid #fde68a' : 'none',
                      }}>
                        <button onClick={() => toggleDeuda(g.customer)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '15px', flex: 1, textAlign: 'left', padding: 0,
                          }}>
                          <span style={{ fontSize: '14px', color: '#92400e' }}>{open ? '▼' : '▶'}</span>
                          <strong style={{ fontSize: '16px' }}>{g.customer_name}</strong>
                          <span style={{ fontSize: '13px', color: '#92400e' }}>
                            ({g.facturas.length} {g.facturas.length === 1 ? 'factura' : 'facturas'})
                          </span>
                        </button>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '17px', color: '#92400e' }}>
                            ${fmt(g.totalDeuda)}
                          </span>
                          <button
                            className="comp-btn-confirmar"
                            onClick={() => setPagoModal(g)}
                            style={{ background: '#16a34a', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 600 }}>
                            💰 Cobrar
                          </button>
                        </div>
                      </div>
                      {open && (
                        <div style={{ padding: '8px 18px', background: '#fafafa' }}>
                          <table className="sys-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th># Venta</th>
                                <th className="cell-right">Total</th>
                                <th className="cell-right">Saldo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.facturas.map(f => (
                                <tr key={f.name}>
                                  <td>{f.posting_date}</td>
                                  <td className="cell-code">
                                    {f.custom_no_de_venta ? `#${f.custom_no_de_venta}` : f.name}
                                  </td>
                                  <td className="cell-right">${fmt(f.grand_total)}</td>
                                  <td className="cell-right cell-bold" style={{ color: '#92400e' }}>
                                    ${fmt(f.outstanding_amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="vistas-tabs">
              {[
                { key: 'registrada', label: 'Registrada', color: 'vista-stock' },
                { key: 'preventa',   label: 'Preventa',   color: 'vista-agotado' },
                { key: 'cancelada',  label: 'Cancelada',  color: 'vista-deshabilitado' },
                { key: 'todas',      label: 'Todas',      color: 'vista-registrado' },
              ].map(t => (
                <button key={t.key}
                  className={`vista-tab ${t.color} ${estadoFiltro === t.key ? 'activa' : ''}`}
                  onClick={() => setEstadoFiltro(t.key)}>
                  {t.label}
                  <span className="comp-tab-count">
                    {t.key === 'todas'
                      ? ventas.length
                      : ventas.filter(v => v.docstatus === ESTADO_DOCSTATUS[t.key]).length}
                  </span>
                </button>
              ))}
            </div>

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
                <label>Buscar cliente / #</label>
                <input type="text" placeholder="Ej: ZAKIA, #001"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                {soloLectura && (
                  <button className="btn-refresh"
                    style={vistaLineas ? { background: '#1e3a5f', color: '#fff' } : {}}
                    onClick={() => setVistaLineas(v => !v)}>
                    {vistaLineas ? '← Por venta' : '📋 Por cliente'}
                  </button>
                )}
                <button className="btn-refresh" onClick={vistaLineas ? cargarGrupos : cargar}>
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

            {vistaLineas ? (
              gruposLoading ? (
                <div className="loading">Cargando líneas por cliente...</div>
              ) : grupos.length === 0 ? (
                <div className="no-data" style={{ padding: '40px', textAlign: 'center' }}>
                  Sin ventas confirmadas en el periodo
                </div>
              ) : (
                <div style={{ marginTop: '16px' }}>
                  {grupos.map(g => {
                    const open = !!clienteExpandido[g.customer];
                    return (
                      <div key={g.customer} className="grupo-cliente"
                        style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                        <button
                          onClick={() => toggleCliente(g.customer)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px', background: open ? '#f3f4f6' : '#fff',
                            border: 'none', borderBottom: open ? '1px solid #e5e7eb' : 'none',
                            cursor: 'pointer', fontSize: '15px', textAlign: 'left',
                          }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>{open ? '▼' : '▶'}</span>
                            <strong style={{ fontSize: '16px' }}>{g.customer_name}</strong>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>
                              ({g.totalVentas} {g.totalVentas === 1 ? 'venta' : 'ventas'})
                            </span>
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#111' }}>
                            ${fmt(g.totalMonto)}
                          </span>
                        </button>
                        {open && (
                          <div style={{ padding: '12px 18px', background: '#fafafa' }}>
                            {g.ventas.map(v => (
                              <div key={v.name} style={{ marginBottom: '14px' }}>
                                <div style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '6px 0', borderBottom: '1px dashed #d1d5db', marginBottom: '6px',
                                }}>
                                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                                    {v.posting_date}
                                    {' · '}
                                    <span className="cell-code">
                                      {v.custom_no_de_venta ? `#${v.custom_no_de_venta}` : v.name}
                                    </span>
                                  </span>
                                  <span style={{ fontWeight: 700, color: '#111' }}>
                                    ${fmt(v.grand_total)}
                                  </span>
                                </div>
                                <table className="sys-table" style={{ marginTop: '4px' }}>
                                  <thead>
                                    <tr>
                                      <th>Producto</th>
                                      <th className="cell-right">Cant.</th>
                                      <th className="cell-right">Precio unit.</th>
                                      <th className="cell-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {v.items.length === 0 ? (
                                      <tr><td colSpan={4} className="no-data">Sin líneas</td></tr>
                                    ) : v.items.map((it, idx) => (
                                      <tr key={idx}>
                                        <td>
                                          <div className="cell-name">{it.item_name || it.item_code}</div>
                                          <div className="cell-code" style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {it.item_code}
                                          </div>
                                        </td>
                                        <td className="cell-right">
                                          {Number(it.qty || 0).toFixed(2)} {it.uom || ''}
                                        </td>
                                        <td className="cell-right">${fmt(it.rate)}</td>
                                        <td className="cell-right cell-bold">${fmt(it.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : loading ? (
              <div className="loading">Cargando ventas...</div>
            ) : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th># Venta</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Subtotal</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVentas.length === 0 ? (
                      <tr><td colSpan={7} className="no-data">No hay ventas registradas</td></tr>
                    ) : (
                      filteredVentas.map(v => (
                        <tr key={v.name}>
                          <td className="cell-code">
                            {v.custom_no_de_venta ? `#${v.custom_no_de_venta}` : '—'}
                          </td>
                          <td>{v.posting_date}</td>
                          <td className="comp-td-proveedor">{v.customer_name || v.customer}</td>
                          <td className="cell-right">${fmt(v.total)}</td>
                          <td className="cell-right cell-bold">${fmt(v.grand_total)}</td>
                          <td>
                            <span className={`status-badge ${v.docstatus === 0 ? 'status-low' :
                                v.docstatus === 2 ? 'status-cancelled' :
                                  'status-ok'
                              }`}>
                              {v.docstatus === 0 ? 'Preventa' : v.docstatus === 2 ? 'Cancelada' : 'Registrada'}
                            </span>
                          </td>
                          <td className="comp-td-acciones">
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                      ))
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

      {pagoModal && (
        <ModalRegistrarPago
          grupo={pagoModal}
          onSuccess={handlePagoSuccess}
          onCancel={() => setPagoModal(null)}
        />
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
