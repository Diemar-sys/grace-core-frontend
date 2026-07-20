import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import ModalRegistrarPago from './modals/ModalRegistrarPago';
import { ventasService, saldoCobrable } from '../services/frappeSales';

const fmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// `creation` viene como "2026-07-20 11:40:21.862707" (hora del servidor).
const fmtHora = (creation) => (creation || '').slice(11, 16);

/**
 * Cuentas por cobrar B2B: tarjetas (Total/Cobrado/Se debe) + tabla por cliente.
 * Compartido entre el reporte (readOnly) y Ventas B2B → Registrar Cobro (con botón Cobrar).
 *
 * @param {boolean} [readOnly=false] true → sin columna/botón Cobrar (solo consulta).
 * ref.recargar() → refresca los datos (para el botón "Actualizar" del padre).
 */
const TablaCuentasPorCobrar = forwardRef(function TablaCuentasPorCobrar({ readOnly = false }, ref) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState('pendiente');
  const [cliente, setCliente] = useState('todos');
  const [search, setSearch] = useState('');
  const [pagoModal, setPagoModal] = useState(null);
  const [abonos, setAbonos] = useState({});      // customer -> [] | 'cargando'
  const [abierto, setAbierto] = useState(null);  // customer con el historial desplegado

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setData(await ventasService.getCuentasPorCobrar()); }
    catch (err) { console.error('Error CxC:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

  const conSaldo = useMemo(() => data.filter(r => (parseFloat(r.pendiente) || 0) > 0), [data]);

  // `pendiente` ya viene saneado por factura desde agruparCuentasPorCobrar.
  const filas = useMemo(() => {
    let out = data;
    if (estado === 'pendiente') out = out.filter(r => (parseFloat(r.pendiente) || 0) > 0);
    else if (estado === 'saldadas') out = out.filter(r => (parseFloat(r.pendiente) || 0) === 0);
    if (cliente !== 'todos') out = out.filter(r => r.customer === cliente);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter(r => (r.customer_name || '').toLowerCase().includes(q));
    return out;
  }, [data, estado, cliente, search]);

  // Historial de abonos: se pide la primera vez que se abre el cliente.
  const toggleAbonos = useCallback(async (customer) => {
    if (abierto === customer) { setAbierto(null); return; }
    setAbierto(customer);
    if (abonos[customer]) return;
    setAbonos(a => ({ ...a, [customer]: 'cargando' }));
    try {
      const lista = await ventasService.getAbonos({ customer });
      setAbonos(a => ({ ...a, [customer]: lista }));
    } catch (err) {
      console.error('Error abonos:', err);
      setAbonos(a => ({ ...a, [customer]: [] }));
    }
  }, [abierto, abonos]);

  const sumar = (rows) => rows.reduce((a, r) => ({
    n: a.n + (r.n || 0),
    total: a.total + (parseFloat(r.total) || 0),
    pagado: a.pagado + (parseFloat(r.pagado) || 0),
    pendiente: a.pendiente + (parseFloat(r.pendiente) || 0),
  }), { n: 0, total: 0, pagado: 0, pendiente: 0 });

  // Las tarjetas describen TODA la cartera, no el filtro: si sumaran solo lo
  // visible, filtrar "con saldo" con todo cobrado pintaba "Total $0.00" habiendo
  // decenas de miles facturados.
  const global = useMemo(() => sumar(data), [data]);
  const tot = useMemo(() => sumar(filas), [filas]);

  // Abre el modal de cobro: trae las SI pendientes del cliente y arma el grupo FIFO.
  const abrirCobro = async (fila) => {
    try {
      const facturasBrutas = await ventasService.getFacturasPendientes({ customer: fila.customer });

      // EL FILTRO ANTICOBRO
      // Limpiamos la basurilla decimal de Frappe y solo dejamos las que deban 1 centavo o más
      const facturasReales = facturasBrutas.filter(f => saldoCobrable(f.outstanding_amount) > 0);

      if (!facturasReales.length) {
        alert(`Al parecer las facturas de ${fila.customer_name} ya estaban saldadas.`);
        await cargar();
        return;
      }

      setPagoModal({
        customer: fila.customer,
        customer_name: fila.customer_name,
        totalDeuda: facturasReales.reduce((s, f) => s + parseFloat(f.outstanding_amount || 0), 0),
        facturas: facturasReales, // ← Aquí le pasamos solo las facturas limpias
      });
    } catch (err) {
      console.error('Error abriendo cobro:', err);
    }
  };

  const nCols = readOnly ? 5 : 6;

  return (
    <>
      <div className="cxc-barra">
        <div className="cxc-barra-filtros">
          <div className="filtro-group filtro-sm">
            <label>Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value)}>
              <option value="pendiente">Con saldo ({conSaldo.length})</option>
              <option value="saldadas">Saldadas ({data.length - conSaldo.length})</option>
              <option value="todos">Todos ({data.length})</option>
            </select>
          </div>
          <div className="filtro-group filtro-sm">
            <label>Cliente</label>
            <select value={cliente} onChange={e => setCliente(e.target.value)}>
              <option value="todos">Todos</option>
              {data.map(r => <option key={r.customer} value={r.customer}>{r.customer_name}</option>)}
            </select>
          </div>
          <div className="filtro-group search filtro-sm">
            <label>Buscar cliente</label>
            <input type="text" placeholder="Ej: DELI" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="cxc-stats">
          <div className="cxc-stat">
            <span className="cxc-stat-num">${fmt(global.total)}</span>
            <span className="cxc-stat-lbl">Total</span>
          </div>
          <div className="cxc-stat cobrado">
            <span className="cxc-stat-num">${fmt(global.pagado)}</span>
            <span className="cxc-stat-lbl">Cobrado</span>
          </div>
          <div className="cxc-stat debe">
            <span className="cxc-stat-num">${fmt(global.pendiente)}</span>
            <span className="cxc-stat-lbl">Se debe</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="table-container">
          <table className="sys-table report-compact">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="cell-right"># Ventas</th>
                <th className="cell-right">Total</th>
                <th className="cell-right">Cobrado</th>
                <th className="cell-right">Se debe</th>
                {!readOnly && <th className="cell-right"></th>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={nCols} className="no-data">Sin cuentas por cobrar.</td></tr>
              ) : filas.map(r => {
                const lista = abonos[r.customer];
                const desplegado = abierto === r.customer;
                return (
                  <Fragment key={r.customer}>
                    <tr>
                      <td className="cell-name">
                        <button
                          className="cxc-toggle"
                          onClick={() => toggleAbonos(r.customer)}
                          title="Ver abonos"
                        >
                          <span className={`cxc-caret${desplegado ? ' abierto' : ''}`}>▸</span>
                          {r.customer_name}
                        </button>
                      </td>
                      <td className="cell-right">{r.n}</td>
                      <td className="cell-right cell-bold">${fmt(r.total)}</td>
                      <td className="cell-right" style={{ color: '#16a34a' }}>${fmt(r.pagado)}</td>
                      <td className="cell-right" style={{ color: '#dc2626' }}>${fmt(r.pendiente)}</td>
                      {!readOnly && (
                        <td className="cell-right">
                          {(parseFloat(r.pendiente) || 0) > 0 && (
                            <button className="btn-refresh btn-compacto" onClick={() => abrirCobro(r)}>
                              Cobrar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {desplegado && (
                      <tr className="cxc-abonos-fila">
                        <td colSpan={nCols}>
                          {lista === 'cargando' ? (
                            <div className="cxc-abonos-vacio">Cargando abonos…</div>
                          ) : !lista?.length ? (
                            <div className="cxc-abonos-vacio">Sin abonos registrados.</div>
                          ) : (
                            <div className="cxc-abonos">
                              <div className="cxc-abonos-titulo">
                                Abonos de {r.customer_name} ({lista.length})
                              </div>
                              <table className="cxc-abonos-tabla">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Hora</th>
                                    <th>Forma</th>
                                    <th>Aplicado a</th>
                                    <th className="cell-right">Abonó</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lista.map(p => (
                                    <tr key={p.name}>
                                      <td>{p.posting_date}</td>
                                      <td>{fmtHora(p.creation)}</td>
                                      <td>{p.mode_of_payment || '—'}</td>
                                      <td className="cxc-abonos-facturas">
                                        {p.facturas.length
                                          ? p.facturas.map(f => (
                                              <span key={f.reference_name} className="cxc-chip">
                                                {f.no_venta ? `Venta #${f.no_venta}` : 'Venta s/n'}
                                                <b>${fmt(f.allocated_amount)}</b>
                                              </span>
                                            ))
                                          : '—'}
                                      </td>
                                      <td className="cell-right cell-bold" style={{ color: '#16a34a' }}>
                                        ${fmt(p.paid_amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={4}>Total abonado</td>
                                    <td className="cell-right cell-bold">
                                      ${fmt(lista.reduce((s, p) => s + (parseFloat(p.paid_amount) || 0), 0))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {filas.length > 1 && (
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid #374151', background: '#f9fafb' }}>
                  <td>TOTAL</td>
                  <td className="cell-right">{tot.n}</td>
                  <td className="cell-right">${fmt(tot.total)}</td>
                  <td className="cell-right">${fmt(tot.pagado)}</td>
                  <td className="cell-right">${fmt(tot.pendiente)}</td>
                  {!readOnly && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {pagoModal && (
        <ModalRegistrarPago
          grupo={pagoModal}
          onSuccess={() => { setPagoModal(null); cargar(); }}
          onCancel={() => setPagoModal(null)}
        />
      )}
    </>
  );
});

export default TablaCuentasPorCobrar;
