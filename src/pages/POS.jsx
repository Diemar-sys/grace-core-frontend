import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { posService } from '../services/frappePOS';
import POSCatalogo from '../components/pos/POSCatalogo';
import POSTicket from '../components/pos/POSTicket';
import POSModalCobro from '../components/pos/POSModalCobro';
import POSHistorial from '../components/pos/POSHistorial';
import POSModalCorte from '../components/pos/POSModalCorte';
import POSModalEspera from '../components/pos/POSModalEspera';
import POSModalCantidad from '../components/pos/POSModalCantidad';
import { fmt } from '../components/pos/posUtils';
import { generarHTMLCorte } from '../utils/print/corteTemplate';
import { generarHTMLTicket } from '../utils/print/ticketTemplate';
import { imprimirHTML } from '../utils/print/printUtils';
import { imprimirTicketTermico } from '../services/printService';
import '../styles/global.css';
import '../styles/pos/POS.css';
import '../styles/pos/POSModals.css';

// Fuera del componente — no se recrea en cada render
function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

function POS() {
  // ── Catálogo ──────────────────────────────────
  const [todosProductos,  setTodosProductos]  = useState([]);
  const [departamentos,   setDepartamentos]   = useState([]);
  const [busqueda,        setBusqueda]        = useState('');
  const [departamento,    setDepartamento]    = useState('');
  const [loadingProds,    setLoadingProds]    = useState(false);

  // ── Ticket ────────────────────────────────────
  const [ticket,  setTicket]  = useState([]);
  const [cliente, setCliente] = useState('Público en General');

  // ── Espera ────────────────────────────────────
  const [enEspera,      setEnEspera]      = useState([]);
  const [modalEspera,   setModalEspera]   = useState(false);

  // ── Selección + cantidad ──────────────────────
  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [modalCantidad,    setModalCantidad]    = useState(false);

  // ── Cobro ───────────────────────────────────
  const PAGOS_INIT = { Efectivo: '', Tarjeta: '', Transferencia: '' };
  const [modalCobrar,  setModalCobrar]  = useState(false);
  const [pagos,        setPagos]        = useState(PAGOS_INIT);
  const [loadingCobro, setLoadingCobro] = useState(false);
  const [errorCobro,   setErrorCobro]   = useState('');

  // ── Historial ─────────────────────────────────
  const [vista,       setVista]       = useState('venta');
  const [ventasHoy,   setVentasHoy]   = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // ── Corte de caja ─────────────────────────────
  const [modalCorte,     setModalCorte]     = useState(false);
  const [datosCorte,     setDatosCorte]     = useState(null);
  const [loadingCorte,   setLoadingCorte]   = useState(false);
  const [errorCorte,     setErrorCorte]     = useState('');

  // ── Rango de fechas ───────────────────────────
  const [rangoInicio,    setRangoInicio]    = useState(hoyISO);
  const [rangoFin,       setRangoFin]       = useState(hoyISO);
  const [datosReporte,   setDatosReporte]   = useState(null);
  const [loadingReporte, setLoadingReporte] = useState(false);

  // ── Toast ─────────────────────────────────────
  const [toast,     setToast]     = useState('');
  const toastTimer               = useRef(null);

  // ─────────────────────────────────────────────
  // CARGA INICIAL
  // ─────────────────────────────────────────────
  const cargarProductos = useCallback(async () => {
    setLoadingProds(true);
    try {
      const data = await posService.buscarProductos();
      setTodosProductos(data);
      const depts = new Set();
      data.forEach(p => {
        if (p.custom_departamento) {
          p.custom_departamento.split(',').forEach(d => {
            const t = d.trim();
            if (t) depts.add(t);
          });
        }
      });
      setDepartamentos(Array.from(depts).sort());
    } catch (e) {
      console.error('Error cargando productos:', e);
    } finally {
      setLoadingProds(false);
    }
  }, []);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  // ─────────────────────────────────────────────
  // FILTRADO EN CLIENTE
  // ─────────────────────────────────────────────
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return todosProductos.filter(p => {
      const matchBusq = !q ||
        p.item_name.toLowerCase().includes(q) ||
        (p.item_code || '').toLowerCase().includes(q) ||
        (p.custom_código_interno || '').toLowerCase().includes(q);
      const matchDept = !departamento ||
        (p.custom_departamento || '').toLowerCase().includes(departamento.toLowerCase());
      return matchBusq && matchDept;
    });
  }, [todosProductos, busqueda, departamento]);

  // ─────────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (vista !== 'historial') return;
    setLoadingHist(true);
    posService.getVentasDelDia(rangoInicio, rangoFin)
      .then(setVentasHoy)
      .catch(console.error)
      .finally(() => setLoadingHist(false));
  }, [vista, rangoInicio, rangoFin]);

  useEffect(() => {
    if (vista !== 'historial') return;
    setLoadingReporte(true);
    setDatosReporte(null);
    const t = setTimeout(() => {
      posService.getReporteVentas(rangoInicio, rangoFin)
        .then(setDatosReporte)
        .catch(console.error)
        .finally(() => setLoadingReporte(false));
    }, 400);
    return () => clearTimeout(t);
  }, [vista, rangoInicio, rangoFin]);

  const setHoy = useCallback(() => {
    const h = new Date().toISOString().split('T')[0];
    setRangoInicio(h); setRangoFin(h);
  }, []);

  const setEstaSemana = useCallback(() => {
    const d = new Date();
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    setRangoInicio(lunes.toISOString().split('T')[0]);
    setRangoFin(d.toISOString().split('T')[0]);
  }, []);

  const setEsteMes = useCallback(() => {
    const d = new Date();
    const primero = new Date(d.getFullYear(), d.getMonth(), 1);
    setRangoInicio(primero.toISOString().split('T')[0]);
    setRangoFin(d.toISOString().split('T')[0]);
  }, []);

  // ─────────────────────────────────────────────
  // CORTE DE CAJA
  // ─────────────────────────────────────────────
  const abrirCorte = useCallback(async () => {
    setModalCorte(true);
    setErrorCorte('');
    setDatosCorte(null);
    setLoadingCorte(true);
    try {
      const data = await posService.getCorteCaja(rangoInicio, rangoFin);
      setDatosCorte(data);
    } catch (err) {
      setErrorCorte(err.message || 'Error al generar el corte');
    } finally {
      setLoadingCorte(false);
    }
  }, [rangoInicio, rangoFin]);

  const imprimirCorte = useCallback(() => {
    if (!datosCorte) return;
    imprimirHTML(generarHTMLCorte(datosCorte, rangoInicio, rangoFin));
  }, [datosCorte, rangoInicio, rangoFin]);

  // ─────────────────────────────────────────────
  // TICKET — helpers
  // ─────────────────────────────────────────────
  const agregarProducto = useCallback((prod) => {
    setTicket(prev => {
      const existing = prev.find(i => i.item_code === prod.item_code);
      if (existing) {
        return prev.map(i =>
          i.item_code === prod.item_code ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, {
        item_code: prod.item_code,
        item_name: prod.item_name,
        qty:       1,
        precio:    parseFloat(prod.custom_precio_de_venta) || 0,
        stock_uom: prod.stock_uom || 'PZA',
      }];
    });
  }, []);

  const cambiarCantidad = useCallback((itemCode, delta) => {
    setTicket(prev =>
      prev
        .map(i => i.item_code === itemCode ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter(i => i.qty > 0)
    );
  }, []);

  const setCantidadDirecta = useCallback((itemCode, val) => {
    const qty = Math.max(0, parseInt(val, 10) || 0);
    if (qty === 0) {
      setTicket(prev => prev.filter(i => i.item_code !== itemCode));
    } else {
      setTicket(prev => prev.map(i => i.item_code === itemCode ? { ...i, qty } : i));
    }
  }, []);

  const quitarItem = useCallback((itemCode) => {
    setTicket(prev => prev.filter(i => i.item_code !== itemCode));
  }, []);

  const limpiarTicket = useCallback(() => {
    setTicket([]);
    setCliente('Público en General');
    setItemSeleccionado(null);
    setPagos({ Efectivo: '', Tarjeta: '', Transferencia: '' });
  }, []);

  // ─────────────────────────────────────────────
  // ESPERA
  // ─────────────────────────────────────────────
  const ponerEnEspera = useCallback(() => {
    if (!ticket.length) return;
    setEnEspera(prev => [...prev, {
      id:      Date.now(),
      ticket:  [...ticket],
      cliente,
      hora:    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    }]);
    limpiarTicket();
    showToast('⏸ Ticket en espera');
  }, [ticket, cliente, limpiarTicket]);

  const retomarEspera = useCallback((id) => {
    const hold = enEspera.find(e => e.id === id);
    if (!hold) return;
    if (ticket.length) {
      setEnEspera(prev => [
        ...prev.filter(e => e.id !== id),
        {
          id:      Date.now(),
          ticket:  [...ticket],
          cliente,
          hora:    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      setEnEspera(prev => prev.filter(e => e.id !== id));
    }
    setTicket(hold.ticket);
    setCliente(hold.cliente);
    setItemSeleccionado(null);
    setModalEspera(false);
  }, [enEspera, ticket, cliente]);

  const eliminarEspera = useCallback((id) => {
    setEnEspera(prev => prev.filter(e => e.id !== id));
  }, []);

  // ─────────────────────────────────────────────
  // CANTIDAD
  // ─────────────────────────────────────────────
  const confirmarCantidad = useCallback((qty) => {
    setCantidadDirecta(itemSeleccionado, qty);
    if (qty === 0) setItemSeleccionado(null);
    setModalCantidad(false);
  }, [itemSeleccionado, setCantidadDirecta]);

  // ─────────────────────────────────────────────
  // REMOVER
  // ─────────────────────────────────────────────
  const removerItem = useCallback(() => {
    if (itemSeleccionado) {
      quitarItem(itemSeleccionado);
      setItemSeleccionado(null);
    } else {
      limpiarTicket();
    }
  }, [itemSeleccionado, quitarItem, limpiarTicket]);

  // ── Totales ───────────────────────────────────
  const total       = ticket.reduce((s, i) => s + i.qty * i.precio, 0);
  const totalQty    = ticket.reduce((s, i) => s + i.qty, 0);
  const totalPagado = Object.values(pagos).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const pendiente   = Math.max(0, total - totalPagado);
  const cambio      = Math.max(0, totalPagado - total);
  const importeOk   = pendiente === 0 && totalPagado > 0;

  // ── Item seleccionado (una sola búsqueda) ──────
  const itemSeleccionadoData = useMemo(
    () => ticket.find(i => i.item_code === itemSeleccionado) ?? null,
    [ticket, itemSeleccionado]
  );

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4_000);
  }, []);

  // ─────────────────────────────────────────────
  // CONFIRMAR VENTA
  // ─────────────────────────────────────────────
  const confirmarVenta = useCallback(async () => {
    if (!ticket.length || !importeOk) return;
    setLoadingCobro(true);
    setErrorCobro('');
    // Construir array de pagos con monto > 0
    const pagosArray = Object.entries(pagos)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([metodo, v]) => ({ metodo, monto: parseFloat(v) }));
    try {
      await posService.crearVenta({ items: ticket, customer: cliente, pagos: pagosArray });
      // Imprimir ticket térmico; fallback a PDF si el servidor no responde
      try {
        await imprimirTicketTermico({ items: ticket, cliente, pagos: pagosArray, total, cambio });
      } catch {
        imprimirHTML(generarHTMLTicket(ticket, cliente, pagosArray, total, cambio));
      }
      const cambioFmt = cambio > 0 ? ` | Cambio: ${fmt(cambio)}` : '';
      showToast(`✅ Venta registrada — Total: ${fmt(total)}${cambioFmt}`);
      limpiarTicket();
      setModalCobrar(false);
    } catch (err) {
      setErrorCobro(err.message || 'Error al registrar la venta');
    } finally {
      setLoadingCobro(false);
    }
  }, [ticket, importeOk, cliente, pagos, cambio, total, showToast, limpiarTicket]);

  // ─────────────────────────────────────────────
  // CANCELAR VENTA
  // ─────────────────────────────────────────────
  const cancelarVenta = useCallback(async (name) => {
    if (!window.confirm(`¿Cancelar la venta ${name}?`)) return;
    try {
      await posService.cancelarVenta(name);
      setVentasHoy(prev =>
        prev.map(v => v.name === name ? { ...v, docstatus: 2 } : v)
      );
      showToast(`🚫 Venta ${name} cancelada`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }, [showToast]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <Layout>
      {vista === 'historial' ? (
        <POSHistorial
          ventasHoy={ventasHoy}
          loadingHist={loadingHist}
          rangoInicio={rangoInicio}
          setRangoInicio={setRangoInicio}
          rangoFin={rangoFin}
          setRangoFin={setRangoFin}
          datosReporte={datosReporte}
          loadingReporte={loadingReporte}
          onCancelarVenta={cancelarVenta}
          onVolver={() => setVista('venta')}
          setHoy={setHoy}
          setEstaSemana={setEstaSemana}
          setEsteMes={setEsteMes}
          onAbrirCorte={abrirCorte}
        />
      ) : (
        <div className="pos-view">
          <POSCatalogo
            productosFiltrados={productosFiltrados}
            todosProductos={todosProductos}
            departamentos={departamentos}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            departamento={departamento}
            setDepartamento={setDepartamento}
            loadingProds={loadingProds}
            cargarProductos={cargarProductos}
            agregarProducto={agregarProducto}
            onHistorial={() => setVista('historial')}
          />
          <POSTicket
            ticket={ticket}
            cliente={cliente}
            setCliente={setCliente}
            total={total}
            totalQty={totalQty}
            cambiarCantidad={cambiarCantidad}
            setCantidadDirecta={setCantidadDirecta}
            quitarItem={quitarItem}
            onCobrar={() => { setErrorCobro(''); setModalCobrar(true); }}
            itemSeleccionado={itemSeleccionado}
            setItemSeleccionado={setItemSeleccionado}
            onEspera={() => ticket.length ? ponerEnEspera() : setModalEspera(true)}
            onCantidad={() => itemSeleccionado && setModalCantidad(true)}
            onRemover={removerItem}
            numEspera={enEspera.length}
          />
        </div>
      )}

      {modalCobrar && (
        <POSModalCobro
          total={total}
          cliente={cliente}
          pagos={pagos}
          setPagos={setPagos}
          totalPagado={totalPagado}
          pendiente={pendiente}
          cambio={cambio}
          importeOk={importeOk}
          loadingCobro={loadingCobro}
          errorCobro={errorCobro}
          onConfirmar={confirmarVenta}
          onCancelar={() => setModalCobrar(false)}
        />
      )}

      {modalCorte && (
        <POSModalCorte
          datosCorte={datosCorte}
          loadingCorte={loadingCorte}
          errorCorte={errorCorte}
          rangoInicio={rangoInicio}
          rangoFin={rangoFin}
          imprimirCorte={imprimirCorte}
          onCerrar={() => setModalCorte(false)}
        />
      )}

      {modalEspera && (
        <POSModalEspera
          pendientes={enEspera}
          onRetomar={retomarEspera}
          onEliminar={eliminarEspera}
          onCerrar={() => setModalEspera(false)}
        />
      )}

      {modalCantidad && itemSeleccionadoData && (
        <POSModalCantidad
          itemName={itemSeleccionadoData.item_name}
          qtyActual={itemSeleccionadoData.qty}
          onConfirmar={confirmarCantidad}
          onCerrar={() => setModalCantidad(false)}
        />
      )}

      {toast && <div className="pos-toast">{toast}</div>}
    </Layout>
  );
}

export default POS;
