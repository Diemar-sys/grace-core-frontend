import { useEffect, useMemo, useState } from 'react';
import { ventasService } from '../services/frappeSales';

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Modal para registrar pago consolidado contra facturas pendientes de un cliente.
 *
 * Asignación FIFO automática: el monto entrado se reparte de la SI más antigua
 * a la más nueva. Usuario puede editar el allocated por SI.
 */
export default function ModalRegistrarPago({ grupo, onSuccess, onCancel }) {
  const [montoStr, setMontoStr] = useState(String(grupo.totalDeuda.toFixed(2)));
  const [alloc, setAlloc] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // FIFO: asigna monto desde la SI más antigua hacia adelante
  useEffect(() => {
    const monto = parseFloat(montoStr || 0);
    if (monto <= 0) { setAlloc({}); return; }
    let restante = monto;
    const next = {};
    grupo.facturas.forEach(f => {
      if (restante <= 0) { next[f.name] = '0'; return; }
      const aplicar = Math.min(restante, parseFloat(f.outstanding_amount || 0));
      next[f.name] = aplicar.toFixed(2);
      restante = round2(restante - aplicar);
    });
    setAlloc(next);
  }, [montoStr, grupo.facturas]);

  const totalAsignado = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + parseFloat(v || 0), 0),
    [alloc]
  );
  const monto = parseFloat(montoStr || 0);
  const diferencia = round2(monto - totalAsignado);

  const handleAllocChange = (name, value) => {
    setAlloc(prev => ({ ...prev, [name]: value }));
  };

  const handleConfirmar = async () => {
    setError('');
    if (monto <= 0) { setError('Monto inválido'); return; }
    if (Math.abs(diferencia) > 0.01) {
      setError(`Monto pagado (${fmt(monto)}) no coincide con asignado (${fmt(totalAsignado)})`);
      return;
    }
    const facturas = grupo.facturas
      .map(f => ({ name: f.name, allocated: parseFloat(alloc[f.name] || 0) }))
      .filter(f => f.allocated > 0);
    if (!facturas.length) { setError('Asigna monto a alguna factura'); return; }
    setLoading(true);
    try {
      await ventasService.registrarPago({
        customer: grupo.customer,
        facturas,
        monto,
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Error registrando pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nc-modal-overlay">
      <div className="nc-pdf-preview-modal" style={{ maxWidth: 720 }}>
        <div className="nc-pdf-modal-header">
          <span>💰 Registrar pago — {grupo.customer_name}</span>
          <button className="nc-btn-close" onClick={onCancel}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          {error && <div className="nc-alert nc-alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Monto pagado:</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={montoStr}
              onChange={e => setMontoStr(e.target.value)}
              style={{
                padding: '8px 12px', fontSize: 16, fontWeight: 700,
                border: '1px solid #d1d5db', borderRadius: 6, width: 160,
              }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              Deuda total: <strong>${fmt(grupo.totalDeuda)}</strong>
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            Asignación FIFO (de más antigua a más nueva). Editable por fila.
          </p>

          <table className="sys-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th># Venta</th>
                <th className="cell-right">Total SI</th>
                <th className="cell-right">Saldo</th>
                <th className="cell-right">Asignar</th>
              </tr>
            </thead>
            <tbody>
              {grupo.facturas.map(f => (
                <tr key={f.name}>
                  <td>{f.posting_date}</td>
                  <td className="cell-code">
                    {f.custom_no_de_venta ? `#${f.custom_no_de_venta}` : f.name}
                  </td>
                  <td className="cell-right">${fmt(f.grand_total)}</td>
                  <td className="cell-right">${fmt(f.outstanding_amount)}</td>
                  <td className="cell-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={f.outstanding_amount}
                      value={alloc[f.name] || ''}
                      onChange={e => handleAllocChange(f.name, e.target.value)}
                      style={{
                        padding: '4px 8px', fontSize: 14, width: 110, textAlign: 'right',
                        border: '1px solid #d1d5db', borderRadius: 4,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                <td colSpan={3}></td>
                <td className="cell-right">Asignado:</td>
                <td className="cell-right" style={{
                  color: Math.abs(diferencia) > 0.01 ? '#dc2626' : '#16a34a',
                }}>
                  ${fmt(totalAsignado)}
                  {Math.abs(diferencia) > 0.01 && (
                    <div style={{ fontSize: 11, fontWeight: 400 }}>
                      {diferencia > 0 ? `faltan $${fmt(diferencia)}` : `sobran $${fmt(-diferencia)}`}
                    </div>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="nc-sugerencia-actions" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button
            className="nc-btn-primary"
            onClick={handleConfirmar}
            disabled={loading || Math.abs(diferencia) > 0.01 || monto <= 0}
          >
            {loading ? 'Registrando...' : `Registrar pago $${fmt(monto)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
