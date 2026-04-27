// src/pages/Catalogo.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NuevoInsumo from '../components/NuevoInsumo';
import ConfirmModal from '../components/ConfirmModal';
import { inventory } from '../services/frappeInventory';
import useConfirmModal from '../hooks/useConfirmModal';
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

const ICON_TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const ICON_DISABLE = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const ICON_ENABLE = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

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

  // Declarada con useCallback para que useEffect pueda declararla en sus dependencias
  // sin suprimir el linter. Las dependencias reflejan exactamente qué valores usa.
  const loadItems = useCallback(async () => {
    setLoading(true); setSearchTerm('');
    try {
      const filtros = { itemGroup: selectedGroup || null, tipoItem: selectedTipo || null };
      let data = [];
      if (vistaActiva === 'registrado') data = await inventory.getProductosRegistrados(filtros);
      if (vistaActiva === 'deshabilitado') data = await inventory.getProductosDeshabilitados(filtros);
      setItems(data);
    } catch (err) { console.error('Error cargando inventario:', err); }
    finally { setLoading(false); }
  }, [vistaActiva, selectedGroup, selectedTipo]);

  const deleteModal  = useConfirmModal(
    (item) => inventory.deleteItem(item.item_code),
    { onSuccess: () => loadItems(), fallbackAction: (item) => inventory.disableItem(item.item_code) }
  );
  const disableModal = useConfirmModal(
    (item) => inventory.disableItem(item.item_code),
    { onSuccess: () => loadItems() }
  );
  const enableModal  = useConfirmModal(
    (item) => inventory.enableItem(item.item_code),
    { onSuccess: () => loadItems() }
  );

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

  useEffect(() => { loadItems(); }, [loadItems]);

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
                          onDelete={deleteModal.open} onDisable={disableModal.open} onEnable={enableModal.open} soloLectura={soloLectura} accionActiva={accionActiva} />
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
      {deleteModal.item && (
        <ConfirmModal
          title="Eliminar insumo"
          description={<>¿Seguro que deseas eliminar <strong>{deleteModal.item.item_name}</strong>?</>}
          subdescription="Esta acción es permanente y no se puede deshacer."
          icon={ICON_TRASH}
          confirmLabel="Sí, eliminar"
          loadingLabel="Eliminando..."
          onConfirm={deleteModal.confirm}
          onCancel={deleteModal.close}
          loading={deleteModal.loading}
          error={deleteModal.error}
          onFallback={deleteModal.confirmFallback}
          fallbackLabel="Sí, deshabilitar"
          fallbackLoadingLabel="Deshabilitando..."
          fallbackDescription={<>No se puede eliminar porque este insumo tiene movimientos registrados. ¿Deseas <strong>deshabilitarlo</strong> en su lugar?</>}
        />
      )}

      {/* Modal deshabilitar directo */}
      {disableModal.item && (
        <ConfirmModal
          title="Deshabilitar insumo"
          description={<>¿Seguro que deseas deshabilitar <strong>{disableModal.item.item_name}</strong>?</>}
          subdescription="El insumo no aparecerá para nuevas operaciones pero su historial se mantendrá intacto."
          icon={ICON_DISABLE}
          confirmLabel="Sí, deshabilitar"
          loadingLabel="Deshabilitando..."
          confirmClassName="del-btn-disable"
          onConfirm={disableModal.confirm}
          onCancel={disableModal.close}
          loading={disableModal.loading}
          error={disableModal.error}
        />
      )}

      {/* Modal habilitar directo */}
      {enableModal.item && (
        <ConfirmModal
          title="Restaurar insumo"
          description={<>¿Seguro que deseas restaurar <strong>{enableModal.item.item_name}</strong>?</>}
          subdescription="El insumo volverá a estar disponible para todas las operaciones y recetas."
          icon={ICON_ENABLE}
          iconStyle={{ background: '#dcfce7', color: '#16a34a', border: 'none' }}
          confirmLabel="Sí, restaurar"
          loadingLabel="Restaurando..."
          onConfirm={enableModal.confirm}
          onCancel={enableModal.close}
          loading={enableModal.loading}
          error={enableModal.error}
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