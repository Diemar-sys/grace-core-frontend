// src/pages/Compras.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import NuevaCompra from "../components/NuevaCompra";
import BuscadorProveedor from "../components/compras/BuscadorProveedor";
import ConfirmModal from "../components/modals/ConfirmModal";
import { comprasService } from "../services/frappePurchase";
import useConfirmModal from "../hooks/useConfirmModal";
import { docToDatosImpresion, imprimirCompraPDF, imprimirCompraTicket, imprimirTicketConsolidado } from "../utils/print/comprasPrint";
import "../styles/global.css";
import "../styles/Compras.css";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO_DOCSTATUS = { recibida: 1, en_espera: 0, cancelada: 2 };

const ICON_TRASH = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const ICON_WARNING = (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

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
  const [facturadoSaving, setFacturadoSaving] = useState(null);

  const [estadoFiltro, setEstadoFiltro] = useState('recibida');
  const [pagoFiltro, setPagoFiltro] = useState('todas'); // 'todas' | 'pagadas' | 'pendientes'
  const [facturadoFiltro, setFacturadoFiltro] = useState('todas'); // 'todas' | cuenta fiscal
  const [proveedorFiltro, setProveedorFiltro] = useState('todas'); // 'todas' | supplier_name
  const [vista, setVista] = useState('facturas'); // default: Facturas (tipo=Factura + grupos consolidados)
  const [expandido, setExpandido] = useState(() => new Set()); // facturas con su dropdown de notas abierto
  const toggleExpand = (key) => setExpandido(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  // Selección para ticket consolidado (notas/remisiones de UN proveedor).
  const [seleccion, setSeleccion] = useState([]);
  const toggleSel = (c) => setSeleccion(prev => {
    if (c.custom_consolidado) return prev; // ya bloqueada, no se selecciona
    if (prev.some(x => x.name === c.name)) return prev.filter(x => x.name !== c.name);
    if (prev.length && prev[0].supplier !== c.supplier) return [c]; // distinto proveedor → reinicia
    return [...prev, c];
  });
  const sumaSel = seleccion.reduce((s, c) => s + parseFloat(c.grand_total || 0), 0);
  // Consolidable: tipo Nota (sin consolidar). El No. de Factura se captura al agrupar,
  // no por nota, así no se repite el folio en cada captura.
  const esConsolidable = (c) => c.custom_tipo_comprobante === 'Nota';
  const [folioConsolidar, setFolioConsolidar] = useState('');

  // useCallback: el linter puede verificar dependencias. AbortSignal se recibe como
  // argumento para que el useEffect controle su ciclo de vida de forma explícita.
  const cargar = useCallback(async (signal) => {
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
  }, [desde, hasta]);

  const deleteModal = useConfirmModal(
    (name) => comprasService.eliminarBorrador(name),
    { onSuccess: () => cargar() }
  );
  const cancelModal = useConfirmModal(
    (compra) => comprasService.cancelarCompra(compra.name),
    { onSuccess: () => cargar() }
  );
  const pagoModal = useConfirmModal(
    ({ name, value }) => comprasService.updatePagado(name, value),
    { onSuccess: () => cargar() }
  );
  // Consolidar: bloquea las notas seleccionadas y luego imprime el ticket.
  const consolidarModal = useConfirmModal(
    async (sel) => {
      const folio = folioConsolidar.trim();
      if (!folio) throw new Error('Captura el No. de Factura para agrupar.');
      await comprasService.consolidarCompras(sel.map(c => c.name), folio);
      const proveedor = sel[0].supplier_name || sel[0].supplier;
      const notas = sel.map(c => ({
        no_compra: c.custom_no_de_compra, remision: c.custom_nota_remision,
        fecha: c.posting_date, total: c.grand_total,
      }));
      await imprimirTicketConsolidado(proveedor, folio, notas);
    },
    { onSuccess: () => { setSeleccion([]); setFolioConsolidar(''); cargar(); } }
  );
  // Desagrupar: desbloquea una compra consolidada (solo Gerente, validado server-side).
  const desagruparModal = useConfirmModal(
    (name) => comprasService.desconsolidarCompra(name),
    { onSuccess: () => cargar() }
  );
  // Cancelar en cascada: cancela todas las notas del grupo consolidado (revierte stock c/u).
  const cancelConsolidadoModal = useConfirmModal(
    (g) => comprasService.cancelarConsolidado(g.notas.map(c => c.name)),
    { onSuccess: () => cargar() }
  );

  // AbortController: cancela el fetch si el componente se desmonta o las fechas cambian.
  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const handleEditar = async (name) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      setBorradorEditar(doc);
      setModal('editar');
    } catch (err) {
      console.error(err);
    }
  };

  // Re-etiqueta el responsable fiscal de una compra (funciona aun confirmada:
  // el custom field tiene allow_on_submit=1). Update optimista + revierte si falla.
  const handleFacturadoChange = async (name, value) => {
    const prev = compras;
    setCompras(cs => cs.map(c => c.name === name ? { ...c, custom_facturado_a: value } : c));
    setFacturadoSaving(name);
    try {
      await comprasService.updateFacturadoA(name, value);
    } catch (err) {
      console.error(err);
      setCompras(prev);  // revertir
      alert('No se pudo actualizar el responsable fiscal: ' + (err?.message || 'error'));
    } finally {
      setFacturadoSaving(null);
    }
  };

  const handleImprimir = async (name, modo) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      const datos = docToDatosImpresion(doc);

      // Enriquecer con custom_cantidad_por_presentación del catálogo
      // (el PR de ERPNext no guarda ese campo en sus items)
      if (datos.filas?.length) {
        const codes = [...new Set(datos.filas.map(f => f.item_code).filter(Boolean))];
        const catItems = await comprasService.getItemsCatalogo(codes);
        const catMap = {};
        catItems.forEach(it => { catMap[it.item_code] = it; });
        datos.filas = datos.filas.map(f => ({
          ...f,
          kg_por_bulto: String(catMap[f.item_code]?.custom_cantidad_por_presentación || ''),
          uom: f.uom || catMap[f.item_code]?.stock_uom || '',
        }));
      }

      if (modo === 'ticket') imprimirCompraTicket(datos);
      else imprimirCompraPDF(datos);
    } catch (err) {
      console.error('Error imprimiendo compra:', err);
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


  const handleModalSuccess = () => {
    setModal(null);
    setBorradorEditar(null);
    cargar();
  };

  const handleModalCancel = () => {
    setModal(null);
    setBorradorEditar(null);
  };

  // Proveedores distintos para el dropdown (de las compras cargadas)
  const proveedoresUnicos = [...new Set(compras.map(c => c.supplier_name).filter(Boolean))].sort();

  // Vista "Facturas": colapsa notas consolidadas en 1 fila por (proveedor + No. Factura).
  // Facturas individuales salen 1 c/u; notas sueltas y sin factura se ocultan.
  const reimprimirConsolidado = (g) =>
    imprimirTicketConsolidado(g.supplier_name || g.supplier, g.folio, g.notas.map(c => ({
      no_compra: c.custom_no_de_compra, remision: c.custom_nota_remision,
      fecha: c.posting_date, total: c.grand_total,
    })));

  // Filtrado local en vivo (igual que Catálogo / Proveedores)
  const filteredCompras = compras.filter(c => {
    if (estadoFiltro !== 'todas' && c.docstatus !== ESTADO_DOCSTATUS[estadoFiltro]) return false;
    if (pagoFiltro === 'pagadas'    && !c.custom_pagado) return false;
    if (pagoFiltro === 'pendientes' &&  c.custom_pagado) return false;
    if (facturadoFiltro !== 'todas' && (c.custom_facturado_a || 'SIN FACTURA') !== facturadoFiltro) return false;
    if (proveedorFiltro !== 'todas' && c.supplier_name !== proveedorFiltro) return false;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const supName = (c.supplier_name || '').toLowerCase();
    const supId = (c.supplier || '').toLowerCase();
    const noCompra = String(c.custom_no_de_compra ?? '').toLowerCase();
    const termNum = term.replace(/^#/, ''); // permite buscar "#34" o "34"
    return supName.includes(term) || supId.includes(term) || noCompra.includes(termNum);
  });

  const facturasAgrupadas = (() => {
    const grupos = new Map();
    for (const c of filteredCompras) {
      const esConsolidada = !!(c.custom_consolidado && c.custom_tipo_comprobante === 'Nota');
      const esFactura = c.custom_tipo_comprobante === 'Factura';
      if (!esConsolidada && !esFactura) continue; // notas sueltas → fuera
      const folio = c.supplier_delivery_note || '';
      if (esConsolidada && !folio) continue; // nota consolidada sin factura → solo en vista Notas
      const key = c.supplier + '|' + (folio || c.name);
      const g = grupos.get(key) || {
        key, supplier: c.supplier, supplier_name: c.supplier_name, folio,
        facturado_a: c.custom_facturado_a, total: 0, grand_total: 0,
        posting_date: c.posting_date, pagadas: 0, notas: [], esConsolidacion: false,
      };
      g.total += parseFloat(c.total || 0);
      g.grand_total += parseFloat(c.grand_total || 0);
      if ((c.posting_date || '') > (g.posting_date || '')) g.posting_date = c.posting_date;
      if (c.custom_pagado) g.pagadas += 1;
      g.esConsolidacion = g.esConsolidacion || esConsolidada; // grupo real de notas vs factura directa
      g.notas.push(c);
      grupos.set(key, g);
    }
    return [...grupos.values()].sort((a, b) => (b.posting_date || '').localeCompare(a.posting_date || ''));
  })();

  // Vista Notas: notas consolidadas plegadas bajo su factura; el resto individual.
  // El grupo aparece en la posición de su 1ª nota (orden por # desc de filteredCompras).
  const notasItems = (() => {
    const grupos = new Map();
    const items = [];
    for (const c of filteredCompras) {
      const consolidada = c.custom_consolidado && c.custom_tipo_comprobante === 'Nota';
      if (!consolidada) {
        if (c.custom_tipo_comprobante === 'Factura') continue; // factura directa → vista Facturas
        items.push({ tipo: 'individual', compra: c });
        continue;
      }
      const folio = c.supplier_delivery_note || '';
      const key = c.supplier + '|' + (folio || c.name);
      let g = grupos.get(key);
      if (!g) {
        g = { key, supplier: c.supplier, supplier_name: c.supplier_name, folio,
          facturado_a: c.custom_facturado_a, total: 0, grand_total: 0,
          posting_date: c.posting_date, pagadas: 0, notas: [] };
        grupos.set(key, g);
        items.push({ tipo: 'grupo', grupo: g });
      }
      g.total += parseFloat(c.total || 0);
      g.grand_total += parseFloat(c.grand_total || 0);
      if ((c.posting_date || '') > (g.posting_date || '')) g.posting_date = c.posting_date;
      if (c.custom_pagado) g.pagadas += 1;
      g.notas.push(c);
    }
    return items;
  })();

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
              <div className="filtro-group filtro-sm">
                <label>Vista</label>
                <select className="comp-date-input" value={vista}
                  onChange={e => setVista(e.target.value)}>
                  <option value="facturas">Facturas ({facturasAgrupadas.length})</option>
                  <option value="notas">Notas ({notasItems.length})</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Estado</label>
                <select className="comp-date-input" value={estadoFiltro}
                  onChange={e => setEstadoFiltro(e.target.value)}>
                  <option value="recibida">Recibida ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.recibida).length})</option>
                  <option value="en_espera">En espera ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.en_espera).length})</option>
                  <option value="cancelada">Cancelada ({compras.filter(c => c.docstatus === ESTADO_DOCSTATUS.cancelada).length})</option>
                  <option value="todas">Todas ({compras.length})</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Facturas</label>
                <select className="comp-date-input" value={pagoFiltro}
                  onChange={e => setPagoFiltro(e.target.value)}>
                  <option value="todas">Todas ({compras.filter(c => c.docstatus === 1).length})</option>
                  <option value="pendientes">Por pagar ({compras.filter(c => c.docstatus === 1 && !c.custom_pagado).length})</option>
                  <option value="pagadas">Pagadas ({compras.filter(c => c.docstatus === 1 && c.custom_pagado).length})</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Facturado a</label>
                <select className="comp-date-input" value={facturadoFiltro}
                  onChange={e => setFacturadoFiltro(e.target.value)}>
                  <option value="todas">Todas</option>
                  <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
                  <option value="LUIS TORRES">Luis Torres</option>
                  <option value="SIN FACTURA">Sin factura</option>
                </select>
              </div>
              <div className="filtro-group filtro-sm">
                <label>Proveedor</label>
                <select className="comp-date-input" value={proveedorFiltro}
                  onChange={e => setProveedorFiltro(e.target.value)}>
                  <option value="todas">Todos</option>
                  {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
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
                <label>Buscar proveedor / #</label>
                <input type="text" placeholder="Ej: LASTUR, #001"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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

            {/* Barra de ticket consolidado (notas de un proveedor) */}
            {vista === 'notas' && seleccion.length > 0 && (
              <div className="comp-consol-bar">
                <span>
                  {seleccion.length} nota(s) de <strong>{seleccion[0].supplier_name || seleccion[0].supplier}</strong>
                  {' · '}<strong>${fmt(sumaSel)}</strong>
                </span>
                <div className="comp-consol-actions">
                  <button className="comp-btn-editar" onClick={() => setSeleccion([])}>Limpiar</button>
                  <button className="comp-btn-confirmar" onClick={() => { setFolioConsolidar(''); consolidarModal.open(seleccion); }}>Agrupar e imprimir</button>
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
                          const multi = g.esConsolidacion && g.notas.length > 1;
                          return (
                          <React.Fragment key={g.key}>
                          <tr className={multi ? 'comp-row-grupo' : undefined}>
                            <td className="cell-code">
                              {multi && (
                                <button className="comp-expand-btn" onClick={() => toggleExpand(g.key)}
                                  title={abierto ? 'Ocultar notas' : 'Ver notas'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 6, color: 'inherit', fontSize: '0.85em' }}>
                                  {abierto ? '▾' : '▸'}
                                </button>
                              )}
                              {g.folio || '(sin folio)'}
                            </td>
                            <td>{g.posting_date}</td>
                            <td className="comp-td-proveedor">{g.supplier_name || g.supplier}</td>
                            <td>
                              <span className={(g.facturado_a && g.facturado_a !== 'SIN FACTURA') ? 'comp-facturado-badge' : 'comp-sinfactura-badge'}>
                                {g.facturado_a || 'SIN FACTURA'}
                              </span>
                            </td>
                            <td className="cell-right">${fmt(g.total)}</td>
                            <td className="cell-right cell-bold">${fmt(g.grand_total)}</td>
                            <td style={{ textAlign: 'center' }}>{g.esConsolidacion ? g.notas.length : '—'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-badge ${g.pagadas === g.notas.length ? 'status-ok' : g.pagadas === 0 ? 'status-low' : 'status-cancelled'}`}>
                                {g.pagadas === g.notas.length ? 'Pagada' : `${g.pagadas}/${g.notas.length}`}
                              </span>
                            </td>
                            <td className="comp-td-acciones">
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {g.esConsolidacion ? (
                                  <button className="comp-btn-confirmar" onClick={() => reimprimirConsolidado(g)}
                                    title="Imprimir ticket consolidado"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                    Ticket
                                  </button>
                                ) : (
                                  <>
                                    <button className="comp-btn-editar" onClick={() => handleImprimir(g.notas[0].name, 'pdf')} title="Imprimir PDF detallado">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </button>
                                    <button className="comp-btn-editar" onClick={() => handleImprimir(g.notas[0].name, 'ticket')} title="Imprimir Ticket">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                    </button>
                                  </>
                                )}
                                {!soloLectura && accionActiva === 'cancelar' && (
                                  <button className="comp-btn-eliminar"
                                    onClick={() => g.esConsolidacion ? cancelConsolidadoModal.open(g) : cancelModal.open(g.notas[0])}
                                    title={g.esConsolidacion ? 'Cancelar grupo en cascada' : 'Cancelar compra'}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {g.esConsolidacion && abierto && g.notas.map(n => (
                            <tr key={n.name} className="comp-subrow">
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
                        <tr key={c.name}>
                          <td className="cell-code">
                            {c.custom_consolidado ? (
                              <input type="checkbox" className="comp-sel"
                                checked readOnly disabled
                                title="Consolidada (bloqueada)" />
                            ) : esConsolidable(c) ? (
                              <input type="checkbox" className="comp-sel"
                                checked={seleccion.some(x => x.name === c.name)}
                                onChange={() => toggleSel(c)}
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
                            <span className={`status-badge ${c.docstatus === 0 ? 'status-low' :
                                c.docstatus === 2 ? 'status-cancelled' :
                                  'status-ok'
                              }`}>
                              {c.docstatus === 0 ? 'En Espera' : c.docstatus === 2 ? 'Cancelada' : 'Recibida'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={!!c.custom_pagado}
                              disabled={c.docstatus !== 1 || c.custom_pagado || pagoModal.loading}
                              onChange={() => pagoModal.open({ name: c.name, value: c.custom_pagado ? 0 : 1, compra: c })}
                              title={c.custom_pagado ? 'Pagada (bloqueada, no se puede revertir)' : 'Pendiente de pago'}
                              style={{ width: 18, height: 18, cursor: (c.docstatus === 1 && !c.custom_pagado) ? 'pointer' : 'not-allowed' }} />
                          </td>
                          <td className="comp-td-acciones">
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {/* Imprimir PDF + Ticket — ocultos en modo cancelar */}
                              {accionActiva !== 'cancelar' && (
                                <>
                              <button className="comp-btn-editar" onClick={() => handleImprimir(c.name, 'pdf')}
                                title="Imprimir PDF detallado">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              </button>
                              <button className="comp-btn-editar" onClick={() => handleImprimir(c.name, 'ticket')}
                                title="Imprimir Ticket">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                              </button>
                                </>
                              )}
                              {!soloLectura && (
                                <>
                                {!!c.custom_consolidado && (
                                  <button className="comp-btn-eliminar" onClick={() => desagruparModal.open(c.name)}
                                    title="Desagrupar (solo Gerente)">Desagrupar</button>
                                )}
                                {c.docstatus === 0 && (
                                  <>
                                    {accionActiva === 'confirmar' && (
                                      <button className="comp-btn-confirmar" onClick={() => handleConfirmarBorrador(c.name)}
                                        title="Confirmar compra">
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
                                  <button className="comp-btn-eliminar" onClick={() => cancelModal.open(c)}
                                    title="Cancelar compra">
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
                            <tr className="comp-row-grupo">
                              <td className="cell-code">
                                <button className="comp-expand-btn" onClick={() => toggleExpand(ek)}
                                  title={ab ? 'Ocultar notas' : 'Ver notas'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 6, color: 'inherit', fontSize: '0.85em' }}>
                                  {ab ? '▾' : '▸'}
                                </button>
                                {g.folio || '(sin folio)'} <span className="comp-consol-badge" title="Notas consolidadas">🔒 {g.notas.length}</span>
                              </td>
                              <td>{g.posting_date}</td>
                              <td className="comp-td-proveedor">{g.supplier_name || g.supplier}</td>
                              <td>
                                <span className={(g.facturado_a && g.facturado_a !== 'SIN FACTURA') ? 'comp-facturado-badge' : 'comp-sinfactura-badge'}>
                                  {g.facturado_a || 'SIN FACTURA'}
                                </span>
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
                                  <button className="comp-btn-confirmar" onClick={() => reimprimirConsolidado(g)} title="Imprimir ticket consolidado"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M3 9h18"/><path d="M5 9v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/></svg>
                                    Ticket
                                  </button>
                                  {!soloLectura && accionActiva === 'cancelar' && (
                                    <button className="comp-btn-eliminar" onClick={() => cancelConsolidadoModal.open(g)} title="Cancelar grupo en cascada">
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
      {deleteModal.item && (
        <ConfirmModal
          title="Eliminar borrador"
          description={<>¿Seguro que deseas eliminar la compra <strong>{deleteModal.item}</strong>?</>}
          subdescription="Esta acción es permanente y no se puede deshacer."
          icon={ICON_TRASH}
          confirmLabel="Sí, eliminar"
          loadingLabel="Eliminando..."
          onConfirm={deleteModal.confirm}
          onCancel={deleteModal.close}
          loading={deleteModal.loading}
          error={deleteModal.error}
        />
      )}

      {/* Modal cancelar compra confirmada */}
      {cancelModal.item && (
        <ConfirmModal
          title={`Cancelar compra ${cancelModal.item?.custom_no_de_compra ? `#${cancelModal.item.custom_no_de_compra}` : cancelModal.item?.name}`}
          description={<>El stock recibido en esta compra será <strong>revertido automáticamente</strong>. La compra quedará en historial como cancelada.</>}
          subdescription="Después podrás registrar una nueva compra con las cantidades correctas."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar compra"
          loadingLabel="Cancelando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Regresar"
          onConfirm={cancelModal.confirm}
          onCancel={cancelModal.close}
          loading={cancelModal.loading}
          error={cancelModal.error}
        />
      )}

      {/* Modal cancelar grupo consolidado EN CASCADA */}
      {cancelConsolidadoModal.item && (
        <ConfirmModal
          title={`Cancelar grupo ${cancelConsolidadoModal.item.folio || ''}`}
          description={<>Se cancelarán <strong>las {cancelConsolidadoModal.item.notas.length} nota(s)</strong> de este grupo consolidado y se <strong>revertirá el stock de cada una</strong>. Quedarán en historial como canceladas.</>}
          subdescription="La cancelación es en cascada e irreversible."
          icon={ICON_WARNING}
          confirmLabel="Sí, cancelar todo el grupo"
          loadingLabel="Cancelando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Regresar"
          onConfirm={cancelConsolidadoModal.confirm}
          onCancel={cancelConsolidadoModal.close}
          loading={cancelConsolidadoModal.loading}
          error={cancelConsolidadoModal.error}
        />
      )}

      {/* Modal marcar pagada / pendiente */}
      {pagoModal.item && (
        <ConfirmModal
          title={pagoModal.item.value ? 'Marcar como PAGADA' : 'Marcar como PENDIENTE'}
          description={pagoModal.item.value
            ? <>¿Confirmas que la compra <strong>{pagoModal.item.compra?.custom_no_de_compra ? `#${pagoModal.item.compra.custom_no_de_compra}` : pagoModal.item.name}</strong> ya fue <strong>pagada</strong> al proveedor?</>
            : <>La compra <strong>{pagoModal.item.compra?.custom_no_de_compra ? `#${pagoModal.item.compra.custom_no_de_compra}` : pagoModal.item.name}</strong> volverá a quedar como <strong>pendiente de pago</strong>.</>}
          icon={ICON_WARNING}
          confirmLabel={pagoModal.item.value ? 'Sí, ya se pagó' : 'Sí, dejar pendiente'}
          loadingLabel="Guardando..."
          confirmStyle={{ background: pagoModal.item.value ? '#16a34a' : '#d97706' }}
          cancelLabel="Cancelar"
          onConfirm={pagoModal.confirm}
          onCancel={pagoModal.close}
          loading={pagoModal.loading}
          error={pagoModal.error}
        />
      )}

      {/* Modal consolidar (bloquea + imprime) */}
      {consolidarModal.item && (
        <ConfirmModal
          title="Agrupar e imprimir"
          description={<>
            Se agruparán <strong>{consolidarModal.item.length} nota(s)</strong> de <strong>{consolidarModal.item[0]?.supplier_name || consolidarModal.item[0]?.supplier}</strong> (${fmt(consolidarModal.item.reduce((s, c) => s + parseFloat(c.grand_total || 0), 0))}) bajo un mismo No. de Factura:
            <input type="text" autoFocus className="comp-date-input" style={{ display: 'block', width: '100%', marginTop: 10 }}
              placeholder="No. de Factura (ej: FAC-001)"
              value={folioConsolidar} onChange={e => setFolioConsolidar(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && folioConsolidar.trim() && !consolidarModal.loading) consolidarModal.confirm(); }} />
          </>}
          subdescription="El folio se asigna a todas. Las notas quedarán BLOQUEADAS para no re-mezclarlas. Solo un Gerente puede desagrupar."
          icon={ICON_WARNING}
          confirmLabel="Consolidar e imprimir"
          loadingLabel="Consolidando..."
          confirmStyle={{ background: '#16a34a' }}
          cancelLabel="Cancelar"
          onConfirm={consolidarModal.confirm}
          onCancel={consolidarModal.close}
          loading={consolidarModal.loading}
          error={consolidarModal.error}
        />
      )}

      {/* Modal desagrupar (solo Gerente) */}
      {desagruparModal.item && (
        <ConfirmModal
          title="Desagrupar compra"
          description={<>La compra <strong>{desagruparModal.item}</strong> se desbloqueará y podrá volver a consolidarse.</>}
          subdescription="Solo un Gerente puede hacerlo (se valida en el servidor)."
          icon={ICON_WARNING}
          confirmLabel="Sí, desagrupar"
          loadingLabel="Desagrupando..."
          confirmStyle={{ background: '#d97706' }}
          cancelLabel="Cancelar"
          onConfirm={desagruparModal.confirm}
          onCancel={desagruparModal.close}
          loading={desagruparModal.loading}
          error={desagruparModal.error}
        />
      )}
    </Layout>
  );
}

export default Compras;