import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { comprasService } from '../services/frappePurchase';
import { egresosService } from '../services/frappeEgresos';
import useConfirmModal from './useConfirmModal';
import { docToDatosImpresion, imprimirCompraPDF, imprimirCompraTicket, imprimirTicketConsolidado } from '../utils/print/comprasPrint';
import { imprimirEgresoTicket } from '../services/printService';
import { agruparFacturas, listarNotas, mezclarComprasYGastos } from '../components/compras/compraUtils';

export const ESTADO_DOCSTATUS: Record<string, number> = { recibida: 1, en_espera: 0, cancelada: 2 };

export default function useCompras() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  const [compras, setCompras] = useState<any[]>([]);
  const [egresos, setEgresos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [borradorEditar, setBorradorEditar] = useState<any>(null);
  const [detalleModal, setDetalleModal] = useState<any>(null);

  useEffect(() => {
    if (!detalleModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetalleModal(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [detalleModal]);

  const abrirDetalle = useCallback(async (name: string) => {
    setDetalleModal({ loading: true });
    try {
      const data = await comprasService.getCompraBorrador(name);
      setDetalleModal({ compra: data });
    } catch { setDetalleModal(null); }
  }, []);

  const abrirDetalleEgreso = useCallback(async (name: string) => {
    setDetalleModal({ loading: true });
    try {
      const data = await egresosService.getEgreso(name);
      setDetalleModal({ egreso: data });
    } catch { setDetalleModal(null); }
  }, []);

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [facturadoSaving, setFacturadoSaving] = useState<any>(null);
  const [estadoFiltro, setEstadoFiltro] = useState('recibida');
  const [pagoFiltro, setPagoFiltro] = useState('todas');
  const [facturadoFiltro, setFacturadoFiltro] = useState('todas');
  const [proveedorFiltro, setProveedorFiltro] = useState('todas');
  const [vista, setVista] = useState('facturas');
  const [expandido, setExpandido] = useState<Set<string>>(() => new Set());
  const toggleExpand = (key: string) => setExpandido(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const [accionActiva, setAccionActiva] = useState(soloLectura ? 'consultar' : 'menu');
  useEffect(() => { setAccionActiva(soloLectura ? 'consultar' : 'menu'); }, [soloLectura]);

  const [seleccion, setSeleccion] = useState<any[]>([]);
  const toggleSel = (c: any) => setSeleccion(prev => {
    if (c.custom_consolidado) return prev;
    if (prev.some(x => x.name === c.name)) return prev.filter(x => x.name !== c.name);
    if (prev.length && prev[0].supplier !== c.supplier) return [c];
    return [...prev, c];
  });
  const sumaSel = seleccion.reduce((s, c) => s + parseFloat(c.grand_total || 0), 0);
  const esConsolidable = (c: any) => c.custom_tipo_comprobante === 'Nota';
  const [folioConsolidar, setFolioConsolidar] = useState('');
  const [facturadoConsolidar, setFacturadoConsolidar] = useState('SIN FACTURA');

  const cargar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // Los gastos (Egreso categoría GASTO) comparten el consecutivo No. de compra con
      // las recepciones, por eso se listan aquí. Si get_egresos falla, la lista de
      // compras NO se cae: los gastos quedan vacíos.
      const [data, egr] = await Promise.all([
        comprasService.getCompras({ desde: desde || null, hasta: hasta || null }, signal),
        egresosService.getEgresos({
          categoria: 'GASTO',
          fecha_desde: desde || undefined,
          fecha_hasta: hasta || undefined,
        }).catch(() => []),
      ]);
      setCompras(data);
      setEgresos(egr);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  const deleteModal = useConfirmModal(
    (name: any) => comprasService.eliminarBorrador(name),
    { onSuccess: () => cargar() }
  );
  const deleteEgresoModal = useConfirmModal(
    (egreso: any) => egresosService.eliminarEgreso(egreso.name),
    { onSuccess: () => cargar() }
  );
  const cancelModal = useConfirmModal(
    (compra: any) => comprasService.cancelarCompra(compra.name),
    { onSuccess: () => cargar() }
  );
  const pagoModal = useConfirmModal(
    ({ name, value, esGasto }: any) => esGasto
      ? egresosService.marcarPagado(name, value)
      : comprasService.updatePagado(name, value),
    { onSuccess: () => cargar() }
  );
  const consolidarModal = useConfirmModal(
    async (sel: any) => {
      const folio = folioConsolidar.trim();
      if (!folio) throw new Error('Captura el No. de Factura para agrupar.');
      await comprasService.consolidarCompras(sel.map((c: any) => c.name), folio);
      if (facturadoConsolidar) {
        await Promise.all(sel.map((c: any) => comprasService.updateFacturadoA(c.name, facturadoConsolidar)));
      }
      const proveedor = sel[0].supplier_name || sel[0].supplier;
      const notas = sel.map((c: any) => ({
        no_compra: c.custom_no_de_compra, remision: c.custom_nota_remision,
        fecha: c.posting_date, total: c.grand_total,
      }));
      await imprimirTicketConsolidado(proveedor, folio, notas, facturadoConsolidar);
    },
    { onSuccess: () => { setSeleccion([]); setFolioConsolidar(''); setFacturadoConsolidar('SIN FACTURA'); cargar(); } }
  );
  const desagruparModal = useConfirmModal(
    (name: any) => comprasService.desconsolidarCompra(name),
    { onSuccess: () => cargar() }
  );
  const cancelConsolidadoModal = useConfirmModal(
    (g: any) => comprasService.cancelarConsolidado(g.notas.map((c: any) => c.name)),
    { onSuccess: () => cargar() }
  );

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const handleEditar = async (name: string) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      setBorradorEditar(doc);
      setModal('editar');
    } catch (err) { console.error(err); }
  };

  const handleFacturadoChange = async (name: string, value: string) => {
    const prev = compras;
    setCompras(cs => cs.map(c => c.name === name ? { ...c, custom_facturado_a: value } : c));
    setFacturadoSaving(name);
    try {
      await comprasService.updateFacturadoA(name, value);
    } catch (err) {
      console.error(err);
      setCompras(prev);
      alert('No se pudo actualizar el responsable fiscal: ' + ((err as any)?.message || 'error'));
    } finally {
      setFacturadoSaving(null);
    }
  };

  const handleFacturadoChangeGroup = async (notas: any[], value: string) => {
    const names = new Set(notas.map(n => n.name));
    setCompras(cs => cs.map(c => names.has(c.name) ? { ...c, custom_facturado_a: value } : c));
    setFacturadoSaving(notas[0]?.name);
    try {
      await Promise.all(notas.map(n => comprasService.updateFacturadoA(n.name, value)));
    } catch (err) {
      cargar();
      alert('No se pudo actualizar el responsable fiscal: ' + ((err as any)?.message || 'error'));
    } finally {
      setFacturadoSaving(null);
    }
  };

  const handleImprimir = async (name: string, modo: string) => {
    try {
      const doc = await comprasService.getCompraBorrador(name);
      const datos = docToDatosImpresion(doc);
      if (datos.filas?.length) {
        const codes = [...new Set(datos.filas.map((f: any) => f.item_code).filter(Boolean))] as string[];
        const catItems = await comprasService.getItemsCatalogo(codes);
        const catMap: Record<string, any> = {};
        catItems.forEach((it: any) => { catMap[it.item_code] = it; });
        datos.filas = datos.filas.map((f: any) => ({
          ...f,
          kg_por_bulto: String(catMap[f.item_code]?.custom_cantidad_por_presentación || ''),
          uom: f.uom || catMap[f.item_code]?.stock_uom || '',
        }));
      }
      if (modo === 'ticket') imprimirCompraTicket(datos);
      else imprimirCompraPDF(datos);
    } catch (err) { console.error('Error imprimiendo compra:', err); }
  };

  const handleImprimirEgreso = async (egreso: any) => {
    try { await imprimirEgresoTicket(egreso); }
    catch (err) { console.error('Error imprimiendo egreso:', err); }
  };

  const handleConfirmarBorrador = async (name: string) => {
    try {
      await comprasService.confirmarBorrador(name);
      cargar();
    } catch (err) { console.error(err); }
  };

  const handleModalSuccess = () => { setModal(null); setBorradorEditar(null); cargar(); };
  const handleModalCancel  = () => { setModal(null); setBorradorEditar(null); };

  const proveedoresUnicos = [...new Set(compras.map(c => c.supplier_name).filter(Boolean))].sort();

  const reimprimirConsolidado = (g: any) =>
    imprimirTicketConsolidado(g.supplier_name || g.supplier, g.folio, g.notas.map((c: any) => ({
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
    const factura  = (c.supplier_delivery_note || '').toLowerCase();
    const termNum  = term.replace(/^#/, '');
    return supName.includes(term) || supId.includes(term)
      || noCompra.includes(termNum) || factura.includes(term);
  });

  // Los gastos no tienen docstatus (no son documento de stock) → el filtro Estado no
  // aplica y la vista lo esconde. El resto de filtros sí, contra los campos del Egreso.
  const filteredEgresos = egresos.filter(e => {
    if (pagoFiltro === 'pagadas'    && !e.pagado) return false;
    if (pagoFiltro === 'pendientes' &&  e.pagado) return false;
    if (facturadoFiltro !== 'todas' && (e.facturado_a || 'SIN FACTURA') !== facturadoFiltro) return false;
    if (proveedorFiltro !== 'todas' && e.proveedor !== proveedorFiltro) return false;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const termNum = term.replace(/^#/, '');
    return (e.proveedor || '').toLowerCase().includes(term)
      || (e.concepto || '').toLowerCase().includes(term)
      || (e.no_factura || '').toLowerCase().includes(term)
      || String(e.no_de_compra ?? '').toLowerCase().includes(termNum);
  });

  const facturasAgrupadas = agruparFacturas(filteredCompras);
  const notasItems        = listarNotas(filteredCompras);

  const totalItems = mezclarComprasYGastos(filteredCompras, filteredEgresos);

  return {
    soloLectura,
    compras, loading,
    modal, setModal,
    borradorEditar,
    detalleModal, setDetalleModal, abrirDetalle, abrirDetalleEgreso,
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
    seleccion, setSeleccion, toggleSel, sumaSel, esConsolidable,
    folioConsolidar, setFolioConsolidar,
    facturadoConsolidar, setFacturadoConsolidar,
    proveedoresUnicos,
    filteredCompras, facturasAgrupadas, notasItems,
    egresos, filteredEgresos, totalItems, handleImprimirEgreso, deleteEgresoModal,
    deleteModal, cancelModal, pagoModal,
    consolidarModal, desagruparModal, cancelConsolidadoModal,
    cargar,
    handleEditar, handleFacturadoChange, handleFacturadoChangeGroup, handleImprimir,
    handleConfirmarBorrador, handleModalSuccess, handleModalCancel,
    reimprimirConsolidado,
  };
}
