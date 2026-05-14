// src/components/Libreta.jsx
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { ventasService } from '../services/frappeSales';

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Vista clientes con saldo pendiente (Sales Invoice outstanding > 0).
 * Expandible: cliente → facturas → items detallados (lazy load).
 *
 * @param {Object} props
 * @param {boolean} [props.readOnly=false]
 *   true  → vista consulta: sin botón "Cobrar".
 *   false → vista operación: botón "💰 Cobrar" por cliente.
 * @param {(grupoCliente: Object) => void} [props.onCobrar]
 *   Callback invocado al hacer click "Cobrar". El componente solo dispara —
 *   parent maneja apertura del modal de pago.
 */
const Libreta = forwardRef(function Libreta({ readOnly = false, onCobrar }, ref) {
  const [deudas, setDeudas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deudaExpandida, setDeudaExpandida] = useState({});

  // Items por factura — lazy load + cache local
  const [facturaExpandida, setFacturaExpandida] = useState({});
  const [facturaItems, setFacturaItems] = useState({});
  const [facturaItemsLoading, setFacturaItemsLoading] = useState({});

  const cargar = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await ventasService.getDeudaPorCliente(signal);
      setDeudas(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error deudas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  useImperativeHandle(ref, () => ({ recargar: () => cargar() }), [cargar]);

  const toggleDeuda = (customer) => {
    setDeudaExpandida(prev => ({ ...prev, [customer]: !prev[customer] }));
  };

  const toggleFactura = async (name) => {
    setFacturaExpandida(prev => ({ ...prev, [name]: !prev[name] }));
    if (facturaItems[name]) return;
    setFacturaItemsLoading(prev => ({ ...prev, [name]: true }));
    try {
      const items = await ventasService.getFacturaItems(name);
      setFacturaItems(prev => ({ ...prev, [name]: items }));
    } catch (err) {
      console.error('Error items factura:', err);
      setFacturaItems(prev => ({ ...prev, [name]: [] }));
    } finally {
      setFacturaItemsLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  return (
    <>
      {loading ? (
        <div className="loading">Cargando libreta...</div>
      ) : deudas.length === 0 ? (
        <div className="no-data" style={{ padding: '40px', textAlign: 'center' }}>
          Sin saldos pendientes — todos los clientes están al corriente
        </div>
      ) : (
        <div style={{ marginTop: '16px' }}>
          {deudas.map(g => {
            const open = !!deudaExpandida[g.customer];
            return (
              <div key={g.customer} className="grupo-cliente"
                style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: open ? '#fef3c7' : '#fffbeb',
                  borderBottom: open ? '1px solid #fde68a' : 'none',
                }}>
                  <button onClick={() => toggleDeuda(g.customer)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '15px', flex: 1, textAlign: 'left', padding: 0,
                    }}>
                    <span style={{ fontSize: '14px', color: '#92400e' }}>{open ? '▼' : '▶'}</span>
                    <strong style={{ fontSize: '16px' }}>{g.customer_name}</strong>
                    <span style={{ fontSize: '13px', color: '#92400e' }}>
                      ({g.facturas.length} {g.facturas.length === 1 ? 'factura' : 'facturas'})
                    </span>
                  </button>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '17px', color: '#92400e' }}>
                      ${fmt(g.totalDeuda)}
                    </span>
                    {!readOnly && (
                      <button
                        className="comp-btn-confirmar"
                        onClick={() => onCobrar?.(g)}
                        style={{ background: '#16a34a', color: '#fff', padding: '6px 14px', borderRadius: 6, fontWeight: 600 }}>
                        💰 Cobrar
                      </button>
                    )}
                  </div>
                </div>
                {open && (
                  <div style={{ padding: '8px 18px', background: '#fafafa' }}>
                    <table className="sys-table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}></th>
                          <th>Fecha</th>
                          <th># Venta</th>
                          <th className="cell-right">Total</th>
                          <th className="cell-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.facturas.map(f => {
                          const fOpen = !!facturaExpandida[f.name];
                          const items = facturaItems[f.name] || [];
                          const fLoading = !!facturaItemsLoading[f.name];
                          return (
                            <React.Fragment key={f.name}>
                              <tr style={{ cursor: 'pointer' }} onClick={() => toggleFactura(f.name)}>
                                <td style={{ color: '#6b7280' }}>{fOpen ? '▼' : '▶'}</td>
                                <td>{f.posting_date}</td>
                                <td className="cell-code">
                                  {f.custom_no_de_venta ? `#${f.custom_no_de_venta}` : f.name}
                                </td>
                                <td className="cell-right">${fmt(f.grand_total)}</td>
                                <td className="cell-right cell-bold" style={{ color: '#92400e' }}>
                                  ${fmt(f.outstanding_amount)}
                                </td>
                              </tr>
                              {fOpen && (
                                <tr>
                                  <td colSpan={5} style={{ padding: '8px 12px', background: '#fff' }}>
                                    {fLoading ? (
                                      <div style={{ padding: 8, fontSize: 12, color: '#6b7280' }}>
                                        Cargando items...
                                      </div>
                                    ) : items.length === 0 ? (
                                      <div style={{ padding: 8, fontSize: 12, color: '#6b7280' }}>
                                        Sin líneas
                                      </div>
                                    ) : (
                                      <table className="sys-table" style={{ margin: 0 }}>
                                        <thead>
                                          <tr>
                                            <th>Producto</th>
                                            <th className="cell-right">Cantidad</th>
                                            <th className="cell-right">Precio unit.</th>
                                            <th className="cell-right">Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((it, idx) => (
                                            <tr key={idx}>
                                              <td>
                                                <div className="cell-name">{it.item_name || it.item_code}</div>
                                                <div className="cell-code" style={{ fontSize: 11, color: '#6b7280' }}>
                                                  {it.item_code}
                                                </div>
                                              </td>
                                              <td className="cell-right">
                                                <div>{Number(it.qty).toFixed(2)} {it.uom}</div>
                                                {it.cantidad_por_presentacion > 1 && it.presentacion && (
                                                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                                                    = {Number(it.qty_presentacion).toFixed(2)} {it.presentacion}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="cell-right">${fmt(it.rate)}</td>
                                              <td className="cell-right cell-bold">${fmt(it.amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});

export default Libreta;
