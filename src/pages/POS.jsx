import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import POSCatalogo from '../components/pos/POSCatalogo';
import POSTicket from '../components/pos/POSTicket';
import POSModalCobro from '../components/pos/POSModalCobro';
import POSModalEspera from '../components/pos/POSModalEspera';
import POSModalCantidad from '../components/pos/POSModalCantidad';
import { fmt, calcularCobro } from '../components/pos/posUtils';
import { generarHTMLTicket } from '../utils/print/ticketTemplate';
import { imprimirHTML } from '../utils/print/printUtils';
import { imprimirTicketTermico } from '../services/printService';
import '../styles/global.css';
import '../styles/pos/POS.css';
import '../styles/pos/POSModals.css';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { seedCatalogo, seedStock } from '../db/sync';
import { generateUUID } from '../db/uuid';
import { DEFAULT_CUSTOMER } from '../config/constants';

const PAGOS_INIT = { Efectivo: '', Tarjeta: '', Transferencia: '' };


function POS() {
  // ── Catálogo ──────────────────────────────────

  // Constante para obtener los productos de Dexie en tiempo real
  const todosProductos = useLiveQuery(() => db.catalogo.toArray(), [], []);
  const stockRaw = useLiveQuery(() => db.stock.toArray(), [], []);
  const stockMap = useMemo(
    () => new Map(stockRaw.map(s => [s.item_code, s.qty])),
    [stockRaw]
  );

  const departamentos = useMemo(() => {
    const depts = new Set();
    todosProductos.forEach(p => {
      if (p.custom_departamento) {
        p.custom_departamento.split(',').forEach(d => {
          const t = d.trim();
          if (t) depts.add(t);
        });
      }
    });
    return Array.from(depts).sort();
  }, [todosProductos]);

  const [busqueda, setBusqueda] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [loadingProds, setLoadingProds] = useState(false);

  // ── Ticket ────────────────────────────────────
  const [ticket, setTicket] = useState([]);
  const [cliente, setCliente] = useState(DEFAULT_CUSTOMER);

  // ── Espera ────────────────────────────────────
  const [enEspera, setEnEspera] = useState([]);
  const [modalEspera, setModalEspera] = useState(false);

  // ── Selección + cantidad ──────────────────────
  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [modalCantidad, setModalCantidad] = useState(false);

  // ── Cobro ───────────────────────────────────
  const [modalCobrar, setModalCobrar] = useState(false);
  const [pagos, setPagos] = useState(PAGOS_INIT);
  const [loadingCobro, setLoadingCobro] = useState(false);
  const [errorCobro, setErrorCobro] = useState('');

  // ── Toast ─────────────────────────────────────
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  // ─────────────────────────────────────────────
  // CARGA INICIAL
  // ─────────────────────────────────────────────
  const cargarProductos = useCallback(async () => {
    setLoadingProds(true);
    try {
      await Promise.all([seedCatalogo(), seedStock()]);
    }
    finally {
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
  // TICKET — helpers
  // ─────────────────────────────────────────────
  const agregarProducto = useCallback((prod) => {
    const qty = stockMap.get(prod.item_code);
    if (qty !== undefined && qty <= 0) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      showToast(`⚠ ${prod.item_name}: caché indica agotado — verifica existencia física`);
    }
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
        qty: 1,
        precio: parseFloat(prod.custom_precio_de_venta) || 0,
        stock_uom: prod.stock_uom || 'PZA',
      }];
    });
  }, [stockMap]); // showToast excluido: stable (deps=[]), no cambia entre renders

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
    setCliente(DEFAULT_CUSTOMER);
    setItemSeleccionado(null);
    setPagos({ Efectivo: '', Tarjeta: '', Transferencia: '' });
  }, []);

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4_000);
  }, []);

  // ─────────────────────────────────────────────
  // ESPERA
  // ─────────────────────────────────────────────
  const ponerEnEspera = useCallback(() => {
    if (!ticket.length) return;
    setEnEspera(prev => [...prev, {
      id: Date.now(),
      ticket: [...ticket],
      cliente,
      hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    }]);
    limpiarTicket();
    showToast('⏸ Ticket en espera');
  }, [ticket, cliente, limpiarTicket, showToast]);

  const retomarEspera = useCallback((id) => {
    const hold = enEspera.find(e => e.id === id);
    if (!hold) return;
    if (ticket.length) {
      setEnEspera(prev => [
        ...prev.filter(e => e.id !== id),
        {
          id: Date.now(),
          ticket: [...ticket],
          cliente,
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
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

  // ── Totales (lógica pura testeada en posUtils) ─
  const { total, totalQty, totalPagado, pendiente, cambio, importeOk } = calcularCobro(ticket, pagos);

  // ── Item seleccionado (una sola búsqueda) ──────
  const itemSeleccionadoData = useMemo(
    () => ticket.find(i => i.item_code === itemSeleccionado) ?? null,
    [ticket, itemSeleccionado]
  );

  // ─────────────────────────────────────────────
  // CONFIRMAR VENTA
  // ─────────────────────────────────────────────
  const confirmarVenta = useCallback(async () => {
    if (!ticket.length || !importeOk) return;
    setLoadingCobro(true);
    setErrorCobro('');

    const pagosArray = Object.entries(pagos)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([metodo, v]) => ({ metodo, monto: parseFloat(v) }));

    try {
      // ponytail: outbox se escribe pero NADIE lo drena → ventas no llegan al backend.
      // Pendiente (cuando POS entre a producción): listener online → leer outbox →
      // crearVenta por uuid → borrar de outbox. Requiere idempotencia server-side
      // (campo custom_uuid_offline + índice unique + endpoint atómico create+submit)
      // o hay doble cobro. NO activar el POS en prod sin esto.
      // 1) Armar el objeto venta que vivirá en el outbox
      const venta = {
        uuid: generateUUID(),
        estado: 'pendiente',
        items: ticket, cliente, pagos: pagosArray, total, cambio,
        created_at: new Date().toISOString(),
      };

      // 2) Escritura atómica: venta entra + stock baja, todo o nada
      await db.transaction('rw', db.outbox, db.stock, async () => {
        await db.outbox.add(venta);
        for(const item of ticket) {
          const stockItem = await db.stock.get(item.item_code);
          if (!stockItem) {
            continue
          }
          await db.stock.update(item.item_code, { qty: stockItem.qty - item.qty });
        }
      });

      // 3) Esto ya NO toca red — queda igual que hoy
      try {
        await imprimirTicketTermico({ items: ticket, cliente, pagos: pagosArray, total, cambio });
      } catch {
        imprimirHTML(generarHTMLTicket(ticket, cliente, pagosArray, total, cambio));
      }
      const cambioFmt = cambio > 0 ? ` | Cambio: ${fmt(cambio)}` : '';
      showToast(`Venta registrada — Total: ${fmt(total)}${cambioFmt}`);
      limpiarTicket();
      setModalCobrar(false);
    } catch (err) {
      setErrorCobro(err.message || 'Error al guardar la venta');
    } finally {
      setLoadingCobro(false);
    }
  }, [ticket, importeOk, cliente, pagos, cambio, total, showToast, limpiarTicket]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <Layout>
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
          stockMap={stockMap}
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
