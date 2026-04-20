import React, { useCallback } from 'react';
import { fmt, fechaActual } from './posUtils';
import '../../styles/pos/POSTicket.css';

function POSTicket({
  ticket,
  cliente,
  setCliente,
  total,
  totalQty,
  cambiarCantidad,
  setCantidadDirecta,
  quitarItem,
  onCobrar,
  itemSeleccionado,
  setItemSeleccionado,
  onEspera,
  onCantidad,
  onRemover,
  numEspera,
}) {
  const handleItemClick = useCallback((itemCode) => {
    setItemSeleccionado(prev => prev === itemCode ? null : itemCode);
  }, [setItemSeleccionado]);

  return (
    <div className="pos-right">
      <div className="pos-ticket-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="pos-ticket-title">🧾 Ticket de Venta</p>
          <button
            className="pos-espera-badge-btn"
            onClick={onEspera}
            title="Ver tickets en espera"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>
            </svg>
            Espera{numEspera > 0 ? ` (${numEspera})` : ''}
          </button>
        </div>
        <p className="pos-ticket-date">{fechaActual()}</p>
      </div>

      <div className="pos-ticket-items">
        {ticket.length === 0 ? (
          <div className="pos-ticket-empty">
            <span>🛒</span>
            <p>Agrega productos haciendo clic en la cuadrícula</p>
          </div>
        ) : (
          ticket.map(item => (
            <div
              key={item.item_code}
              className={`pos-ticket-item${itemSeleccionado === item.item_code ? ' selected' : ''}`}
              onClick={() => handleItemClick(item.item_code)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pos-ticket-item-name">{item.item_name}</div>
                <div className="pos-ticket-item-price">{fmt(item.precio)} c/u</div>
              </div>

              <div className="pos-qty-controls" onClick={e => e.stopPropagation()}>
                <button
                  className="pos-qty-btn"
                  onClick={() => cambiarCantidad(item.item_code, -1)}
                  aria-label="Reducir cantidad"
                >−</button>
                <input
                  className="pos-qty-input"
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={e => setCantidadDirecta(item.item_code, e.target.value)}
                  id={`qty-${item.item_code}`}
                />
                <button
                  className="pos-qty-btn"
                  onClick={() => cambiarCantidad(item.item_code, +1)}
                  aria-label="Aumentar cantidad"
                >+</button>
              </div>

              <div className="pos-ticket-item-subtotal">
                {fmt(item.qty * item.precio)}
              </div>

              <button
                className="pos-remove-btn"
                onClick={e => { e.stopPropagation(); quitarItem(item.item_code); }}
                aria-label={`Quitar ${item.item_name}`}
                title="Quitar del ticket"
              >✕</button>
            </div>
          ))
        )}
      </div>

      {ticket.length > 0 && (
        <div className="pos-action-bar">
          <button
            className="pos-action-btn pos-action-cantidad"
            onClick={onCantidad}
            disabled={!itemSeleccionado}
            title={itemSeleccionado ? 'Cambiar cantidad' : 'Selecciona un producto primero'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Cantidad
          </button>
          <button
            className="pos-action-btn pos-action-remover"
            onClick={onRemover}
            title={itemSeleccionado ? 'Quitar producto seleccionado' : 'Limpiar todo el ticket'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            {itemSeleccionado ? 'Quitar' : 'Limpiar'}
          </button>
        </div>
      )}

      <div className="pos-ticket-footer">
        <div className="pos-cliente-row">
          <span className="pos-cliente-label">Cliente</span>
          <input
            id="pos-cliente"
            className="pos-cliente-input"
            type="text"
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            placeholder="Público en General"
          />
        </div>

        <div className="pos-total-row">
          <span className="pos-total-label">
            {totalQty} artículo(s)
          </span>
          <span className="pos-total-amount">{fmt(total)}</span>
        </div>

        <button
          id="pos-btn-cobrar"
          className="pos-cobrar-btn"
          disabled={ticket.length === 0}
          onClick={onCobrar}
        >
          COBRAR
        </button>
      </div>
    </div>
  );
}

export default React.memo(POSTicket);
