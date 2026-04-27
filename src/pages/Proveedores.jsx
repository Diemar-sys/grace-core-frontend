// src/pages/Proveedores.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NuevoProveedor from '../components/NuevoProveedor';
import { proveedores } from '../services/frappeSupplier';
import { PAGE_SIZE } from '../config/constants';
import ConfirmModal from '../components/ConfirmModal';
import useConfirmModal from '../hooks/useConfirmModal';
import useDebounce from '../hooks/useDebounce';
import { TAXONOMY, getTipoDeGrupo } from '../config/proveedorTaxonomy';
import '../styles/global.css';

const ICON_TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
    fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const VISTAS = [
  { key: 'activo', label: 'ACTIVOS', color: 'vista-registrado' },
  { key: 'deshabilitado', label: 'DESHABILITADOS', color: 'vista-deshabilitado' },
];

const COLUMNAS = {
  activo: ['#', 'Proveedor', 'Alias', 'Teléfono', 'Correo', 'Tipo', 'Subtipo', 'Editar'],
  deshabilitado: ['#', 'Proveedor', 'Alias', 'Teléfono', 'Correo', 'Tipo', 'Subtipo', 'Editar'],
};

/**
 * Página principal de Gestión de Proveedores.
 * Lista todos los proveedores registrados, permite crear nuevos y modificar los existentes.
 * Filtra entre proveedores activos e inactivos mediante el servicio `FrappeSupplier`.
 * @returns {JSX.Element} Vista de administración de proveedores.
 */
function Proveedores() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  const [vistaActiva, setVistaActiva] = useState('activo');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTipo, setSelectedTipo] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const deleteModal = useConfirmModal(
    (item) => proveedores.eliminarProveedor(item.name),
    { onSuccess: () => loadItems() }
  );

  const [inputBusqueda, setInputBusqueda] = useState('');
  const searchTerm = useDebounce(inputBusqueda, 350);

  // Paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // useCallback para que useEffect pueda declarar loadItems como dependencia limpiamente
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const filtros = {
        grupo: selectedGrupo || null,
        search: searchTerm || null,
        page,
        pageSize: PAGE_SIZE,
      };
      const res = vistaActiva === 'activo'
        ? await proveedores.getProveedores(filtros)
        : await proveedores.getProveedoresDeshabilitados(filtros);

      setItems(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) { console.error('Error cargando proveedores:', err); }
    finally { setLoading(false); }
  }, [vistaActiva, selectedGrupo, searchTerm, page]);

  useEffect(() => { setPage(1); }, [vistaActiva, selectedTipo, selectedGrupo, searchTerm]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const handleVistaChange = (key) => { setVistaActiva(key); setSelectedTipo(''); setSelectedGrupo(''); setInputBusqueda(''); };
  const handleNuevo = () => { setEditItem(null); setModalAbierto(true); };
  const handleModalClose = () => { setModalAbierto(false); setEditItem(null); };
  const handleModalSuccess = () => { handleModalClose(); loadItems(); };


  const handleEdit = async (supplierName) => {
    setEditLoading(true);
    try {
      const data = await proveedores.getProveedorCompleto(supplierName);
      setEditItem(data); setModalAbierto(true);
    } catch (err) { console.error('Error cargando proveedor:', err); }
    finally { setEditLoading(false); }
  };

  return (
    <Layout>
      <div className="page-container">

        {/* HEADER */}
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                Proveedores
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginLeft: '10px', verticalAlign: 'middle' }}>
                  <path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" />
                  <path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" />
                  <path d="M9 18h5" /><circle cx="16" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
                </svg>
              </h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>Gestión de proveedores y contactos</span>
            </div>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{total}</span>
              <span className="stat-label">Proveedores</span>
            </div>
          </div>
        </div>

        {accionActiva === 'menu' ? (
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={handleNuevo}>
              <div className="module-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </div>
              <h3>Registrar Proveedor</h3>
              <p>Crear nuevo contacto comercial</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('editar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Proveedor</h3>
              <p>Modificar datos existentes</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('eliminar')}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <h3>Eliminar Proveedor</h3>
              <p>Borrar proveedor permanentemente</p>
            </button>
            {/*<button className="panel-module" onClick={() => setAccionActiva('consultar')}>
              <div className="module-icon" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <h3>Consultar Proveedores</h3>
              <p>Ver listado completo</p>
            </button>*/}
          </div>
        ) : (
          <>
            {/* PESTAÑAS */}
            <div className="vistas-tabs">
              {VISTAS.map(v => (
                <button key={v.key}
                  className={`vista-tab ${v.color} ${vistaActiva === v.key ? 'activa' : ''}`}
                  onClick={() => handleVistaChange(v.key)}>{v.label}</button>
              ))}
            </div>

            {/* FILTROS */}
            <div className="filtros-section">
              <div className="filtro-group">
                <label>Tipo</label>
                <select value={selectedTipo} onChange={e => {
                  setSelectedTipo(e.target.value);
                  setSelectedGrupo('');
                }}>
                  <option value="">Todos</option>
                  {Object.keys(TAXONOMY).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="filtro-group">
                <label>Subtipo</label>
                <select
                  value={selectedGrupo}
                  onChange={e => setSelectedGrupo(e.target.value)}
                  disabled={!selectedTipo}
                >
                  <option value="">Todos</option>
                  {selectedTipo && TAXONOMY[selectedTipo]?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="filtro-group search">
                <label>Buscar</label>
                <input type="text" placeholder="Nombre, alias o razón social..."
                  value={inputBusqueda} onChange={e => setInputBusqueda(e.target.value)} />
              </div>
              
              {totalPages > 1 && (
                <div className="paginacion">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Anterior</button>
                  <span>Página {page} de {totalPages} — {total} proveedores</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Siguiente →</button>
                </div>
              )}

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <button className="btn-refresh" onClick={loadItems}>
                  Actualizar
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
                    <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* TABLA */}
            {loading ? <div className="loading">Cargando proveedores...</div> : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>{COLUMNAS[vistaActiva].filter(c => !soloLectura || c !== 'Editar').map((col, i) => <th key={i}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={COLUMNAS[vistaActiva].length} className="no-data">No hay proveedores en esta vista</td></tr>
                    ) : (
                      items.map((item, i) => (
                        <FilaProveedor key={i} item={item} onEdit={handleEdit} editLoading={editLoading}
                          soloLectura={soloLectura} accionActiva={accionActiva}
                          onDelete={deleteModal.open} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modalAbierto && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalClose()}>
          <div className="edit-modal-wrapper">
            <NuevoProveedor editItem={editItem} onSuccess={handleModalSuccess} onCancel={handleModalClose} />
          </div>
        </div>
      )}

      {deleteModal.item && (
        <ConfirmModal
          title="Eliminar proveedor"
          description={<>¿Seguro que deseas eliminar <strong>{deleteModal.item.supplier_name}</strong>?</>}
          subdescription="Esta acción es permanente y no puede deshacerse."
          icon={ICON_TRASH}
          confirmLabel="Sí, eliminar"
          loadingLabel="Eliminando..."
          confirmStyle={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}
          onConfirm={deleteModal.confirm}
          onCancel={deleteModal.close}
          loading={deleteModal.loading}
          error={deleteModal.error}
        />
      )}
    </Layout>
  );
}

/**
 * Renderiza una fila en la tabla de proveedores.
 *
 * @param {Object} props - Propiedades de la fila.
 * @param {Object} props.item - Datos del proveedor.
 * @param {Function} props.onEdit - Callback al pulsar el botón de edición.
 * @param {boolean} props.editLoading - Indica si hay una petición de edición en proceso.
 * @returns {JSX.Element} Elemento <tr>.
 */
function FilaProveedor({ item, onEdit, editLoading, soloLectura, accionActiva, onDelete }) {
  const tipo    = getTipoDeGrupo(item.supplier_group) || item.custom_tipo || '';
  const subtipo = item.supplier_group && !['All Supplier Groups', 'COSTO', 'GASTO', ''].includes(item.supplier_group)
    ? item.supplier_group
    : '—';

  const tipoBadge = tipo
    ? <span className={`status-badge ${tipo === 'COSTO' ? 'status-ok' : 'status-low'}`}>{tipo}</span>
    : '—';

  return (
    <tr>
      <td className="cell-code">{item.custom_no_de_proveedor || '—'}</td>
      <td className="cell-name">{item.supplier_name}</td>
      <td>{item.custom_alias || '—'}</td>
      <td>{item.custom_teléfono || '—'}</td>
      <td>{item.custom_correo || '—'}</td>
      <td>{tipoBadge}</td>
      <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{subtipo}</td>
      {!soloLectura && accionActiva === 'editar' && (
        <td className="col-actions">
          <button className="btn-edit-row" onClick={() => onEdit(item.name)}
            disabled={editLoading} title="Editar proveedor">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
            </svg>
          </button>
        </td>
      )}
      {!soloLectura && accionActiva === 'eliminar' && (
        <td className="col-actions">
          <button className="btn-edit-row" onClick={() => onDelete(item)}
            title="Eliminar proveedor" style={{ color: '#dc2626' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
}

export default Proveedores;