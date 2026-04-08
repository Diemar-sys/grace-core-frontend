// src/pages/Inventario.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import RegistroEntrada from '../components/RegistroEntrada';
import RegistroSalida from '../components/RegistroSalida';
import { inventory } from '../services/frappeInventory';
import { stockService } from '../services/frappeStock';
import '../styles/global.css';

const VISTAS = [
  { key: 'con_stock', label: 'EN STOCK', color: 'vista-stock' },
  { key: 'agotado', label: 'AGOTADOS', color: 'vista-agotado' },
  { key: 'por_almacen', label: 'POR ALMACÉN', color: 'vista-por-almacen' },
];

const COLUMNAS = {
  con_stock:   ['Codigo', 'Producto', 'Almacen', 'Stock Actual', 'Reservado', 'Disponible', 'Estado'],
  agotado:     ['Codigo Interno', 'Producto', 'Categoria', 'Departamento', 'UOM'],
  por_almacen: ['Codigo Interno', 'Producto', 'Categoria', 'Stock Actual', 'Reservado', 'Estado'],
};

const ALMACENES_ALL = [
  { name: "BODEGA CENTRAL - INSUMOS - PG", label: "BODEGA CENTRAL - INSUMOS" },
  ...stockService.getAlmacenesDepartamento(),
];

/**
 * Página de Inventario Principal.
 * Permite visualizar el stock actual, agotados, y el cruce por almacén.
 * Provee acciones rápidas para realizar Ajustes (Entradas) y Salidas (Transferencias/Mermas).
 * @returns {JSX.Element} Vista interactiva del inventario.
 */
function Inventario() {
  const [vistaActiva, setVistaActiva]       = useState("con_stock");
  const [items, setItems]                   = useState([]);
  const [warehouses, setWarehouses]         = useState([]);
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [itemGroups, setItemGroups]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedGroup, setSelectedGroup]   = useState("");
  const [searchTerm, setSearchTerm]         = useState("");
  const [almacenVista, setAlmacenVista]     = useState(ALMACENES_ALL[0].name);
  const [modalEntrada, setModalEntrada]     = useState(false);
  const [modalSalida, setModalSalida]       = useState(false);

  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  useEffect(() => {
    (async () => {
      try {
        const [whData, groupsData] = await Promise.all([
          inventory.getWarehouses(), inventory.getItemGroups(),
        ]);
        setWarehouses(whData); setItemGroups(groupsData);
      } catch (err) { console.error(err); }
    })();
  }, []);

  useEffect(() => { loadItems(); }, [vistaActiva, selectedWarehouse, selectedGroup, almacenVista]);

  const loadItems = async () => {
    setLoading(true); setSearchTerm("");
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
  };

  const handleVistaChange = (key) => { setVistaActiva(key); setSelectedWarehouse(""); setSelectedGroup(""); };
  const handleMovimientoSuccess = () => { setModalEntrada(false); setModalSalida(false); loadItems(); };

  const filtered = items.filter(item =>
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.custom_código_interno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.custom_departamento?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems    = filtered.length;
  const lowStockItems = vistaActiva === "con_stock" ? filtered.filter(i => (i.actual_qty || 0) < 10).length : null;

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {!soloLectura && accionActiva !== 'menu' && (
              <button 
                onClick={() => setAccionActiva('menu')}
                className="btn-refresh" 
                style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db', color: '#4b5563' }}
                title="Volver al menú de inventario"
              >
                ← Volver
              </button>
            )}
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

        {accionActiva === 'menu' ? (
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => setModalEntrada(true)}>
              <div className="module-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </div>
              <h3>Registrar Ajuste (+)</h3>
              <p>Incrementar stock</p>
            </button>
            <button className="panel-module" onClick={() => setModalSalida(true)}>
              <div className="module-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
              </div>
              <h3>Registrar Salida (-)</h3>
              <p>Mermas o traspasos</p>
            </button>
            {/*<button className="panel-module" onClick={() => setAccionActiva('consultar')}>
              <div className="module-icon" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <h3>Consultar Stock</h3>
              <p>Ver existencias y agotados</p>
            </button>*/}
          </div>
        ) : (
          <>
            <div className="vistas-tabs">
          {VISTAS.map(v => (
            <button key={v.key}
              className={`vista-tab ${v.color} ${vistaActiva === v.key ? "activa" : ""}`}
              onClick={() => handleVistaChange(v.key)}>{v.label}</button>
          ))}
        </div>

        <div className="filtros-section">
          {vistaActiva === "por_almacen" ? (
            <div className="filtro-group">
              <label>Almacen</label>
              <select value={almacenVista} onChange={e => setAlmacenVista(e.target.value)}>
                {ALMACENES_ALL.map(a => <option key={a.name} value={a.name}>{a.label}</option>)}
              </select>
            </div>
          ) : (
            <>
              {(vistaActiva === "con_stock" || vistaActiva === "agotado") && (
                <div className="filtro-group">
                  <label>Almacen</label>
                  <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    <option value="">Todos los almacenes</option>
                    {warehouses.map(wh => <option key={wh.name} value={wh.name}>{wh.warehouse_name}</option>)}
                  </select>
                </div>
              )}
              <div className="filtro-group">
                <label>Categoria</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                  <option value="">Todas las categorias</option>
                  {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="filtro-group search">
            <label>Buscar</label>
            <input type="text" placeholder="Nombre, codigo o codigo interno..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '4px' }}>
            <button className="btn-refresh" onClick={loadItems}>
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
                  filtered.map((item, i) => <FilaItem key={i} item={item} vista={vistaActiva} />)
                )}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
      </div>

      {modalEntrada && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && setModalEntrada(false)}>
          <div className="edit-modal-wrapper">
            <RegistroEntrada onSuccess={handleMovimientoSuccess} onCancel={() => setModalEntrada(false)} />
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
function FilaItem({ item, vista }) {
  if (vista === "con_stock" || vista === "por_almacen") {
    const actual = item.actual_qty || 0;
    const reserved = item.reserved_qty || 0;
    const available = actual - reserved;
    let statusClass = "status-ok", statusText = "OK";
    if (actual <= 0)  { statusClass = "status-out"; statusText = "AGOTADO"; }
    else if (actual < 10) { statusClass = "status-low"; statusText = "BAJO"; }

    if (vista === "por_almacen") return (
      <tr>
        <td className="cell-code">{item.custom_código_interno || item.custom_c_digo_interno || "—"}</td>
        <td className="cell-name">{item.item_name}</td>
        <td>{item.item_group || "—"}</td>
        <td className="cell-qty">{actual}</td>
        <td className="cell-qty reserved">{reserved}</td>
        <td><span className={`status-badge ${statusClass}`}>{statusText}</span></td>
      </tr>
    );

    return (
      <tr>
        <td className="cell-code">{item.item_code}</td>
        <td className="cell-name">{item.item_name}</td>
        <td>{item.warehouse || "—"}</td>
        <td className="cell-qty">{actual}</td>
        <td className="cell-qty reserved">{reserved}</td>
        <td className="cell-qty available">{available}</td>
        <td><span className={`status-badge ${statusClass}`}>{statusText}</span></td>
      </tr>
    );
  }

  if (vista === "agotado") return (
    <tr>
      <td className="cell-code">{item.custom_código_interno || "—"}</td>
      <td className="cell-name">{item.item_name}</td>
      <td>{item.item_group || "—"}</td>
      <td>{item.custom_departamento || "—"}</td>
      <td>{item.stock_uom || "—"}</td>
    </tr>
  );

  return null;
}

export default Inventario;