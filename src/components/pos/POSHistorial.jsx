import React, { useCallback } from 'react';
import { fmt, fechaActual, deptColor, fmtModoPago } from './posUtils';
import '../../styles/pos/POSHistorial.css';

function POSHistorial({
  ventasHoy,
  loadingHist,
  rangoInicio,
  setRangoInicio,
  rangoFin,
  setRangoFin,
  datosReporte,
  loadingReporte,
  onCancelarVenta,
  onVolver,
  setHoy,
  setEstaSemana,
  setEsteMes,
  onAbrirCorte,
}) {
  return (
    <div className="pos-historial-view">
      <div className="pos-historial-header">
        <div>
          <h2>📋 Historial de Ventas</h2>
          <p className="pos-historial-subtitle">
            {fechaActual()}
          </p>
        </div>
        <div className="pos-historial-header-actions">
          <button className="pos-historial-btn activo" onClick={onVolver}>
            ← Volver al POS
          </button>
        </div>
      </div>

      <div className="pos-rango-row">
        <div className="pos-rango-inputs">
          <label className="pos-rango-label">Desde</label>
          <input
            type="date"
            className="pos-rango-date"
            value={rangoInicio}
            max={rangoFin}
            onChange={e => setRangoInicio(e.target.value)}
          />
          <span className="pos-rango-sep">→</span>
          <label className="pos-rango-label">Hasta</label>
          <input
            type="date"
            className="pos-rango-date"
            value={rangoFin}
            min={rangoInicio}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setRangoFin(e.target.value)}
          />
        </div>
        <div className="pos-rango-shortcuts">
          <button className="pos-periodo-tab" onClick={setHoy}>Hoy</button>
          <button className="pos-periodo-tab" onClick={setEstaSemana}>Esta semana</button>
          <button className="pos-periodo-tab" onClick={setEsteMes}>Este mes</button>
        </div>
        <button
          className="pos-historial-btn"
          id="btn-corte-caja"
          onClick={onAbrirCorte}
          title="Generar corte de caja del período seleccionado"
        >
          💰 Corte de Caja
        </button>
      </div>

      {loadingReporte ? (
        <div className="pos-historial-stats">
          <div className="pos-historial-stat">
            <div className="stat-n">…</div>
            <div className="stat-l">Cargando reporte</div>
          </div>
        </div>
      ) : datosReporte ? (
        <div className="pos-reporte-resumen">
          <div className="pos-historial-stats pos-historial-stats--shrink">
            <div className="pos-historial-stat">
              <div className="stat-n">{datosReporte.num_transacciones}</div>
              <div className="stat-l">Ventas</div>
            </div>
            <div className="pos-historial-stat">
              <div className="stat-n">{fmt(datosReporte.total_ventas)}</div>
              <div className="stat-l">Total</div>
            </div>
            {datosReporte.por_forma_pago.map(fp => (
              <div key={fp.forma_pago} className="pos-historial-stat">
                <div className="stat-n stat-n--md">{fmt(fp.total)}</div>
                <div className="stat-l">
                  {fp.forma_pago === 'Cash' || fp.forma_pago === 'Efectivo' ? '💵'
                    : fp.forma_pago === 'Bank Draft' || fp.forma_pago === 'Tarjeta' ? '💳'
                    : '🏦'} {fmtModoPago(fp.forma_pago)}
                </div>
              </div>
            ))}
          </div>

          {datosReporte.por_departamento.length > 0 && (
            <div className="pos-dept-reporte">
              {datosReporte.por_departamento.map(dep => {
                const pct = datosReporte.total_ventas > 0
                  ? (dep.total / datosReporte.total_ventas * 100).toFixed(1)
                  : 0;
                const color = deptColor(dep.departamento);
                return (
                  <div key={dep.departamento} className="pos-dept-reporte-row">
                    <div className="pos-dept-reporte-label">
                      <span style={{ color, fontWeight: 700 }}>{dep.departamento}</span>
                      <span className="pos-dept-pct">{pct}%</span>
                    </div>
                    <div className="pos-dept-bar-wrap">
                      <div
                        className="pos-dept-bar-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="pos-dept-total">{fmt(dep.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="table-container">
        {loadingHist ? (
          <p className="loading">Cargando historial...</p>
        ) : ventasHoy.length === 0 ? (
          <p className="no-data">No hay ventas registradas para esta fecha.</p>
        ) : (
          <table className="sys-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th className="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventasHoy.map(v => {
                const hora = new Date(v.creation).toLocaleTimeString('es-MX', {
                  hour: '2-digit', minute: '2-digit',
                });
                const cancelada = v.docstatus === 2;
                return (
                  <tr key={v.name} style={cancelada ? { opacity: 0.5 } : {}}>
                    <td className="cell-code">{v.name}</td>
                    <td>{hora}</td>
                    <td>{v.customer}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-brand)' }}>
                      {fmt(v.grand_total)}
                    </td>
                    <td>
                      <span className={`status-badge ${cancelada ? 'status-out' : 'status-ok'}`}>
                        {cancelada ? 'Cancelada' : 'Activa'}
                      </span>
                    </td>
                    <td className="col-actions">
                      {!cancelada && (
                        <button
                          className="btn-delete-row"
                          title="Cancelar venta"
                          onClick={() => onCancelarVenta(v.name)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default React.memo(POSHistorial);
