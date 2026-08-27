// src/pages/Catalogo.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NuevoInsumo from '../components/NuevoInsumo';
import NuevoPan from '../components/NuevoPan';
import ConfirmModal from '../components/modals/ConfirmModal';
import { inventory } from '../services/frappeInventory';
import { produccionService } from '../services/frappeProduccion';
import useConfirmModal from '../hooks/useConfirmModal';
import { calcularMargen, categoriasDePanes, filtrarPanes } from '../utils/catalogoUtils';
export { calcularMargen, categoriasDePanes, filtrarPanes };
import { VistaPan } from '../components/catalogo/VistaPan';
import { FilaItem } from '../components/catalogo/FilaItem';
import '../styles/global.css';
import '../styles/Panel.css';
import '../styles/CatalogoPan.css';

const VISTAS = [
  { key: 'registrado', label: 'REGISTRADOS', color: 'vista-registrado' },
  { key: 'deshabilitado', label: 'DESHABILITADOS', color: 'vista-deshabilitado' },
];
const COLUMNAS = {
  registrado:    ['Código', 'Código Interno', 'Producto', 'Cantidad por presentación', 'Total', 'Precio por Unidad', 'Costo MP', 'Stock', 'Acciones'],
  deshabilitado: ['Código', 'Código Interno', 'Producto', 'Cantidad por presentación', 'Total', 'Precio por Unidad', 'Costo MP', 'Stock', 'Acciones'],
};

// Cuántos panes se costean de golpe. La categoría más grande (PASTELES) tiene 33,
// así que 40 cubre cualquier filtro por categoría sin disparar 227 peticiones.
// Vivía al final del archivo y se quedó fuera al partir la pantalla en componentes.
const LIMITE_COSTEO_PAN = 40;

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

const ICON_INSUMOS = (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" />
    <path d="M2 4h20v4H2z" /><path d="M10 12h4" />
  </svg>
);

const ICON_PAN = (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 13c0-4 3.6-6 8-6s8 2 8 6v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M9 9.5 7.5 12" /><path d="M12.5 9.2 11 11.7" /><path d="M16 9.5 14.5 12" />
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
  const [costosBOM, setCostosBOM] = useState({});

  // Pestaña Pan: catálogo aparte porque el pan se registra distinto (no tiene
  // presentación ni precio de compra, y sí tres precios de venta).
  const [pestana, setPestana] = useState('insumos');
  const [panes, setPanes] = useState([]);
  const [panesLoading, setPanesLoading] = useState(false);
  const [panModal, setPanModal] = useState(false);
  const [editPan, setEditPan] = useState(null);
  // Viven aquí y no en VistaPan para que el contador de arriba baje al filtrar,
  // igual que hace el de Insumos con `filtered`.
  const [panGrupo, setPanGrupo] = useState('');
  const [panBusca, setPanBusca] = useState('');
  const [costosPan, setCostosPan] = useState({});

  const abortRef = useRef(null);

  const loadItems = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true); setSearchTerm('');
    try {
      const filtros = { itemGroup: selectedGroup || null, tipoItem: selectedTipo || null };
      let data = [];
      if (vistaActiva === 'registrado') data = await inventory.getProductosRegistrados(filtros, signal);
      if (vistaActiva === 'deshabilitado') data = await inventory.getProductosDeshabilitados(filtros, signal);
      // El pan tiene su propia pestaña, con sus tres precios y su costo de receta.
      // Aquí estorbaba: 227 panes sin presentación ni precio de compra diluían los
      // insumos, que es lo que esta vista sirve para administrar.
      // ponytail: se descarta en el cliente porque `get_inventory_view` filtra por
      // UN tipo exacto y excluir uno pediría cambiar el endpoint.
      setItems(data.filter(i => i.custom_tipo_item !== 'PRODUCTO TERMINADO'));
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Error cargando inventario:', err);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
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

  useEffect(() => {
    loadItems();
    return () => abortRef.current?.abort();
  }, [loadItems]);

  useEffect(() => {
    const ptCodes = items
      .filter(it => it.custom_tipo_item === 'PRODUCTO TERMINADO')
      .map(it => it.item_code);
    if (!ptCodes.length) { setCostosBOM({}); return; }
    let cancel = false;
    produccionService.calcularCostosBOMBatch(ptCodes)
      .then(mapa => { if (!cancel) setCostosBOM(mapa); })
      .catch(err => console.error('Error calculando costos BOM:', err));
    return () => { cancel = true; };
  }, [items]);

  // El costo del pan sale de su receta, no de un campo capturado a mano: si hay
  // BOM activo, ese número es el bueno. Pero cada costeo son 3 peticiones
  // (BOM, detalle, precios), así que con los 227 panes serían ~680 de golpe.
  // Se costea solo lo que está a la vista y solo cuando la lista está filtrada
  // a un tamaño sano — la categoría más grande (PASTELES) tiene 33.
  // ponytail: el arreglo de fondo es que la receta guarde su costo en el Item al
  // activarse (un hook de backend, un campo, cero peticiones). Esto lo cubre
  // mientras tanto sin tocar el servidor.
  const panesVisibles = filtrarPanes(panes, panGrupo, panBusca);
  const costeable = panesVisibles.length > 0 && panesVisibles.length <= LIMITE_COSTEO_PAN;
  const codigosACostear = costeable ? panesVisibles.map(p => p.item_code).join(',') : '';

  useEffect(() => {
    if (!codigosACostear) { setCostosPan({}); return; }
    let cancel = false;
    produccionService.calcularCostosBOMBatch(codigosACostear.split(','))
      .then(mapa => { if (!cancel) setCostosPan(mapa); })
      .catch(err => console.error('Error calculando costos BOM del pan:', err));
    return () => { cancel = true; };
  }, [codigosACostear]);

  const loadPanes = useCallback(async () => {
    setPanesLoading(true);
    try {
      setPanes(await inventory.getProductosRegistrados({ tipoItem: 'PRODUCTO TERMINADO' }));
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Error cargando panes:', err);
    } finally {
      setPanesLoading(false);
    }
  }, []);

  // Se cargan al entrar, no al abrir la pestaña: el conteo va en el propio
  // segmento, y un "Pan" sin número no dice si hay algo que ver ahí.
  useEffect(() => { loadPanes(); }, [loadPanes]);

  const handleNuevoPan = () => { setEditPan(null); setPanModal(true); };
  const handlePanClose = () => { setPanModal(false); setEditPan(null); };
  const handlePanSuccess = () => { handlePanClose(); loadPanes(); };
  const handleEditPan = async (itemCode) => {
    setEditLoading(true);
    try {
      setEditPan(await inventory.getItemCompleto(itemCode));
      setPanModal(true);
    } catch (err) { console.error('Error cargando pan:', err); }
    finally { setEditLoading(false); }
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
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>
                {pestana === 'pan'
                  ? 'El pan que se produce y sus precios por canal'
                  : 'Gestión centralizada de insumos y existencias'}
              </span>
            </div>
          </div>

          {/* Control segmentado: dos vistas de la MISMA página, no dos botones
              sueltos. La pista hundida las agrupa y la píldora blanca dice
              cuál estás viendo sin tener que leer. */}
          <div className="cat-switch" role="tablist" aria-label="Vista del catálogo">
            <button type="button" role="tab" aria-selected={pestana === 'insumos'}
              className={`cat-switch-op ${pestana === 'insumos' ? 'is-active' : ''}`}
              onClick={() => setPestana('insumos')}>
              {ICON_INSUMOS}
              <span>Insumos</span>
              <em>{filtered.length}</em>
            </button>
            <button type="button" role="tab" aria-selected={pestana === 'pan'}
              className={`cat-switch-op ${pestana === 'pan' ? 'is-active' : ''}`}
              onClick={() => setPestana('pan')}>
              {ICON_PAN}
              <span>Pan</span>
              <em>{panes.length}</em>
            </button>
          </div>

          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">
                {pestana === 'pan' ? filtrarPanes(panes, panGrupo, panBusca).length : filtered.length}
              </span>
              <span className="stat-label">{pestana === 'pan' ? 'Panes' : 'Productos'}</span>
            </div>
          </div>
        </div>

        {pestana === 'pan' ? (
          <VistaPan
            panes={panes} loading={panesLoading} soloLectura={soloLectura}
            onNuevo={handleNuevoPan} onEdit={handleEditPan} editLoading={editLoading}
            onRefrescar={loadPanes}
            grupo={panGrupo} setGrupo={setPanGrupo}
            busca={panBusca} setBusca={setPanBusca}
            costosPan={costosPan} costeado={costeable}
          />
        ) : accionActiva === 'menu' ? (
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => handleNuevo()}>
              <div className="panel-module-icon" style={{ '--mod-bg': '#e0f2fe', '--mod-color': '#0284c7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              </div>
              <h3>Crear Insumo</h3>
              <p>Registrar nuevo producto</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('editar')}>
              <div className="panel-module-icon" style={{ '--mod-bg': '#fef3c7', '--mod-color': '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Insumo</h3>
              <p>Modificar detalles o stock</p>
            </button>
            <button className="panel-module" onClick={() => { setVistaActiva('registrado'); setAccionActiva('deshabilitar'); }}>
              <div className="panel-module-icon" style={{ '--mod-bg': '#fee2e2', '--mod-color': '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
              </div>
              <h3>Deshabilitar</h3>
              <p>Pausar uso de un insumo</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('eliminar')}>
              <div className="panel-module-icon" style={{ '--mod-bg': '#f3f4f6', '--mod-color': '#4b5563' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
              </div>
              <h3>Eliminar</h3>
              <p>Borrar permanentemente</p>
            </button>
          </div>
        ) : (
          <>
            <div className="filtros-section">
              <div className="filtro-group filtro-sm">
                <label>Vista</label>
                <select value={vistaActiva} onChange={e => handleVistaChange(e.target.value)}>
                  {VISTAS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Categoría</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {/* Solo hojas: un departamento (PAN DULCE) no tiene items
                      propios, filtrar por él devolvería una lista vacía. */}
                  {itemGroups.filter(g => !g.is_group)
                    .map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Tipo de Item</label>
                <select value={selectedTipo} onChange={e => setSelectedTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  <option value="MATERIA PRIMA">Materia Prima</option>
                  <option value="INSUMO GENERAL">Insumo General</option>
                  {/* Producto Terminado no se ofrece: es la pestaña Pan. Dejarlo
                      aquí devolvía una lista vacía y parecía que el filtro fallaba. */}
                </select>
              </div>
              <div className="filtro-group search filtro-sm">
                <label>Buscar</label>
                <input type="text" placeholder="Nombre, código o código interno..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <button className="btn-refresh btn-compacto" onClick={loadItems}>
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
                      : filtered.map((item) => (
                        <FilaItem key={item.item_code} item={item} vista={vistaActiva}
                          onEdit={handleEdit} editLoading={editLoading}
                          onDelete={deleteModal.open} onDisable={disableModal.open} onEnable={enableModal.open} soloLectura={soloLectura} accionActiva={accionActiva}
                          costoBOM={costosBOM[item.item_code]} />
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal pan */}
      {panModal && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && handlePanClose()}>
          <div className="edit-modal-wrapper">
            <NuevoPan editItem={editPan} onSuccess={handlePanSuccess} onCancel={handlePanClose} />
          </div>
        </div>
      )}

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

export default Catalogo;