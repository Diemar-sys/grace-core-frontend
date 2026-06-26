// src/pages/Compras.jsx
import React from "react";
import Layout from "../components/Layout";
import ComprasModales from "../components/compras/ComprasModales";
import useCompras, { ESTADO_DOCSTATUS } from "../hooks/useCompras";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Compras() {
  const {
    soloLectura, compras, loading,
    modal, setModal, borradorEditar,
    detalleModal, setDetalleModal, abrirDetalle,
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
    proveedoresUnicos, filteredCompras, facturasAgrupadas, notasItems,
    deleteModal, cancelModal, pagoModal,
    consolidarModal, desagruparModal, cancelConsolidadoModal,
    cargar, handleEditar, handleFacturadoChange, handleFacturadoChangeGroup, handleImprimir,
    handleConfirmarBorrador, handleModalSuccess, handleModalCancel,
    reimprimirConsolidado,
  } = useCompras();

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
              <div className="module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </div>
              <h3>Registrar Compra</h3>
              <p>Capturar mercancía recibida</p>
            </button>
            <button className="panel-module" onClick={() => { setAccionActiva('editar'); setEstadoFiltro('en_espera'); }}>
              <div className="module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
              </div>
              <h3>Editar Borrador</h3>
              <p>Modificar compras pendientes</p>
            </button>
            <button className="panel-module" onClick={() => { setAccionActiva('confirmar'); setEstadoFiltro('en_espera'); }}>
              <div className="module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3>Confirmar Borrador</h3>
              <p>Procesar definitivamente</p>
            </button>
            <button className="panel-module" onClick={() => { setAccionActiva('eliminar'); setEstadoFiltro('en_espera'); }}>
              <div className="module-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              </div>
              <h3>Eliminar Borrador</h3>
              <p>Descartar compras erradas</p>
            </button>
            <button className="panel-module" onClick={() => setAccionActiva('cancelar')}>
              <div className="module-icon">
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
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Estado</label>
                <select className="comp-date-input" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
                  <option value="recibida">Recibida ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.recibida).length})</option>
                  <option value="en_espera">En espera ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.en_espera).length})</option>
                  <option value="cancelada">Cancelada ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.cancelada).length})</option>
                  <option value="todas">Todas ({compras.length})</option>
                </select>
              </div>
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
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th>{vista === 'facturas' ? '# Factura' : '# Compra'}</th>
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th>Facturado a</th>
                      <th>Subtotal</th>
                      <th>Total</th>
                      <th>{vista === 'facturas' ? 'Notas' : 'Estado'}</th>
                      <th>Pagado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista === 'facturas' ? (
                      facturasAgrupadas.length === 0 ? (
                        <tr><td colSpan={9} className="no-data">No hay facturas registradas</td></tr>
                      ) : (
                        facturasAgrupadas.map(g => {
                          const abierto = expandido.has(g.key);
                          const multi   = g.esConsolidacion && g.notas.length > 1;
                          return (
                            <React.Fragment key={g.key}>
                              <tr className={multi ? 'comp-row-grupo' : undefined}
                                onClick={g.esConsolidacion ? () => toggleExpand(g.key) : () => abrirDetalle(g.notas[0].name)}
                                style={{ cursor: 'pointer' }}>
                                <td className="cell-code">
                                  {g.folio || '(sin folio)'}
                                </td>
                                <td>{g.posting_date}</td>
                                <td className="comp-td-proveedor">{g.supplier_name || g.supplier}</td>
                                <td>
                                  {g.notas.every(n => n.custom_pagado)
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
                                <td className="cell-right">${fmt(g.total)}</td>
                                <td className="cell-right cell-bold">${fmt(g.grand_total)}</td>
                                <td style={{ textAlign: 'center' }}>{g.esConsolidacion ? g.notas.length : '—'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  {(!g.esConsolidacion && !g.notas[0]?.custom_pagado) ? (
                                    <span
                                      className="status-badge status-low"
                                      style={{ cursor: 'pointer', userSelect: 'none' }}
                                      title="Marcar como pagada"
                                      onClick={e => { e.stopPropagation(); pagoModal.open({ name: g.notas[0].name, value: 1, compra: g.notas[0] }); }}
                                    >
                                      {`${g.pagadas}/${g.notas.length}`}
                                    </span>
                                  ) : (
                                    <span className={`status-badge ${g.pagadas === g.notas.length ? 'status-ok' : g.pagadas === 0 ? 'status-low' : 'status-cancelled'}`}>
                                      {g.pagadas === g.notas.length ? 'Pagada' : `${g.pagadas}/${g.notas.length}`}
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
                                  <td>{n.posting_date}</td>
                                  <td>{n.custom_nota_remision || '—'}</td>
                                  <td></td>
                                  <td className="cell-right">${fmt(n.total)}</td>
                                  <td className="cell-right">${fmt(n.grand_total)}</td>
                                  <td colSpan={3}></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      )
                    ) : (() => {
                      const fila = (c) => (
                        <tr key={c.name} onClick={() => abrirDetalle(c.name)} style={{ cursor: 'pointer' }}>
                          <td className="cell-code">
                            {c.custom_consolidado ? (
                              <input type="checkbox" className="comp-sel" checked readOnly disabled title="Consolidada (bloqueada)" />
                            ) : esConsolidable(c) ? (
                              <input type="checkbox" className="comp-sel"
                                checked={seleccion.some(x => x.name === c.name)}
                                onChange={() => toggleSel(c)}
                                onClick={e => e.stopPropagation()}
                                title="Seleccionar para ticket consolidado" />
                            ) : null}
                            {c.custom_no_de_compra ? `#${c.custom_no_de_compra}` : '—'}
                            {!!c.custom_consolidado && <span className="comp-consol-badge" title="Consolidada">🔒</span>}
                          </td>
                          <td>{c.posting_date}</td>
                          <td className="comp-td-proveedor">{c.supplier_name || c.supplier}</td>
                          <td>
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
                          <td className="cell-right">${fmt(c.total)}</td>
                          <td className="cell-right cell-bold">${fmt(c.grand_total)}</td>
                          <td>
                            <span className={`status-badge ${c.docstatus === 0 ? 'status-low' : c.docstatus === 2 ? 'status-cancelled' : 'status-ok'}`}>
                              {c.docstatus === 0 ? 'En Espera' : c.docstatus === 2 ? 'Cancelada' : 'Recibida'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={!!c.custom_pagado}
                              disabled={c.docstatus !== 1 || c.custom_pagado || pagoModal.loading}
                              onChange={() => pagoModal.open({ name: c.name, value: c.custom_pagado ? 0 : 1, compra: c })}
                              title={c.custom_pagado ? 'Pagada (bloqueada)' : 'Pendiente de pago'}
                              style={{ width: 18, height: 18, cursor: (c.docstatus === 1 && !c.custom_pagado) ? 'pointer' : 'not-allowed' }} />
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
                                        <button className="comp-btn-confirmar" onClick={() => handleConfirmarBorrador(c.name)} title="Confirmar compra">
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
                        return <tr><td colSpan={9} className="no-data">No hay compras registradas</td></tr>;

                      return notasItems.map(it => {
                        if (it.tipo !== 'grupo') return fila(it.compra);
                        const g = it.grupo, ek = 'ng-' + g.key, ab = expandido.has(ek);
                        return (
                          <React.Fragment key={ek}>
                            <tr className="comp-row-grupo" onClick={() => toggleExpand(ek)} style={{ cursor: 'pointer' }}>
                              <td className="cell-code">
                                {g.folio || '(sin folio)'} <span className="comp-consol-badge" title="Notas consolidadas">🔒 {g.notas.length}</span>
                              </td>
                              <td>{g.posting_date}</td>
                              <td className="comp-td-proveedor">{g.supplier_name || g.supplier}</td>
                              <td>
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
                              <td className="cell-right">${fmt(g.total)}</td>
                              <td className="cell-right cell-bold">${fmt(g.grand_total)}</td>
                              <td><span className="status-badge status-ok">Recibida</span></td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`status-badge ${g.pagadas === g.notas.length ? 'status-ok' : g.pagadas === 0 ? 'status-low' : 'status-cancelled'}`}>
                                  {g.pagadas === g.notas.length ? 'Pagada' : `${g.pagadas}/${g.notas.length}`}
                                </span>
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
