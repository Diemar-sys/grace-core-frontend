// src/pages/Catalogo.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NuevoInsumo from '../components/NuevoInsumo';
import { inventory } from '../services/frappeInventory';
import '../styles/global.css';
import '../styles/Panel.css';

const VISTAS = [
  { key: 'registrado', label: 'REGISTRADOS', color: 'vista-registrado' },
  { key: 'deshabilitado', label: 'DESHABILITADOS', color: 'vista-deshabilitado' },
];
const COLUMNAS = {
  registrado: ['Código Interno', 'Producto', 'Total', 'Precio por Unidad', 'Departamento', 'Unidad de Medida', 'Acciones'],
  deshabilitado: ['Código', 'Producto', 'Total', 'Precio por Unidad', 'Departamento', 'Deshabilitado', 'Acciones'],
};

/**
 * Componente modal para deshabilitar un insumo directamente sin abrir formulario.
 */
function ModalDeshabilitar({ item, onConfirm, onCancel, loading, error }) {
  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="del-modal">
        <div className="del-modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
        </div>
        <h3>Deshabilitar insumo</h3>
        <p>¿Seguro que deseas deshabilitar <strong>{item?.item_name}</strong>?</p>
        <p className="del-modal-sub">El insumo no aparecerá para nuevas operaciones pero su historial se mantendrá intacto.</p>

        {error && (
          <div className="del-modal-error">
            <p>{error}</p>
          </div>
        )}

        <div className="del-modal-actions">
          <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="del-btn-disable" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deshabilitando...' : 'Sí, deshabilitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente modal para habilitar un insumo directamente.
 */
function ModalHabilitar({ item, onConfirm, onCancel, loading, error }) {
  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="del-modal">
        <div className="del-modal-icon" style={{ background: '#dcfce7', color: '#16a34a', border: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h3>Restaurar insumo</h3>
        <p>¿Seguro que deseas restaurar <strong>{item?.item_name}</strong>?</p>
        <p className="del-modal-sub">El insumo volverá a estar disponible para todas las operaciones y recetas.</p>

        {error && (
          <div className="del-modal-error">
            <p>{error}</p>
          </div>
        )}

        <div className="del-modal-actions">
          <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="del-btn-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Restaurando...' : 'Sí, restaurar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente auxiliar para confirmar la eliminación de un insumo del catálogo.
 * Soporta modo "fallback" permitiendo deshabilitar si la eliminación falla por integridad referencial.
 * 
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.item - Datos del insumo a eliminar.
 * @param {Function} props.onConfirm - Callback cuando se confirma eliminación (DELETE).
 * @param {Function} props.onDisable - Callback cuando se confirma deshabilitación (Disabled = 1).
 * @param {Function} props.onCancel - Callback para cancelar y cerrar el modal.
 * @param {boolean} props.loading - Estado de carga actual.
 * @param {string} [props.error] - Mensaje de error (opcional).
 * @returns {JSX.Element} Modal de confirmación.
 */
function ModalEliminar({ item, onConfirm, onDisable, onCancel, loading, error }) {
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
        <h3>Eliminar insumo</h3>
        <p>¿Seguro que deseas eliminar <strong>{item?.item_name}</strong>?</p>
        <p className="del-modal-sub">Esta acción es permanente y no se puede deshacer.</p>

        {/* Si ERPNext rechazó el DELETE por transacciones */}
        {error && (
          <div className="del-modal-error">
            <p>No se puede eliminar porque este insumo tiene movimientos registrados.</p>
            <p>¿Deseas <strong>deshabilitarlo</strong> en su lugar?</p>
            <div className="del-modal-actions">
              <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>Cancelar</button>
              <button className="del-btn-disable" onClick={onDisable} disabled={loading}>
                {loading ? 'Deshabilitando...' : 'Sí, deshabilitar'}
              </button>
            </div>
          </div>
        )}

        {!error && (
          <div className="del-modal-actions">
            <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>Cancelar</button>
            <button className="del-btn-confirm" onClick={onConfirm} disabled={loading}>
              {loading ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Página principal del Catálogo de Insumos.
 * Muestra el listado de productos, permite filtrarlos, editarlos y crear nuevos 
 * usando los servicios de fraudeInventory (get_items, etc.).
 * @returns {JSX.Element} Vista del catálogo.
 */
function Catalogo() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [vistaActiva, setVistaActiva] = useState('registrado');
  const [items, setItems] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState('');

  // Estado del modal de eliminar
  const [itemAEliminar, setItemAEliminar] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Estado del modal de deshabilitar directo
  const [itemADeshabilitar, setItemADeshabilitar] = useState(null);
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Estado del modal de habilitar directo
  const [itemAHabilitar, setItemAHabilitar] = useState(null);
  const [enableLoading, setEnableLoading] = useState(false);
  const [enableError, setEnableError] = useState('');

  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  useEffect(() => {
    (async () => {
      try {
        const [, groupsData] = await Promise.all([
          inventory.getWarehouses(), inventory.getItemGroups(),
        ]);
        setItemGroups(groupsData);
      } catch (err) { console.error('Error cargando catálogos:', err); }
    })();
  }, []);

  useEffect(() => { loadItems(); }, [vistaActiva, selectedGroup, selectedTipo]);

  const loadItems = async () => {
    setLoading(true); setSearchTerm('');
    try {
      const filtros = { itemGroup: selectedGroup || null, tipoItem: selectedTipo || null };
      let data = [];
      if (vistaActiva === 'registrado') data = await inventory.getProductosRegistrados(filtros);
      if (vistaActiva === 'deshabilitado') data = await inventory.getProductosDeshabilitados(filtros);
      setItems(data);
    } catch (err) { console.error('Error cargando inventario:', err); }
    finally { setLoading(false); }
  };

  const handleVistaChange = (key) => { setVistaActiva(key); setSelectedGroup(''); };
  const handleNuevo = () => { setEditItem(null); setModalAbierto(true); };
  const handleModalClose = () => { setModalAbierto(false); setEditItem(null); };
  const handleModalSuccess = () => { handleModalClose(); loadItems(); };

  const handleEdit = async (itemCode) => {
    setEditLoading(true);
    try {
      const data = await inventory.getItemCompleto(itemCode);
      setEditItem(data); setModalAbierto(true);
    } catch (err) { console.error('Error cargando ítem:', err); }
    finally { setEditLoading(false); }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const handleDeleteClick = (item) => {
    setItemAEliminar(item);
    setDeleteError('');
  };

  // ── Deshabilitar Directo ───────────────────────────────────────────────────
  const handleDisableClick = (item) => {
    setItemADeshabilitar(item);
    setDisableError('');
  };

  const handleDisableDirectConfirm = async () => {
    setDisableLoading(true);
    setDisableError('');
    try {
      await inventory.disableItem(itemADeshabilitar.item_code);
      setItemADeshabilitar(null);
      loadItems();
    } catch (err) {
      setDisableError(err.message || 'No se pudo deshabilitar');
    } finally {
      setDisableLoading(false);
    }
  };

  // ── Habilitar Directo ──────────────────────────────────────────────────────
  const handleEnableClick = (item) => {
    setItemAHabilitar(item);
    setEnableError('');
  };

  const handleEnableDirectConfirm = async () => {
    setEnableLoading(true);
    setEnableError('');
    try {
      await inventory.enableItem(itemAHabilitar.item_code);
      setItemAHabilitar(null);
      loadItems();
    } catch (err) {
      setEnableError(err.message || 'No se pudo restaurar el insumo');
    } finally {
      setEnableLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await inventory.deleteItem(itemAEliminar.item_code);
      setItemAEliminar(null);
      loadItems();
    } catch (err) {
      // ERPNext rechaza si tiene transacciones — ofrecer deshabilitar
      setDeleteError(err.message || 'No se pudo eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDisableInstead = async () => {
    setDeleteLoading(true);
    try {
      await inventory.disableItem(itemAEliminar.item_code);
      setItemAEliminar(null);
      loadItems();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo deshabilitar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = items.filter(item =>
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.custom_código_interno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.custom_departamento?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                Catálogo
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginLeft: '10px' }}>
                  <path d="M12 7v14" /><path d="M16 12h2" /><path d="M16 8h2" />
                  <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                  <path d="M6 12h2" /><path d="M6 8h2" />
                </svg>
              </h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>Gestión centralizada de insumos y existencias</span>
            </div>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{filtered.length}</span>
              <span className="stat-label">Productos</span>
            </div>
          </div>
        </div>

        {accionActiva === 'menu' ? (
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => handleNuevo()}>
              <div className="module-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              </div>
              <h3>Crear Insumo</h3>
              <p>Registrar nuevo producto</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('editar')}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Insumo</h3>
              <p>Modificar detalles o stock</p>
            </button>
            <button className="panel-module" onClick={() => { setVistaActiva('registrado'); setAccionActiva('deshabilitar'); }}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
              </div>
              <h3>Deshabilitar</h3>
              <p>Pausar uso de un insumo</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('eliminar')}>
              <div className="module-icon" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
              </div>
              <h3>Eliminar</h3>
              <p>Borrar permanentemente</p>
            </button>
          </div>
        ) : (
          <>
            <div className="vistas-tabs">
              {VISTAS.map(v => (
                <button key={v.key}
                  className={`vista-tab ${v.color} ${vistaActiva === v.key ? 'activa' : ''}`}
                  onClick={() => handleVistaChange(v.key)}>{v.label}</button>
              ))}
            </div>

            <div className="filtros-section">
              <div className="filtro-group">
                <label>Categoría</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="filtro-group">
                <label>Tipo de Item</label>
                <select value={selectedTipo} onChange={e => setSelectedTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  <option value="MATERIA PRIMA">Materia Prima</option>
                  <option value="PRODUCTO TERMINADO">Producto Terminado</option>
                  <option value="INSUMO GENERAL">Insumo General</option>
                </select>
              </div>
              <div className="filtro-group search">
                <label>Buscar</label>
                <input type="text" placeholder="Nombre, código o código interno..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
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

            {loading ? <div className="loading">Cargando inventario...</div> : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>{COLUMNAS[vistaActiva].filter(c => !soloLectura || c !== 'Acciones').map((col, i) => <th key={i}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0
                      ? <tr><td colSpan={COLUMNAS[vistaActiva].length} className="no-data">No hay productos en esta vista</td></tr>
                      : filtered.map((item, i) => (
                        <FilaItem key={i} item={item} vista={vistaActiva}
                          onEdit={handleEdit} editLoading={editLoading}
                          onDelete={handleDeleteClick} onDisable={handleDisableClick} onEnable={handleEnableClick} soloLectura={soloLectura} accionActiva={accionActiva} />
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal editar */}
      {modalAbierto && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handleModalClose()}>
          <div className="edit-modal-wrapper">
            <NuevoInsumo editItem={editItem} onSuccess={handleModalSuccess} onCancel={handleModalClose} />
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {itemAEliminar && (
        <ModalEliminar
          item={itemAEliminar}
          onConfirm={handleDeleteConfirm}
          onDisable={handleDisableInstead}
          onCancel={() => { setItemAEliminar(null); setDeleteError(''); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}

      {/* Modal deshabilitar directo */}
      {itemADeshabilitar && (
        <ModalDeshabilitar
          item={itemADeshabilitar}
          onConfirm={handleDisableDirectConfirm}
          onCancel={() => { setItemADeshabilitar(null); setDisableError(''); }}
          loading={disableLoading}
          error={disableError}
        />
      )}

      {/* Modal habilitar directo */}
      {itemAHabilitar && (
        <ModalHabilitar
          item={itemAHabilitar}
          onConfirm={handleEnableDirectConfirm}
          onCancel={() => { setItemAHabilitar(null); setEnableError(''); }}
          loading={enableLoading}
          error={enableError}
        />
      )}
    </Layout>
  );
}

/**
 * Componente interno responsable de renderizar cada fila (Item) de la tabla base.
 * Dependiendo de la vista ('registrado' o 'deshabilitado') renderiza diferentes campos.
 *
 * @param {Object} props - Propiedades de la fila.
 * @param {Object} props.item - Datos crudos del Item devueltos por Frappe.
 * @param {string} props.vista - Vista actual seleccionada.
 * @param {Function} props.onEdit - Callback para editar un item.
 * @param {boolean} props.editLoading - Si hay una operación de edición en curso.
 * @param {Function} props.onDelete - Callback para abrir modal de eliminar.
 * @returns {JSX.Element|null} Fila condicional de la tabla.
 */
function FilaItem({ item, vista, onEdit, editLoading, onDelete, onDisable, onEnable, soloLectura, accionActiva }) {
  const BtnAcciones = () => soloLectura ? null : (
    <td className="col-actions">
      {accionActiva === 'editar' && (
        <button className="btn-edit-row" onClick={() => onEdit(item.item_code)}
          disabled={editLoading} title="Editar insumo">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
          </svg>
        </button>
      )}
      {(accionActiva === 'eliminar' || accionActiva === 'deshabilitar') && (
        <button className="btn-delete-row" onClick={() => {
          if (accionActiva === 'eliminar') onDelete(item);
          else if (vista === 'deshabilitado') onEnable(item);
          else onDisable(item);
        }}
          title={accionActiva === 'eliminar' ? "Eliminar insumo" : (vista === 'deshabilitado' ? "Restaurar insumo" : "Deshabilitar insumo")}>
          {accionActiva === 'eliminar' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          ) : vista === 'deshabilitado' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
          )}
        </button>
      )}
    </td>
  );

  if (vista === 'registrado') return (
    <tr>
      <td className="cell-code">{item.custom_código_interno || '—'}</td>
      <td className="cell-name">{item.item_name}</td>
      <td>{item.custom_total_presentacion ? `$${parseFloat(item.custom_total_presentacion).toFixed(2)}` : '—'}</td>
      <td>{item.custom_precio_final ? `$${parseFloat(item.custom_precio_final).toFixed(2)}` : '—'}</td>
      <td>{item.custom_departamento || '—'}</td>
      <td>{item.stock_uom || '—'}</td>
      <BtnAcciones />
    </tr>
  );

  if (vista === 'deshabilitado') return (
    <tr>
      <td className="cell-code">{item.item_code}</td>
      <td className="cell-name">{item.item_name}</td>
      <td>{item.custom_total_presentacion ? `$${parseFloat(item.custom_total_presentacion).toFixed(2)}` : '—'}</td>
      <td>{item.custom_precio_final ? `$${parseFloat(item.custom_precio_final).toFixed(2)}` : '—'}</td>
      <td>{item.custom_departamento || '—'}</td>
      <td className="cell-code">{item.modified?.split(' ')[0] || '—'}</td>
      <BtnAcciones />
    </tr>
  );
  return null;
}

export default Catalogo;