import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { comprasService } from '../services/frappePurchase';
import useConfirmModal from './useConfirmModal';
import { docToDatosImpresion, imprimirCompraPDF, imprimirCompraTicket, imprimirTicketConsolidado } from '../utils/print/comprasPrint';
import { agruparFacturas, listarNotas } from '../components/compras/compraUtils';

export const ESTADO_DOCSTATUS = { recibida: 1, en_espera: 0, cancelada: 2 };

export default function useCompras() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [borradorEditar, setBorradorEditar] = useState(null);
  const [detalleModal, setDetalleModal] = useState(null);

  useEffect(() => {
    if (!detalleModal) return;
    const handler = (e) => { if (e.key === 'Escape') setDetalleModal(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [detalleModal]);

  const abrirDetalle = useCallback(async (name) => {
    setDetalleModal({ loading: true });
    try {
      const data = await comprasService.getCompraBorrador(name);
      setDetalleModal({ compra: data });
    } catch { setDetalleModal(null); }
  }, []);

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [facturadoSaving, setFacturadoSaving] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState('recibida');
  const [pagoFiltro, setPagoFiltro] = useState('todas');
  const [facturadoFiltro, setFacturadoFiltro] = useState('todas');
  const [proveedorFiltro, setProveedorFiltro] = useState('todas');
  const [vista, setVista] = useState('facturas');
  const [expandido, setExpandido] = useState(() => new Set());
  const toggleExpand = (key) => setExpandido(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  const [seleccion, setSeleccion] = useState([]);
  const toggleSel = (c) => setSeleccion(prev => {
    if (c.custom_consolidado) return prev;
    if (prev.some(x => x.name === c.name)) return prev.filter(x => x.name !== c.name);
    if (prev.length && prev[0].supplier !== c.supplier) return [c];
    return [...prev, c];
  });
  const sumaSel = seleccion.reduce((s, c) => s + parseFloat(c.grand_total || 0), 0);
  const esConsolidable = (c) => c.custom_tipo_comprobante === 'Nota';
  const [folioConsolidar, setFolioConsolidar] = useState('');

  const cargar = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await comprasService.getCompras({ desde: desde || null, hasta: hasta || null }, signal);
      setCompras(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
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
      await imprimirTicketConsolidado(proveedor, folio, notas, sel[0].custom_facturado_a || '');
    },
    { onSuccess: () => { setSeleccion([]); setFolioConsolidar(''); cargar(); } }
  );
  const desagruparModal = useConfirmModal(
    (name) => comprasService.desconsolidarCompra(name),
    { onSuccess: () => cargar() }
  );
  const cancelConsolidadoModal = useConfirmModal(
    (g) => comprasService.cancelarConsolidado(g.notas.map(c => c.name)),
    { onSuccess: () => cargar() }
  );

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
    } catch (err) { console.error(err); }
  };

  const handleFacturadoChange = async (name, value) => {
    const prev = compras;
    setCompras(cs => cs.map(c => c.name === name ? { ...c, custom_facturado_a: value } : c));
    setFacturadoSaving(name);
    try {
      await comprasService.updateFacturadoA(name, value);
    } catch (err) {
      console.error(err);
      setCompras(prev);
      alert('No se pudo actualizar el responsable fiscal: ' + (err?.message || 'error'));
    } finally {
      setFacturadoSaving(null);
    }
  };

  const handleImprimir = async (name, modo) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      const datos = docToDatosImpresion(doc);
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
    } catch (err) { console.error('Error imprimiendo compra:', err); }
  };

  const handleConfirmarBorrador = async (name) => {
    try {
      await comprasService.confirmarBorrador(name);
      cargar();
    } catch (err) { console.error(err); }
  };

  const handleModalSuccess = () => { setModal(null); setBorradorEditar(null); cargar(); };
  const handleModalCancel  = () => { setModal(null); setBorradorEditar(null); };

  const proveedoresUnicos = [...new Set(compras.map(c => c.supplier_name).filter(Boolean))].sort();

  const reimprimirConsolidado = (g) =>
    imprimirTicketConsolidado(g.supplier_name || g.supplier, g.folio, g.notas.map(c => ({
      no_compra: c.custom_no_de_compra, remision: c.custom_nota_remision,
      fecha: c.posting_date, total: c.grand_total,
    })), g.facturado_a || '');

  const filteredCompras = compras.filter(c => {
    if (estadoFiltro !== 'todas' && c.docstatus !== ESTADO_DOCSTATUS[estadoFiltro]) return false;
    if (pagoFiltro === 'pagadas'    && !c.custom_pagado) return false;
    if (pagoFiltro === 'pendientes' &&  c.custom_pagado) return false;
    if (facturadoFiltro !== 'todas' && (c.custom_facturado_a || 'SIN FACTURA') !== facturadoFiltro) return false;
    if (proveedorFiltro !== 'todas' && c.supplier_name !== proveedorFiltro) return false;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const supName  = (c.supplier_name || '').toLowerCase();
    const supId    = (c.supplier || '').toLowerCase();
    const noCompra = String(c.custom_no_de_compra ?? '').toLowerCase();
    const termNum  = term.replace(/^#/, '');
    return supName.includes(term) || supId.includes(term) || noCompra.includes(termNum);
  });

  const facturasAgrupadas = agruparFacturas(filteredCompras);
  const notasItems        = listarNotas(filteredCompras);

  return {
    soloLectura,
    compras, loading,
    modal, setModal,
    borradorEditar,
    detalleModal, setDetalleModal, abrirDetalle,
    desde, setDesde,
    hasta, setHasta,
    searchTerm, setSearchTerm,
    facturadoSaving,
    estadoFiltro, setEstadoFiltro,
    pagoFiltro, setPagoFiltro,
    facturadoFiltro, setFacturadoFiltro,
    proveedorFiltro, setProveedorFiltro,
    vista, setVista,
    expandido, toggleExpand,
    accionActiva, setAccionActiva,
    seleccion, toggleSel, sumaSel, esConsolidable,
    folioConsolidar, setFolioConsolidar,
    proveedoresUnicos,
    filteredCompras, facturasAgrupadas, notasItems,
    deleteModal, cancelModal, pagoModal,
    consolidarModal, desagruparModal, cancelConsolidadoModal,
    cargar,
    handleEditar, handleFacturadoChange, handleImprimir,
    handleConfirmarBorrador, handleModalSuccess, handleModalCancel,
    reimprimirConsolidado,
  };
}
