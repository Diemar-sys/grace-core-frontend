import React from 'react';
import { fmt, fmtModoPago } from './posUtils';
import { TENANT } from '../../config/tenant';

function POSModalCorte({
  datosCorte,
  loadingCorte,
  errorCorte,
  rangoInicio,
  rangoFin,
  imprimirCorte,
  onCerrar,
}) {
  const fmtFecha = (iso) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

  const esRango = rangoInicio !== rangoFin;

  return (
    <div
      className="pos-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="pos-ticket-receipt-wrap">
        <div className="pos-ticket-actions no-print">
          <button className="pos-modal-cancel" onClick={onCerrar}>
            Cerrar
          </button>
          {datosCorte && (
            <button
              className="pos-modal-confirm"
              style={{ background: 'var(--color-brand)' }}
              onClick={imprimirCorte}
            >
              🖨️ Imprimir Corte
            </button>
          )}
        </div>

        <div className="pos-ticket-receipt" id="ticket-corte-imprimible">
          <div className="tkt-center tkt-logo">
            <strong>{TENANT.nombre.split(' ')[0].toUpperCase()}</strong><br />
            <span>{TENANT.subtitulo}</span>
          </div>

          <div className="tkt-center tkt-store">
            {TENANT.nombreFull}<br />
            {TENANT.direccion}<br />
            TEL. {TENANT.telefono}
          </div>

          <div className="tkt-divider-dash" />

          {loadingCorte ? (
            <div className="tkt-center" style={{ padding: '20px 0' }}>Generando corte...</div>
          ) : errorCorte ? (
            <div className="tkt-center" style={{ padding: 16, color: '#b91c1c' }}>
              ⚠️ {errorCorte}<br />
              <small>Ejecuta <code>bench restart</code> en el backend.</small>
            </div>
          ) : datosCorte ? (
            <>
              {esRango ? (
                <div className="tkt-row">
                  <span>PERÍODO:</span>
                  <span>{fmtFecha(rangoInicio)} al {fmtFecha(rangoFin)}</span>
                </div>
              ) : (
                <div className="tkt-row">
                  <span>FECHA:</span>
                  <span>{fmtFecha(rangoInicio)}</span>
                </div>
              )}
              <div className="tkt-row">
                <span>HORA CORTE:</span>
                <span>{new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="tkt-row">
                <span>No. VENTAS:</span>
                <span>{datosCorte.num_transacciones}</span>
              </div>

              <div className="tkt-divider-eq" />
              <div className="tkt-center tkt-section-title">** CORTE DE CAJA **</div>
              <div className="tkt-divider-eq" />

              <div className="tkt-subtitle">FORMA DE PAGO</div>
              <div className="tkt-divider-dash" />
              {datosCorte.por_forma_pago.length === 0 ? (
                <div className="tkt-center tkt-muted">Sin movimientos</div>
              ) : (
                datosCorte.por_forma_pago.map(fp => (
                  <div key={fp.forma_pago} className="tkt-row">
                    <span>{fmtModoPago(fp.forma_pago).toUpperCase()}:</span>
                    <span>{fmt(fp.total)}</span>
                  </div>
                ))
              )}

              <div className="tkt-divider-dash" />

              <div className="tkt-subtitle">VENTAS POR CATEGORÍA</div>
              <div className="tkt-divider-dash" />
              {datosCorte.por_departamento.length === 0 ? (
                <div className="tkt-center tkt-muted">Sin datos</div>
              ) : (
                datosCorte.por_departamento.map(dep => (
                  <div key={dep.departamento} className="tkt-row">
                    <span>{dep.departamento}:</span>
                    <span>{fmt(dep.total)}</span>
                  </div>
                ))
              )}

              <div className="tkt-divider-eq" />

              <div className="tkt-row tkt-total">
                <span>TOTAL DEL DÍA:</span>
                <span>{fmt(datosCorte.total_ventas)}</span>
              </div>

              <div className="tkt-divider-eq" />

              <div className="tkt-center tkt-thanks">GRACIAS POR SU COMPRA</div>
              <div className="tkt-center tkt-muted" style={{ marginTop: 4 }}>
                {TENANT.web}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default POSModalCorte;
