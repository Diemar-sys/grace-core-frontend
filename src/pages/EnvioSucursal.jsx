// src/pages/EnvioSucursal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import NuevoEnvioSucursal from "../components/NuevoEnvioSucursal";
import ModalHojaEntrega from "../components/modals/ModalHojaEntrega";
import ConfirmModal from "../components/modals/ConfirmModal";
import useConfirmModal from "../hooks/useConfirmModal";
import { stockService } from "../services/frappeStock";
import useSucursales from "../hooks/useSucursales";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ESTADO_DOCSTATUS = { enviada: 1, preventa: 0, cancelada: 2 };

const ICON_WARNING = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

function EnvioSucursal() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const { sucursales_destino: sucursales } = useSucursales();
  const [sucursalSel, setSucursalSel] = useState('');

  // Inicializar selector al primer warehouse disponible cuando cargue config
  useEffect(() => {
    if (!sucursalSel && sucursales.length > 0) {
      setSucursalSel(sucursales[0].warehouse);
    }
  }, [sucursales, sucursalSel]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState('enviada');

  const [verCuentas, setVerCuentas] = useState(false);
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filaExpandida, setFilaExpandida] = useState({});

  const [modal, setModal] = useState(null); // null | 'nuevo'
  const [hojaData, setHojaData] = useState(null);

  const sucursalLabel = sucursales.find(s => s.warehouse === sucursalSel)?.label || sucursalSel;

  const cargar = useCallback(async (signal) => {
    if (!sucursalSel) { setEnvios([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await stockService.getTransferenciasSucursal({
        warehouseDestino: sucursalSel,
        desde: desde || null,
        hasta: hasta || null,
        docstatus: null, // todas
      }, signal);
      setEnvios(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error envíos sucursal:', err);
    } finally {
      setLoading(false);
    }
  }, [sucursalSel, desde, hasta]);

  const cancelModal = useConfirmModal(
    (envio) => stockService.cancelarTransferencia(envio.name),
    { onSuccess: () => cargar() }
  );

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const toggleFila = (name) => {
    setFilaExpandida(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleModalSuccess = () => {
    setModal(null);
    cargar();
  };

  const handleModalCancel = () => setModal(null);

  const handleReimprimir = async (envio) => {
    try {
      const doc = await stockService.getTransferenciaDoc(envio.name);
      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      // Rehidratar presentación desde catálogo para mostrar conversión Kg ↔ Bulto.
      const codes = [...new Set((doc?.items || []).map(i => i.item_code).filter(Boolean))];
      let dict = {};
      try {
        dict = await stockService.getItemsPresentacion(codes);
      } catch (e) { console.warn('Catálogo no disponible:', e); }
      const filas = (doc?.items || []).map(it => {
        const m = dict[it.item_code] || {};
        const cantPres = parseFloat(m.custom_cantidad_por_presentación) || 1;
        return {
          item_code: it.item_code,
          item_name: it.item_name,
          uom: it.stock_uom || it.uom,
          qty: parseFloat(it.qty || 0), // el doc ya guarda en unidad base (stock_uom)
          cantidad_por_presentacion: cantPres,
          presentacion: m.custom_presentación || '',
        };
      });
      setHojaData({
        fecha: doc.posting_date,
        hora,
        sucursalLabel,
        warehouseDestino: doc.to_warehouse || sucursalSel,
        filas,
        notas: doc.remarks || '',
        docName: doc.name,
      });
    } catch (err) {
      console.error('Error al cargar envío:', err);
    }
  };

  const filteredEnvios = envios.filter(e => {
    if (estadoFiltro !== 'todas' && e.docstatus !== ESTADO_DOCSTATUS[estadoFiltro]) return false;
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const name = (e.name || '').toLowerCase();
    const remarks = (e.remarks || '').toLowerCase();
    return name.includes(term) || remarks.includes(term);
  });

  const totalPeriodo = filteredEnvios
    .filter(e => e.docstatus === 1)
    .reduce((acc, e) => acc + (e.totalMonto || 0), 0);
  const totalItems = filteredEnvios.reduce((acc, e) => acc + (e.items?.length || 0), 0);

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h1 style={{ margin: 0 }}>Envío a Sucursal</h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>
                Transferencias internas a sucursales administradas
              </span>
            </div>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{filteredEnvios.length}</span>
              <span className="stat-label">Envíos</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{totalItems}</span>
              <span className="stat-label">Líneas</span>
            </div>
            {verCuentas && (
              <div className="stat-card warning">
                <span className="stat-number comp-stat-total">${fmt(totalPeriodo)}</span>
                <span className="stat-label">Total periodo</span>
              </div>
            )}
          </div>
        </div>

        <div className="filtros-section">
          <div className="filtro-group filtro-sm">
            <label>Estado</label>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
              <option value="enviada">Enviada ({envios.filter(e => e.docstatus === ESTADO_DOCSTATUS.enviada).length})</option>
              <option value="cancelada">Cancelada ({envios.filter(e => e.docstatus === ESTADO_DOCSTATUS.cancelada).length})</option>
              <option value="todas">Todas ({envios.length})</option>
            </select>
          </div>
          <div className="filtro-group filtro-sm">
            <label>Sucursal</label>
            <select className="comp-date-input" value={sucursalSel}
              onChange={e => setSucursalSel(e.target.value)}>
              {sucursales.map(s => (
                <option key={s.warehouse} value={s.warehouse}>{s.label}</option>
              ))}
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
            <label>Buscar # / nota</label>
            <input type="text" placeholder="Ej: MAT-STE-..., entrega"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
            <button className="btn-refresh"
              style={verCuentas ? { background: '#1e3a5f', color: '#fff' } : {}}
              onClick={() => setVerCuentas(v => !v)}
              title="Mostrar/ocultar montos">
              {verCuentas ? '🙈 Ocultar cuentas' : '💰 Ver cuentas'}
            </button>
            {!soloLectura && (
              <button className="btn-refresh" style={{ background: '#16a34a', color: '#fff' }}
                onClick={() => setModal('nuevo')}>
                + Nuevo Envío
              </button>
            )}
            <button className="btn-refresh" onClick={() => cargar()}>
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
          <div className="loading">Cargando envíos...</div>
        ) : filteredEnvios.length === 0 ? (
          <div className="no-data" style={{ padding: '40px', textAlign: 'center' }}>
            Sin envíos a {sucursalLabel} en el periodo
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            {filteredEnvios.map(e => {
              const open = !!filaExpandida[e.name];
              const isEnviada = e.docstatus === 1;
              const isCancelada = e.docstatus === 2;
              return (
                <div key={e.name} className="grupo-cliente"
                  style={{
                    marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '8px',
                    overflow: 'hidden', opacity: isCancelada ? 0.7 : 1,
                  }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: open ? '#f3f4f6' : '#fff',
                    borderBottom: open ? '1px solid #e5e7eb' : 'none',
                  }}>
                    <button
                      onClick={() => toggleFila(e.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', flex: 1,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '15px', textAlign: 'left', padding: 0,
                      }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>{open ? '▼' : '▶'}</span>
                      <strong style={{ fontSize: '15px' }}>{e.posting_date}</strong>
                      <span className="cell-code" style={{ fontSize: '13px', color: '#6b7280' }}>{e.name}</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>
                        ({e.items.length} {e.items.length === 1 ? 'línea' : 'líneas'})
                      </span>
                      {isCancelada && (
                        <span className="status-badge status-cancelled">Cancelada</span>
                      )}
                      {e.remarks && (
                        <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                          {e.remarks}
                        </span>
                      )}
                    </button>
                    {verCuentas && (
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#111', marginRight: 12 }}>
                        ${fmt(e.totalMonto)}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="comp-btn-editar" onClick={() => handleReimprimir(e)}
                        title="Reimprimir hoja de entrega"
                        style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect width="12" height="8" x="6" y="14" />
                        </svg>
                      </button>
                      {!soloLectura && isEnviada && (
                        <button className="comp-btn-eliminar" onClick={() => cancelModal.open(e)}
                          title="Cancelar envío"
                          style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #f59e0b' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {open && (
                    <div style={{ padding: '12px 18px', background: '#fafafa' }}>
                      <table className="sys-table">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th className="cell-right">Cantidad</th>
                            {verCuentas && <th className="cell-right">Precio unit.</th>}
                            {verCuentas && <th className="cell-right">Subtotal</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {e.items.map((it, idx) => (
                            <tr key={`${it.item_code}-${idx}`}>
                              <td>
                                <div className="cell-name">{it.item_name || it.item_code}</div>
                                <div className="cell-code" style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {it.item_code}
                                </div>
                              </td>
                              <td className="cell-right">
                                {fmtQty(it.qty)} {it.uom || ''}
                              </td>
                              {verCuentas && (
                                <td className="cell-right">${fmt(it.custom_precio_venta)}</td>
                              )}
                              {verCuentas && (
                                <td className="cell-right cell-bold">${fmt(it.monto)}</td>
                              )}
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
      </div>

      {modal === 'nuevo' && (
        <div className="edit-overlay" onClick={ev => ev.target === ev.currentTarget && handleModalCancel()}>
          <div className="edit-modal-wrapper">
            <NuevoEnvioSucursal
              sucursalDefault={sucursalSel}
              onSuccess={handleModalSuccess}
              onCancel={handleModalCancel}
            />
          </div>
        </div>
      )}

      {hojaData && (
        <ModalHojaEntrega
          datos={hojaData}
          onClose={() => setHojaData(null)}
        />
      )}

      {cancelModal.item && (
        <ConfirmModal
          title={`Cancelar envío ${cancelModal.item?.name || ''}`}
          description={
            <>El stock enviado será <strong>revertido automáticamente</strong> a Bodega Central.
              El envío quedará en historial como cancelado.</>
          }
          subdescription="Después podrás registrar un nuevo envío con los datos correctos."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar envío"
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

export default EnvioSucursal;
