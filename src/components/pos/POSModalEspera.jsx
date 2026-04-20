import React from 'react';
import { fmt } from './posUtils';

function POSModalEspera({ pendientes, onRetomar, onEliminar, onCerrar }) {
  return (
    <div className="pos-modal-overlay" onClick={onCerrar}>
      <div className="pos-espera-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-header">
          <h3>⏸ Tickets en Espera</h3>
        </div>
        <div className="pos-espera-list">
          {pendientes.length === 0 ? (
            <div className="pos-espera-empty">Sin tickets en espera</div>
          ) : (
            pendientes.map(hold => {
              const totalHold = hold.ticket.reduce((s, i) => s + i.qty * i.precio, 0);
              const numItems = hold.ticket.reduce((s, i) => s + i.qty, 0);
              return (
                <div key={hold.id} className="pos-espera-item">
                  <div className="pos-espera-info">
                    <span className="pos-espera-hora">{hold.hora}</span>
                    <span className="pos-espera-cliente">{hold.cliente}</span>
                    <span className="pos-espera-meta">{numItems} art. · {fmt(totalHold)}</span>
                    <div className="pos-espera-productos">
                      {hold.ticket.map(i => (
                        <span key={i.item_code} className="pos-espera-prod-tag">
                          {i.qty}× {i.item_name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pos-espera-actions">
                    <button className="pos-modal-confirm pos-espera-retomar" onClick={() => onRetomar(hold.id)}>
                      Retomar
                    </button>
                    <button className="pos-espera-del" onClick={() => onEliminar(hold.id)} title="Eliminar">
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="pos-modal-footer">
          <button className="pos-modal-cancel" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default POSModalEspera;
