// src/pages/Compras.jsx
import React from "react";
import Layout from "../components/Layout";
import ComprasModales from "../components/compras/ComprasModales";
import useCompras, { ESTADO_DOCSTATUS } from "../hooks/useCompras";
import { haceCuanto, nombreCorto } from "../utils/hora";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Columnas por vista. La clase viaja también en cada <td> para que el responsive
// esconda por CLASE y no por nth-child: el índice de una columna cambia según la vista.
const COLUMNAS = {
  facturas: [
    { k: 'no',        label: '# Factura' },
    { k: 'fecha',     label: 'Fecha',        cls: 'col-fecha' },
    { k: 'proveedor', label: 'Proveedor' },
    { k: 'facturado', label: 'Facturado a',  cls: 'col-facturado' },
    { k: 'subtotal',  label: 'Subtotal',     cls: 'col-subtotal' },
    { k: 'total',     label: 'Total' },
    { k: 'notas',     label: 'Notas',        cls: 'col-notas' },
    { k: 'pagado',    label: 'Pagado' },
    { k: 'acciones',  label: 'Acciones' },
  ],
  notas: [
    { k: 'no',        label: '# Compra' },
    { k: 'fecha',     label: 'Fecha',        cls: 'col-fecha' },
    { k: 'proveedor', label: 'Proveedor' },
    { k: 'facturado', label: 'Facturado a',  cls: 'col-facturado' },
    { k: 'subtotal',  label: 'Subtotal',     cls: 'col-subtotal' },
    { k: 'total',     label: 'Total' },
    { k: 'estado',    label: 'Estado',       cls: 'col-notas' },
    { k: 'pagado',    label: 'Pagado' },
    { k: 'acciones',  label: 'Acciones' },
  ],
  total: [
    { k: 'no',        label: '# Compra' },
    { k: 'fecha',     label: 'Fecha',        cls: 'col-fecha' },
    { k: 'proveedor', label: 'Proveedor' },
    { k: 'tipo',      label: 'Tipo' },
    { k: 'facturado', label: 'Facturado a',  cls: 'col-facturado' },
    { k: 'total',     label: 'Total' },
    { k: 'pagado',    label: 'Pagado' },
    { k: 'acciones',  label: 'Acciones' },
  ],
};

function Compras() {
  const {
    soloLectura, compras, loading,
    modal, setModal, borradorEditar,
    detalleModal, setDetalleModal, abrirDetalle, abrirDetalleEgreso, abrirDetalleGrupo,
    desde, setDesde, hasta, setHasta,
    searchTerm, setSearchTerm, facturadoSaving,
    estadoFiltro, setEstadoFiltro,
    pagoFiltro, setPagoFiltro,
    facturadoFiltro, setFacturadoFiltro,
    proveedorFiltro, setProveedorFiltro,
    vista, setVista, expandido, toggleExpand,
    accionActiva, setAccionActiva,
    seleccion, setSeleccion, toggleSel, sumaSel, esConsolidable,
    folioConsolidar, setFolioConsolidar,
    facturadoConsolidar, setFacturadoConsolidar,
    proveedoresUnicos, facturasAgrupadas, notasItems,
    totalItems, handleImprimirEgreso, deleteEgresoModal,
    deleteModal, cancelModal, pagoModal,
    consolidarModal, desagruparModal, cancelConsolidadoModal,
    cargar, handleEditar, handleFacturadoChange, handleFacturadoChangeGroup, handleImprimir,
    handleConfirmarBorrador, confirmando, handleModalSuccess, handleModalCancel,
    reimprimirConsolidado,
  } = useCompras();

  const columnas = COLUMNAS[vista] || COLUMNAS.facturas;
  // Egresos y Total no tienen Subtotal ni Notas/Estado: en tablet se recorta
  // "Facturado a" en su lugar (ver Compras.css).
  const vistaSimple = vista === 'total';

  return (
    <Layout>
      <div className="page-container comprasv2">

        {/* HEADER */}
        <div className="page-header">
          <div className="title-group" style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>Compras</h1>
            <span className="header-subtitle">Registro de recepciones de mercancia por proveedor</span>
          </div>
        </div>

        {accionActiva === 'menu' ? (
          <div className="panel-grid" style={{ padding: '20px 0' }}>
            <button className="panel-module" onClick={() => setModal('nueva')}>
              <div className="panel-module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </div>
              <h3>Registrar Compra</h3>
              <p>Capturar mercancía recibida</p>
            </button>
            <button className="panel-module" onClick={() => { setAccionActiva('editar'); setEstadoFiltro('en_espera'); setVista('notas'); }}>
              <div className="panel-module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Borrador</h3>
              <p>Modificar compras pendientes</p>
            </button>
            <button className="panel-module" onClick={() => { setAccionActiva('confirmar'); setEstadoFiltro('en_espera'); setVista('notas'); }}>
              <div className="panel-module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3>Confirmar Borrador</h3>
              <p>Procesar definitivamente</p>
            </button>
            <button className="panel-module" onClick={() => { setAccionActiva('eliminar'); setEstadoFiltro('en_espera'); setVista('notas'); }}>
              <div className="panel-module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              </div>
              <h3>Eliminar Borrador</h3>
              <p>Descartar compras erradas</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('cancelar')}>
              <div className="panel-module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3>Cancelar Compra</h3>
              <p>Revertir error en cantidades</p>
            </button>
          </div>
        ) : (
          <>
            {/* FILTROS */}
            <div className="filtros-section">
              <div className="filtro-group filtro-sm">
                <label>Vista</label>
                <select className="comp-date-input" value={vista} onChange={e => setVista(e.target.value)}>
                  <option value="facturas">Facturas ({facturasAgrupadas.length})</option>
                  <option value="notas">Notas ({notasItems.length})</option>
                  {/* La lista de egresos vive en Consultas → Egresos. Aquí solo queda
                      "Total", que es lo único que Compras aporta: la secuencia completa
                      de folios (el consecutivo #compra es compartido con los egresos). */}
                  <option value="total">Total ({totalItems.length})</option>
                </select>
              </div>
              {/* El Egreso no tiene docstatus → el filtro Estado no aplica a esas vistas
                  (y quitarlo es lo que hace caber los filtros en un renglón). */}
              {!vistaSimple && (
                <div className="filtro-group filtro-sm">
                  <label>Estado</label>
                  <select className="comp-date-input" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
                    <option value="recibida">Recibida ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.recibida).length})</option>
                    <option value="en_espera">En espera ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.en_espera).length})</option>
                    <option value="cancelada">Cancelada ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.cancelada).length})</option>
                    <option value="todas">Todas ({compras.length})</option>
                  </select>
                </div>
              )}
              <div className="filtro-group filtro-sm">
                <label>Facturas</label>
                <select className="comp-date-input" value={pagoFiltro} onChange={e => setPagoFiltro(e.target.value)}>
                  <option value="todas">Todas ({compras.filter(c => c.docstatus === 1).length})</option>
                  <option value="pendientes">Por pagar ({compras.filter(c => c.docstatus === 1 && !c.custom_pagado).length})</option>
                  <option value="pagadas">Pagadas ({compras.filter(c => c.docstatus === 1 && c.custom_pagado).length})</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Facturado a</label>
                <select className="comp-date-input" value={facturadoFiltro} onChange={e => setFacturadoFiltro(e.target.value)}>
                  <option value="todas">Todas</option>
                  <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
                  <option value="LUIS TORRES">Luis Torres</option>
                  <option value="SIN FACTURA">Sin factura</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Proveedor</label>
                <select className="comp-date-input" value={proveedorFiltro} onChange={e => setProveedorFiltro(e.target.value)}>
                  <option value="todas">Todos</option>
                  {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Desde</label>
                <input type="date" className="comp-date-input" value={desde} onChange={e => setDesde(e.target.value)} />
              </div>
              <div className="filtro-group filtro-sm">
                <label>Hasta</label>
                <input type="date" className="comp-date-input" value={hasta} onChange={e => setHasta(e.target.value)} />
              </div>
              <div className="filtro-group search filtro-sm">
                <label>Buscar proveedor / #</label>
                <input type="text" placeholder="Ej: LASTUR, #001" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <button className="btn-refresh btn-compacto" onClick={() => cargar()}>
                  Actualizar
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ marginLeft: "6px", verticalAlign: "middle" }}>
                    <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Barra ticket consolidado */}
            {vista === 'notas' && seleccion.length > 0 && (
              <div className="comp-consol-bar">
                <span>
                  {seleccion.length} nota(s) de <strong>{seleccion[0].supplier_name || seleccion[0].supplier}</strong>
                  {' · '}<strong>${fmt(sumaSel)}</strong>
                </span>
                <div className="comp-consol-actions">
                  <button className="comp-btn-editar" onClick={() => setSeleccion([])}>Limpiar</button>
                  <button className="comp-btn-confirmar" onClick={() => { setFolioConsolidar(''); setFacturadoConsolidar('SIN FACTURA'); consolidarModal.open(seleccion); }}>Agrupar e imprimir</button>
                </div>
              </div>
            )}

            {/* TABLA */}
            {loading ? (
              <div className="loading">Cargando compras...</div>
            ) : (
              <div className="table-container">
                <table className={`sys-table${vistaSimple ? ' vista-simple' : ''}`}>
                  <thead>
                    <tr>
                      {columnas.map(c => <th key={c.k} className={c.cls}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {vista === 'facturas' ? (
                      facturasAgrupadas.length === 0 ? (
                        <tr><td colSpan={columnas.length} className="no-data">No hay facturas registradas</td></tr>
                      ) : (
                        facturasAgrupadas.map(g => {
                          const abierto = expandido.has(g.key);
                          const multi   = g.esConsolidacion && g.notas.length > 1;
                          // Notas que un pago en cascada sí puede tocar: confirmadas y sin pagar.
                          const pendientes = g.notas.filter(n => !n.custom_pagado && n.docstatus === 1);
                          const yaPagadas  = g.notas.filter(n => n.custom_pagado && n.docstatus === 1);
                          return (
                            <React.Fragment key={g.key}>
                              <tr className={multi ? 'comp-row-grupo' : undefined}
                                onClick={g.esConsolidacion ? () => abrirDetalleGrupo(g) : () => abrirDetalle(g.notas[0].name)}
                                style={{ cursor: 'pointer' }}>
                                <td className="cell-code">
                                  {g.folio || '(sin folio)'}
                                  {g.esConsolidacion && (
                                    /* El click en la fila abre el detalle completo; este botón
                                       sigue sirviendo para ver los renglones sin salir de la lista. */
                                    <button className="comp-expand-btn"
                                      onClick={ev => { ev.stopPropagation(); toggleExpand(g.key); }}
                                      title={abierto ? 'Contraer notas' : 'Ver notas en la lista'}>
                                      {abierto ? '▾' : '▸'}
                                    </button>
                                  )}
                                </td>
                                <td className="col-fecha">{g.posting_date}</td>
                                <td className="comp-td-proveedor" title={g.supplier_name || g.supplier}>{g.supplier_name || g.supplier}</td>
                                <td className="col-facturado">
                                  {(g.cancelada || g.notas.every(n => n.custom_pagado))
                                    ? <span className={(g.facturado_a && g.facturado_a !== 'SIN FACTURA') ? 'comp-facturado-badge' : 'comp-sinfactura-badge'}
                                        title="Pagada — facturado bloqueado">
                                        {g.facturado_a || 'SIN FACTURA'}
                                      </span>
                                    : <select className="comp-facturado-select"
                                        disabled={g.notas.some(n => facturadoSaving === n.name)}
                                        value={g.facturado_a || 'SIN FACTURA'}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => handleFacturadoChangeGroup(g.notas, e.target.value)}>
                                        <option value="SIN FACTURA">SIN FACTURA</option>
                                        <option value="ALMA RODRIGUEZ">ALMA RODRIGUEZ</option>
                                        <option value="LUIS TORRES">LUIS TORRES</option>
                                      </select>}
                                </td>
                                <td className="cell-right col-subtotal">${fmt(g.total)}</td>
                                <td className="cell-right cell-bold">${fmt(g.grand_total)}</td>
                                <td className="col-notas" style={{ textAlign: 'center' }}>{g.esConsolidacion ? g.notas.length : '—'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  {g.cancelada ? (
                                    <span className="status-badge status-cancelled">Cancelada</span>
                                  ) : (!g.esConsolidacion && !g.notas[0]?.custom_pagado) ? (
                                    <span
                                      className="status-badge status-low"
                                      style={{ cursor: 'pointer', userSelect: 'none' }}
                                      title="Marcar como pagada"
                                      onClick={e => { e.stopPropagation(); pagoModal.open({ name: g.notas[0].name, value: 1, compra: g.notas[0] }); }}
                                    >
                                      {`${g.pagadas}/${g.activas}`}
                                    </span>
                                  ) : (g.esConsolidacion && pendientes.length) ? (
                                    /* Una factura se paga completa: marca de un golpe sus notas pendientes. */
                                    <span
                                      className="status-badge status-low"
                                      style={{ cursor: 'pointer', userSelect: 'none' }}
                                      title={`Marcar las ${pendientes.length} nota(s) pendientes como pagadas`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        pagoModal.open({ names: pendientes.map(n => n.name), value: 1, folio: g.folio });
                                      }}
                                    >
                                      {`${g.pagadas}/${g.activas}`}
                                    </span>
                                  ) : (
                                    /* Ya pagada: el mismo badge la revierte. Marcarla por error no
                                       dejaba salida y habia que ir a la consola de Frappe. */
                                    <span
                                      className={`status-badge ${g.pagadas === g.activas ? 'status-ok' : g.pagadas === 0 ? 'status-low' : 'status-cancelled'}`}
                                      style={{ cursor: 'pointer', userSelect: 'none' }}
                                      title="Marcar de nuevo como pendiente de pago"
                                      onClick={e => {
                                        e.stopPropagation();
                                        pagoModal.open(g.esConsolidacion
                                          ? { names: yaPagadas.map(n => n.name), value: 0, folio: g.folio }
                                          : { name: g.notas[0].name, value: 0, compra: g.notas[0] });
                                      }}
                                    >
                                      {g.pagadas === g.activas ? 'Pagada' : `${g.pagadas}/${g.activas}`}
                                    </span>
                                  )}
                                </td>
                                <td className="comp-td-acciones">
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {g.esConsolidacion ? (
                                      <button className="comp-btn-confirmar"
                                        onClick={e => { e.stopPropagation(); reimprimirConsolidado(g); }}
                                        title="Imprimir ticket consolidado"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                        Ticket
                                      </button>
                                    ) : accionActiva !== 'cancelar' ? (
                                      <>
                                        <button className="comp-btn-editar" onClick={e => { e.stopPropagation(); handleImprimir(g.notas[0].name, 'pdf'); }} title="Imprimir PDF detallado">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        </button>
                                        <button className="comp-btn-editar" onClick={e => { e.stopPropagation(); handleImprimir(g.notas[0].name, 'ticket'); }} title="Imprimir Ticket">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                        </button>
                                      </>
                                    ) : null}
                                    {/* Editar/confirmar/eliminar borrador desde la vista Facturas.
                                        Solo para borradores no consolidados (docstatus 0, 1 sola nota):
                                        una factura consolidada agrupa varias notas y no se edita como una. */}
                                    {!soloLectura && !g.esConsolidacion && g.notas[0]?.docstatus === 0 && (
                                      <>
                                        {accionActiva === 'confirmar' && (
                                          <button className="comp-btn-confirmar" disabled={confirmando.has(g.notas[0].name)} onClick={e => { e.stopPropagation(); handleConfirmarBorrador(g.notas[0].name); }} title="Confirmar compra">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                          </button>
                                        )}
                                        {accionActiva === 'editar' && (
                                          <button className="comp-btn-editar" onClick={e => { e.stopPropagation(); handleEditar(g.notas[0].name); }} title="Editar compra">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
                                          </button>
                                        )}
                                        {accionActiva === 'eliminar' && (
                                          <button className="comp-btn-eliminar" onClick={e => { e.stopPropagation(); deleteModal.open(g.notas[0].name); }} title="Eliminar borrador">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {!soloLectura && accionActiva === 'cancelar' && (
                                      <button className="comp-btn-eliminar"
                                        onClick={e => { e.stopPropagation(); g.esConsolidacion ? cancelConsolidadoModal.open(g) : cancelModal.open(g.notas[0]); }}
                                        title={g.esConsolidacion ? 'Cancelar grupo en cascada' : 'Cancelar compra'}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {g.esConsolidacion && abierto && g.notas.map(n => (
                                <tr key={n.name} className="comp-subrow" onClick={() => abrirDetalle(n.name)} style={{ cursor: 'pointer' }}>
                                  <td className="cell-code" style={{ paddingLeft: 28 }}>{n.custom_no_de_compra ? `#${n.custom_no_de_compra}` : '—'}</td>
                                  <td className="col-fecha">{n.posting_date}</td>
                                  <td>{n.custom_nota_remision || '—'}</td>
                                  <td className="col-facturado"></td>
                                  <td className="cell-right col-subtotal">${fmt(n.total)}</td>
                                  <td className="cell-right">${fmt(n.grand_total)}</td>
                                  {/* celdas sueltas (no colSpan) para que ocultar col-notas no descuadre la fila */}
                                  <td className="col-notas"></td>
                                  <td></td>
                                  <td></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      )
                    ) : vista === 'total' ? (
                      totalItems.length === 0 ? (
                        <tr><td colSpan={columnas.length} className="no-data">No hay movimientos en el rango</td></tr>
                      ) : (
                        totalItems.map(it => (
                          <tr key={(it.esGasto ? 'g-' : 'c-') + it.key}
                            onClick={() => it.esGasto ? abrirDetalleEgreso(it.key) : abrirDetalle(it.key)}
                            style={{ cursor: 'pointer' }}>
                            <td className="cell-code">{it.no ? `#${it.no}` : '—'}</td>
                            <td className="col-fecha">{it.fecha}</td>
                            <td className="comp-td-proveedor" title={it.proveedor}>{it.proveedor}</td>
                            <td>
                              <span className={`comp-tipo-badge ${it.esGasto ? 'es-gasto' : 'es-compra'}`}>
                                {it.esGasto ? 'GASTO' : 'COMPRA'}
                              </span>
                            </td>
                            <td className="col-facturado">
                              <span className={(it.facturado_a && it.facturado_a !== 'SIN FACTURA') ? 'comp-facturado-badge' : 'comp-sinfactura-badge'}>
                                {it.facturado_a}
                              </span>
                            </td>
                            <td className="cell-right cell-bold">${fmt(it.total)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-badge ${it.pagado ? 'status-ok' : 'status-low'}`}>
                                {it.pagado ? 'Pagada' : 'Por pagar'}
                              </span>
                            </td>
                            <td className="comp-td-acciones" onClick={ev => ev.stopPropagation()}>
                              <button className="comp-btn-editar" title="Imprimir ticket"
                                onClick={() => it.esGasto ? handleImprimirEgreso(it.raw) : handleImprimir(it.raw.name, 'ticket')}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    ) : (() => {
                      const fila = (c) => (
                        <tr key={c.name} onClick={() => abrirDetalle(c.name)} style={{ cursor: 'pointer' }}>
                          <td className="cell-code">
                            {c.custom_consolidado ? (
                              <input type="checkbox" className="comp-sel" checked readOnly disabled title="Consolidada (bloqueada)" />
                            ) : esConsolidable(c) ? (
                              /* Una factura consolidada es de UN proveedor: marcar una nota
                                 de otro descarta la selección anterior. Se atenúa para que
                                 el cambio no parezca un check que se apaga solo. */
                              <input type="checkbox"
                                className={`comp-sel${seleccion.length > 0 && seleccion[0].supplier !== c.supplier ? ' comp-sel--otro' : ''}`}
                                checked={seleccion.some(x => x.name === c.name)}
                                onChange={() => toggleSel(c)}
                                onClick={e => e.stopPropagation()}
                                title={seleccion.length > 0 && seleccion[0].supplier !== c.supplier
                                  ? `Es de ${c.supplier_name || c.supplier}. Al marcarla se descarta lo seleccionado de ${seleccion[0].supplier_name || seleccion[0].supplier} — una factura agrupa un solo proveedor.`
                                  : 'Seleccionar para ticket consolidado'} />
                            ) : null}
                            {c.custom_no_de_compra ? `#${c.custom_no_de_compra}` : '—'}
                            {!!c.custom_consolidado && <span className="comp-consol-badge" title="Consolidada">🔒</span>}
                          </td>
                          <td className="col-fecha">{c.posting_date}</td>
                          <td className="comp-td-proveedor" title={c.supplier_name || c.supplier}>{c.supplier_name || c.supplier}</td>
                          <td className="col-facturado">
                            {(soloLectura || c.custom_pagado)
                              ? <span className={(c.custom_facturado_a && c.custom_facturado_a !== 'SIN FACTURA') ? 'comp-facturado-badge' : 'comp-sinfactura-badge'}
                                  title={c.custom_pagado ? 'Pagada — facturado bloqueado' : undefined}>{c.custom_facturado_a || 'SIN FACTURA'}</span>
                              : <select className="comp-facturado-select" value={c.custom_facturado_a || 'SIN FACTURA'}
                                  disabled={facturadoSaving === c.name}
                                  onChange={e => handleFacturadoChange(c.name, e.target.value)}>
                                  <option value="SIN FACTURA">SIN FACTURA</option>
                                  <option value="ALMA RODRIGUEZ">ALMA RODRIGUEZ</option>
                                  <option value="LUIS TORRES">LUIS TORRES</option>
                                </select>}
                          </td>
                          <td className="cell-right col-subtotal">${fmt(c.total)}</td>
                          <td className="cell-right cell-bold">${fmt(c.grand_total)}</td>
                          <td className="col-notas">
                            <span className={`status-badge ${c.docstatus === 0 ? 'status-low' : c.docstatus === 2 ? 'status-cancelled' : 'status-ok'}`}>
                              {c.docstatus === 0 ? 'En Espera' : c.docstatus === 2 ? 'Cancelada' : 'Recibida'}
                            </span>
                            {/* De quién es el borrador y desde cuándo: sin esto, una lista
                                de borradores ajenos no se puede distinguir de la propia. */}
                            {c.docstatus === 0 && c.owner && (
                              <small className="comp-borrador-owner">
                                {nombreCorto(c.owner)} · {haceCuanto(c.modified)}
                              </small>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={!!c.custom_pagado}
                              disabled={c.docstatus !== 1 || pagoModal.loading}
                              onChange={() => pagoModal.open({ name: c.name, value: c.custom_pagado ? 0 : 1, compra: c })}
                              title={c.custom_pagado ? 'Pagada — desmarca para volverla a pendiente' : 'Pendiente de pago'}
                              style={{ width: 18, height: 18, cursor: c.docstatus === 1 ? 'pointer' : 'not-allowed' }} />
                          </td>
                          <td className="comp-td-acciones">
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {accionActiva !== 'cancelar' && (
                                <>
                                  <button className="comp-btn-editar" onClick={() => handleImprimir(c.name, 'pdf')} title="Imprimir PDF detallado">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  </button>
                                  <button className="comp-btn-editar" onClick={() => handleImprimir(c.name, 'ticket')} title="Imprimir Ticket">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                  </button>
                                </>
                              )}
                              {!soloLectura && (
                                <>
                                  {!!c.custom_consolidado && (
                                    <button className="comp-btn-eliminar" onClick={() => desagruparModal.open(c.name)} title="Desagrupar (solo Gerente)">Desagrupar</button>
                                  )}
                                  {c.docstatus === 0 && (
                                    <>
                                      {accionActiva === 'confirmar' && (
                                        <button className="comp-btn-confirmar" disabled={confirmando.has(c.name)} onClick={() => handleConfirmarBorrador(c.name)} title="Confirmar compra">
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
                                    <button className="comp-btn-eliminar" onClick={() => cancelModal.open(c)} title="Cancelar compra">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );

                      if (notasItems.length === 0)
                        return <tr><td colSpan={columnas.length} className="no-data">No hay compras registradas</td></tr>;

                      return notasItems.map(it => {
                        if (it.tipo !== 'grupo') return fila(it.compra);
                        const g = it.grupo, ek = 'ng-' + g.key, ab = expandido.has(ek);
                        const pendientes = g.notas.filter(n => !n.custom_pagado && n.docstatus === 1);
                        const yaPagadas  = g.notas.filter(n => n.custom_pagado && n.docstatus === 1);
                        return (
                          <React.Fragment key={ek}>
                            <tr className="comp-row-grupo" onClick={() => abrirDetalleGrupo(g)} style={{ cursor: 'pointer' }}>
                              <td className="cell-code">
                                {g.folio || '(sin folio)'} <span className="comp-consol-badge" title="Notas consolidadas">🔒 {g.notas.length}</span>
                                <button className="comp-expand-btn"
                                  onClick={ev => { ev.stopPropagation(); toggleExpand(ek); }}
                                  title={ab ? 'Contraer notas' : 'Ver notas en la lista'}>
                                  {ab ? '▾' : '▸'}
                                </button>
                              </td>
                              <td className="col-fecha">{g.posting_date}</td>
                              <td className="comp-td-proveedor" title={g.supplier_name || g.supplier}>{g.supplier_name || g.supplier}</td>
                              <td className="col-facturado">
                                {g.notas.every(n => n.custom_pagado)
                                  ? <span className={(g.facturado_a && g.facturado_a !== 'SIN FACTURA') ? 'comp-facturado-badge' : 'comp-sinfactura-badge'}>
                                      {g.facturado_a || 'SIN FACTURA'}
                                    </span>
                                  : <select className="comp-facturado-select"
                                      disabled={g.notas.some(n => facturadoSaving === n.name)}
                                      value={g.facturado_a || 'SIN FACTURA'}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => handleFacturadoChangeGroup(g.notas, e.target.value)}>
                                      <option value="SIN FACTURA">SIN FACTURA</option>
                                      <option value="ALMA RODRIGUEZ">ALMA RODRIGUEZ</option>
                                      <option value="LUIS TORRES">LUIS TORRES</option>
                                    </select>}
                              </td>
                              <td className="cell-right col-subtotal">${fmt(g.total)}</td>
                              <td className="cell-right cell-bold">${fmt(g.grand_total)}</td>
                              <td className="col-notas"><span className="status-badge status-ok">Recibida</span></td>
                              <td style={{ textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                                {pendientes.length ? (
                                  <span
                                    className={`status-badge ${g.pagadas === 0 ? 'status-low' : 'status-cancelled'}`}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                    title={`Marcar las ${pendientes.length} nota(s) pendientes como pagadas`}
                                    onClick={() => pagoModal.open({ names: pendientes.map(n => n.name), value: 1, folio: g.folio })}
                                  >
                                    {`${g.pagadas}/${g.notas.length}`}
                                  </span>
                                ) : (
                                  <span className="status-badge status-ok"
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                    title={`Marcar las ${yaPagadas.length} nota(s) como pendientes de pago`}
                                    onClick={() => pagoModal.open({ names: yaPagadas.map(n => n.name), value: 0, folio: g.folio })}
                                  >Pagada</span>
                                )}
                              </td>
                              <td className="comp-td-acciones">
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button className="comp-btn-confirmar"
                                    onClick={e => { e.stopPropagation(); reimprimirConsolidado(g); }}
                                    title="Imprimir ticket consolidado"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                    Ticket
                                  </button>
                                  {!soloLectura && accionActiva === 'cancelar' && (
                                    <button className="comp-btn-eliminar"
                                      onClick={e => { e.stopPropagation(); cancelConsolidadoModal.open(g); }}
                                      title="Cancelar grupo en cascada">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {ab && g.notas.map(fila)}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <ComprasModales
        modal={modal}
        borradorEditar={borradorEditar}
        handleModalSuccess={handleModalSuccess}
        handleModalCancel={handleModalCancel}
        deleteModal={deleteModal}
        deleteEgresoModal={deleteEgresoModal}
        cancelModal={cancelModal}
        pagoModal={pagoModal}
        consolidarModal={consolidarModal}
        desagruparModal={desagruparModal}
        cancelConsolidadoModal={cancelConsolidadoModal}
        folioConsolidar={folioConsolidar}
        setFolioConsolidar={setFolioConsolidar}
        facturadoConsolidar={facturadoConsolidar}
        setFacturadoConsolidar={setFacturadoConsolidar}
        detalleModal={detalleModal}
        setDetalleModal={setDetalleModal}
      />
    </Layout>
  );
}

export default Compras;
