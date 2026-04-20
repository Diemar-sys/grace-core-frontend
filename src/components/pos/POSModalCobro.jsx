import React from 'react';
import { fmt, horaActual } from './posUtils';

const METODOS = [
  { key: 'Efectivo',      icon: '💵', label: 'Efectivo' },
  { key: 'Tarjeta',       icon: '💳', label: 'Tarjeta' },
  { key: 'Transferencia', icon: '🏦', label: 'Transferencia' },
];

function POSModalCobro({
  total,
  cliente,
  pagos,
  setPagos,
  totalPagado,
  pendiente,
  cambio,
  importeOk,
  loadingCobro,
  errorCobro,
  onConfirmar,
  onCancelar,
}) {
  const handlePago = (key, value) => {
    // Solo números y un punto decimal
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setPagos(prev => ({ ...prev, [key]: value }));
  };

  // Al hacer foco: si el valor es '0' o vacío, limpiar para facilitar escritura
  const handleFocus = (e) => {
    if (parseFloat(e.target.value) === 0 || e.target.value === '') {
      e.target.select();
    }
  };

  return (
    <div
      id="pos-modal-cobrar"
      className="pos-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}
    >
      <div className="pos-cobrar-modal pos-cobrar-modal--multi">
        {/* ── Header ───────────────────────────── */}
        <div className="pos-modal-header">
          <h3>💰 Cobro de Venta</h3>
          <div className="pos-modal-total">{fmt(total)}</div>
          <div style={{ fontSize: 13, color: '#fde68a', marginTop: 2 }}>
            {horaActual()} · {cliente}
          </div>
        </div>

        <div className="pos-modal-body">
          {/* ── Inputs por método ────────────────── */}
          <div className="pos-multi-pago-grid">
            {METODOS.map(({ key, icon, label }) => (
              <div key={key} className="pos-multi-pago-col">
                <div className="pos-multi-pago-icon">{icon}</div>
                <label className="pos-multi-pago-label">{label}</label>
                <input
                  id={`pago-${key.toLowerCase()}`}
                  className="pos-multi-pago-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={pagos[key]}
                  onChange={e => handlePago(key, e.target.value)}
                  onFocus={handleFocus}
                />
              </div>
            ))}
          </div>

          {/* ── Resumen ──────────────────────────── */}
          <div className="pos-multi-resumen">
            <div className="pos-multi-resumen-row">
              <span>Total pagado</span>
              <span>{fmt(totalPagado)}</span>
            </div>
            <div className={`pos-multi-resumen-row ${pendiente > 0 ? 'pos-pendiente-warn' : 'pos-pendiente-ok'}`}>
              <span>Pendiente</span>
              <span>{pendiente > 0 ? `−${fmt(pendiente)}` : '✓ Cubierto'}</span>
            </div>
            {cambio > 0 && (
              <div className="pos-multi-resumen-row pos-cambio-highlight">
                <span>💰 Cambio a entregar</span>
                <span>{fmt(cambio)}</span>
              </div>
            )}
          </div>

          {errorCobro && (
            <div className="pos-modal-error">⚠️ {errorCobro}</div>
          )}
        </div>

        {/* ── Footer ───────────────────────────── */}
        <div className="pos-modal-footer">
          <button
            id="pos-modal-cancelar"
            className="pos-modal-cancel"
            onClick={onCancelar}
            disabled={loadingCobro}
          >
            Cancelar
          </button>
          <button
            id="pos-modal-confirmar"
            className="pos-modal-confirm"
            onClick={onConfirmar}
            disabled={loadingCobro || !importeOk}
          >
            {loadingCobro ? 'Registrando...' : '✔ Confirmar Venta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default POSModalCobro;
