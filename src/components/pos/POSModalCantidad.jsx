import React, { useState, useEffect, useRef } from 'react';

function POSModalCantidad({ itemName, qtyActual, onConfirmar, onCerrar }) {
  const [valor, setValor] = useState(String(qtyActual));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const confirmar = () => {
    const qty = Math.max(0, parseInt(valor, 10) || 0);
    onConfirmar(qty);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') confirmar();
    if (e.key === 'Escape') onCerrar();
  };

  return (
    <div className="pos-modal-overlay" onClick={onCerrar}>
      <div className="pos-cantidad-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-header">
          <h3>Cantidad</h3>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{itemName}</div>
        </div>
        <div className="pos-modal-body">
          <label className="pos-modal-label">Nueva cantidad</label>
          <input
            ref={inputRef}
            className="pos-importe-input"
            type="number"
            min="0"
            value={valor}
            onChange={e => setValor(e.target.value)}
            onKeyDown={handleKey}
          />
          {parseInt(valor, 10) === 0 && (
            <div className="pos-modal-error">Cantidad 0 eliminará el producto del ticket.</div>
          )}
        </div>
        <div className="pos-modal-footer">
          <button className="pos-modal-cancel" onClick={onCerrar}>Cancelar</button>
          <button className="pos-modal-confirm" onClick={confirmar}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

export default POSModalCantidad;
