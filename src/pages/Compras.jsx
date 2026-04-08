// src/pages/Compras.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import NuevaCompra, { BuscadorProveedor } from "../components/NuevaCompra";
import { comprasService } from "../services/frappePurchase";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Componente para confirmar o cancelar la eliminación de una compra en estado Borrador.
 *
 * @param {Object} props - Props del Modal.
 * @param {string} props.compraName - Nombre/ID interno (name) de la compra.
 * @param {Function} props.onConfirm - Función que ejecuta el DELETE definitivo.
 * @param {Function} props.onCancel - Función para abortar la eliminación.
 * @param {boolean} props.loading - Estado de procesamiento.
 * @param {string} props.error - String de error en caso de fallo, para mostrar feedback.
 * @returns {JSX.Element}
 */
function ModalEliminar({ compraName, onConfirm, onCancel, loading, error }) {
  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="del-modal">
        <div className="del-modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" /><path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </div>
        <h3>Eliminar borrador</h3>
        <p>¿Seguro que deseas eliminar la compra <strong>{compraName}</strong>?</p>
        <p className="del-modal-sub">Esta acción es permanente y no se puede deshacer.</p>

        {error && (
          <div className="del-modal-error">
            <p>{error}</p>
          </div>
        )}

        <div className="del-modal-actions">
          <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="del-btn-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  const [compraAEliminar, setCompraAEliminar] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Ahora sólo cargamos al cambiar las fechas, el proveedor se filtra en vivo
  // AbortController: cancela el fetch si el componente se desmonta (evita doble request en StrictMode)
  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();   // cleanup al desmontar o re-ejecutar
  }, [desde, hasta]);

  const cargar = async (signal) => {
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
  };

  const handleEditar = async (name) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      setBorradorEditar(doc);
      setModal('editar');
    } catch (err) {
      console.error(err);
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

  const handleDeleteClick = (name) => {
    setCompraAEliminar(name);
    setDeleteError('');
  };

  const handleEliminarConfirm = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await comprasService.eliminarBorrador(compraAEliminar);
      setCompraAEliminar(null);
      cargar();
    } catch (err) {
      console.error(err);
      setDeleteError(err.message || 'No se pudo eliminar el borrador');
    } finally {
      setDeleteLoading(false);
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
    const term = searchTerm.toLowerCase();
    const supName = (c.supplier_name || '').toLowerCase();
    const supId = (c.supplier || '').toLowerCase();
    const noCompra = (c.custom_no_de_compra || '').toLowerCase();
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
            {!soloLectura && accionActiva !== 'menu' && (
              <button 
                onClick={() => setAccionActiva('menu')}
                className="btn-refresh" 
                style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db', color: '#4b5563' }}
                title="Volver al menú de compras"
              >
                ← Volver
              </button>
            )}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </div>
              <h3>Registrar Compra</h3>
              <p>Capturar mercancía recibida</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('editar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
              </div>
              <h3>Editar Borrador</h3>
              <p>Modificar compras pendientes</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('confirmar')}>
              <div className="module-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3>Confirmar Borrador</h3>
              <p>Procesar definitivamente</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('eliminar')}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </div>
              <h3>Eliminar Borrador</h3>
              <p>Descartar compras erradas</p>
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

        {/* TABLA */}
        {loading ? (
          <div className="loading">Cargando compras...</div>
        ) : (
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
                  {!soloLectura && <th>Acciones</th>}
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
                        <span className={`status-badge ${c.docstatus === 0 ? 'status-low' : 'status-ok'}`}>
                          {c.docstatus === 0 ? 'En Espera' : 'Recibida'}
                        </span>
                      </td>
                      {!soloLectura && (
                        <td className="comp-td-acciones">
                          {c.docstatus === 0 && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {accionActiva === 'confirmar' && (
                              <button className="comp-btn-confirmar" onClick={() => handleConfirmarBorrador(c.name)}
                                title="Confirmar compra">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                            )}
                            {accionActiva === 'editar' && (
                              <button className="comp-btn-editar" onClick={() => handleEditar(c.name)} title="Editar compra">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                              </button>
                            )}
                            {accionActiva === 'eliminar' && (
                              <button className="comp-btn-eliminar" onClick={() => handleDeleteClick(c.name)} title="Eliminar borrador">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                              </button>
                            )}
                          </div>
                          )}
                        </td>
                      )}
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
      {compraAEliminar && (
        <ModalEliminar
          compraName={compraAEliminar}
          onConfirm={handleEliminarConfirm}
          onCancel={() => { setCompraAEliminar(null); setDeleteError(''); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </Layout>
  );
}

export default Compras;