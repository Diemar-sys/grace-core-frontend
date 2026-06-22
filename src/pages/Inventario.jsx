// src/pages/Inventario.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ConteoFisico from '../components/ConteoFisico';
import RegistroSalida from '../components/RegistroSalida';
import RegistroMerma from '../components/RegistroMerma';
import HistorialMovimientos from '../components/HistorialMovimientos';
import { inventory } from '../services/frappeInventory';
import { stockService } from '../services/frappeStock';
import { fmtUom } from '../utils/uom';
import '../styles/global.css';

const VISTAS = [
  { key: 'con_stock', label: 'EN STOCK', color: 'vista-stock' },
  { key: 'agotado', label: 'AGOTADOS', color: 'vista-agotado' },
  { key: 'por_almacen', label: 'POR ALMACÉN', color: 'vista-por-almacen' },
];

const COLUMNAS = {
  con_stock:   ['Código', 'Cód. Interno', 'Nombre', 'Precio por Kg', 'Stock', 'Total'],
  agotado:     ['Código', 'Cód. Interno', 'Nombre', 'Precio por Kg', 'Stock', 'Total'],
  por_almacen: ['Código', 'Cód. Interno', 'Nombre', 'Precio por Kg', 'Stock', 'Total'],
};


/**
 * Página de Inventario Principal.
 * Permite visualizar el stock actual, agotados, y el cruce por almacén.
 * Provee acciones rápidas para realizar Ajustes (Entradas) y Salidas (Transferencias/Mermas).
 * @returns {JSX.Element} Vista interactiva del inventario.
 */
function Inventario() {
  const [vistaActiva, setVistaActiva] = useState("con_stock");
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [itemGroups, setItemGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState(stockService.getBodegaCentral());
  const [selectedGroup, setSelectedGroup] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [almacenesAll, setAlmacenesAll] = useState([]);
  const [almacenVista, setAlmacenVista] = useState(stockService.getBodegaCentral());
  const [modalConteo, setModalConteo]   = useState(false);
  const [modalSalida, setModalSalida] = useState(false);
  const [modalMerma, setModalMerma] = useState(false);

  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consulta_menu' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consulta_menu' : 'menu'); }, [soloLectura]);

  useEffect(() => {
    (async () => {
      try {
        const [whData, groupsData, allWh] = await Promise.all([
          inventory.getWarehouses(),
          inventory.getItemGroups(),
          stockService.fetchAllWarehousesInclusive(),
        ]);
        setWarehouses(whData);
        setItemGroups(groupsData);
        setAlmacenesAll(allWh);
      } catch (err) { console.error(err); }
    })();
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setSearchTerm("");
    try {
      if (vistaActiva === "por_almacen") {
        setItems(await stockService.getStockPorAlmacen(almacenVista));
      } else if (vistaActiva === "con_stock") {
        setItems(await inventory.getProductosConStock({ warehouse: selectedWarehouse || null, itemGroup: selectedGroup || null }));
      } else if (vistaActiva === "agotado") {
        setItems(await inventory.getProductosAgotados({ warehouse: selectedWarehouse || null, itemGroup: selectedGroup || null }));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [vistaActiva, selectedWarehouse, selectedGroup, almacenVista]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleVistaChange = (key) => { setVistaActiva(key); setSelectedWarehouse(""); setSelectedGroup(""); };
  const handleMovimientoSuccess = () => { setModalEntrada(false); setModalSalida(false); setModalMerma(false); loadItems(); };

  const filtered = items.filter(item =>
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.custom_código_interno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.custom_departamento?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = filtered.length;
  const lowStockItems = vistaActiva === "con_stock" ? filtered.filter(i => (i.actual_qty || 0) < 10).length : null;

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                Inventario
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginLeft: "10px" }}>
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
                </svg>
              </h1>
              <span className="header-subtitle" style={{ display: 'block', marginTop: '4px' }}>Productos, materiales o bienes de la compania</span>
            </div>
          </div>
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-number">{totalItems}</span>
              <span className="stat-label">Productos</span>
            </div>
            {lowStockItems !== null && (
              <div className="stat-card warning">
                <span className="stat-number">{lowStockItems}</span>
                <span className="stat-label">Stock Bajo</span>
              </div>
            )}
          </div>
        </div>

        {accionActiva === 'consulta_menu' ? (
          /* Consultas → Inventario: 2 tarjetas */
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => setAccionActiva('consultar')}>
              <div className="module-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
                </svg>
              </div>
              <h3>Stock de Inventario</h3>
              <p>Existencias actuales por almacén</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('historial')}>
              <div className="module-icon" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
                </svg>
              </div>
              <h3>Historial de Movimientos</h3>
              <p>Entradas, salidas y mermas por almacén</p>
            </button>
          </div>
        ) : accionActiva === 'menu' ? (
          /* Operaciones → Inventario: 3 acciones */
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => setModalConteo(true)}>
              <div className="module-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <h3>Conteo Físico</h3>
              <p>Ajuste por inventario real</p>
            </button>
            <button className="panel-module" onClick={() => setModalSalida(true)}>
              <div className="module-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </div>
              <h3>Transferir Salida (→)</h3>
              <p>Traspaso interno a otro almacén</p>
            </button>
            <button className="panel-module" onClick={() => setModalMerma(true)}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
              </div>
              <h3>Registrar Merma (-)</h3>
              <p>Pérdida permanente</p>
            </button>
          </div>
        ) : accionActiva === 'historial' ? (
          <HistorialMovimientos almacenes={almacenesAll} />
        ) : (
          <>
            <div className="filtros-section">
              <div className="filtro-group filtro-sm">
                <label>Vista</label>
                <select value={vistaActiva} onChange={e => handleVistaChange(e.target.value)}>
                  {VISTAS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                </select>
              </div>
              {vistaActiva === "por_almacen" ? (
                <div className="filtro-group filtro-sm">
                  <label>Almacen</label>
                  <select value={almacenVista} onChange={e => setAlmacenVista(e.target.value)}>
                    {almacenesAll.map(a => <option key={a.name} value={a.name}>{a.label}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  {(vistaActiva === "con_stock" || vistaActiva === "agotado") && (
                    <div className="filtro-group filtro-sm">
                      <label>Almacen</label>
                      <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                        <option value="">Todos los almacenes</option>
                        {warehouses.map(wh => <option key={wh.name} value={wh.name}>{wh.warehouse_name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="filtro-group filtro-sm">
                    <label>Categoria</label>
                    <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                      <option value="">Todas las categorias</option>
                      {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="filtro-group search filtro-sm">
                <label>Buscar</label>
                <input type="text" placeholder="Nombre, codigo o codigo interno..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>

              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <button className="btn-refresh btn-compacto" onClick={loadItems}>
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

            {loading ? <div className="loading">Cargando inventario...</div> : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>{COLUMNAS[vistaActiva].map(col => <th key={col}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={COLUMNAS[vistaActiva].length} className="no-data">No hay productos en esta vista</td></tr>
                    ) : (
                      filtered.map((item) => <FilaItem key={item.item_code} item={item} />)
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modalConteo && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && setModalConteo(false)}>
          <div className="edit-modal-wrapper">
            <ConteoFisico
              onSuccess={() => { setModalConteo(false); handleMovimientoSuccess(); }}
              onCancel={() => setModalConteo(false)}
            />
          </div>
        </div>
      )}
      {modalSalida && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && setModalSalida(false)}>
          <div className="edit-modal-wrapper">
            <RegistroSalida onSuccess={handleMovimientoSuccess} onCancel={() => setModalSalida(false)} />
          </div>
        </div>
      )}
      {modalMerma && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && setModalMerma(false)}>
          <div className="edit-modal-wrapper">
            <RegistroMerma onSuccess={handleMovimientoSuccess} onCancel={() => setModalMerma(false)} />
          </div>
        </div>
      )}
    </Layout>
  );
}

/**
 * Componente de Fila para la tabla dinámica de Inventario.
 * Adapta sus columnas dependiendo si la vista es por stock general, por almacén o agotados.
 *
 * @param {Object} props - Propiedades de la fila.
 * @param {Object} props.item - Datos del ítem de inventario.
 * @param {string} props.vista - Vista actual seleccionada en la UI.
 * @returns {JSX.Element|null} Celda <tr> con datos formateados.
 */
export function FilaItem({ item }) {
  // actual_qty ya viene en unidad base (stock_uom); la presentación se deriva dividiendo.
  const actual = parseFloat(item.actual_qty) || 0;
  const cantPres = parseFloat(item.custom_cantidad_por_presentación) || 0;
  const presentacion = item.custom_presentación || '';
  const uom = fmtUom(item.stock_uom || '');
  const totalStr = `${actual.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${uom}`;
  const enPresentacion = cantPres > 0 ? actual / cantPres : actual;
  const paqStr = cantPres > 0 && presentacion
    ? `${enPresentacion.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${presentacion}`
    : `${enPresentacion.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} emp.`;

  return (
    <tr>
      <td className="cell-code">{item.item_code || '—'}</td>
      <td className="cell-code" style={{ color: '#6b7280' }}>{item.custom_código_interno || '—'}</td>
      <td className="cell-name">{item.item_name}</td>
      <td>{item.custom_precio_final ? `$${parseFloat(item.custom_precio_final).toFixed(2)}` : '—'}</td>
      <td className="cell-qty">
        {actual > 0 ? (
          <span style={{ fontSize: '14px', color: '#6b7280' }}>{paqStr}</span>
        ) : (
          <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: 500 }}>Agotado</span>
        )}
      </td>
      <td className="cell-qty">
        <span style={{ fontWeight: 600 }}>{totalStr}</span>
      </td>
    </tr>
  );
}

export default Inventario;