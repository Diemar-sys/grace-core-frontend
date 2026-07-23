import { useMemo, useState } from 'react';
import { ventasService } from '../../services/frappeSales';

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Modal para registrar pago contra facturas pendientes de un cliente.
 *
 * Selección por checkbox: marca las facturas que ya te pagaron (o edita el monto
 * por fila para pagos parciales). Arranca vacío; se cobra exactamente lo asignado.
 */
export default function ModalRegistrarPago({ grupo, onSuccess, onCancel }) {
  const [alloc, setAlloc] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAsignado = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + parseFloat(v || 0), 0),
    [alloc]
  );
  const handleAllocChange = (name, value) => {
    setAlloc(prev => ({ ...prev, [name]: value }));
  };

  // Checkbox por fila: marcar = pagar el saldo COMPLETO de esa factura; desmarcar = 0.
  // Permite elegir "esta ya me la pagó" sin depender del FIFO.
  const toggleFactura = (f) => {
    const pagada = parseFloat(alloc[f.name] || 0) > 0;
    setAlloc(prev => ({ ...prev, [f.name]: pagada ? '0' : String(f.outstanding_amount) }));
  };

  const handleConfirmar = async () => {
    setError('');
    const facturas = grupo.facturas
      .map(f => ({ name: f.name, allocated: parseFloat(alloc[f.name] || 0) }))
      .filter(f => f.allocated > 0);
    if (!facturas.length) { setError('Marca o asigna monto a alguna factura'); return; }
    // El pago es EXACTAMENTE lo asignado (no un monto fijo aparte). Así se puede pagar
    // una factura específica aunque sea más reciente, sin quedar bloqueado por FIFO.
    const pagoTotal = round2(facturas.reduce((s, f) => s + f.allocated, 0));
    setLoading(true);
    try {
      await ventasService.registrarPago({
        customer: grupo.customer,
        facturas,
        monto: pagoTotal,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>
              Deuda total: <strong>${fmt(grupo.totalDeuda)}</strong>
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            Marca las facturas que ya te pagaron (o edita el monto por fila para pagos
            parciales). Se cobra exactamente lo asignado.
          </p>

          <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
          <table className="sys-table">
            <thead>
              <tr>
                <th style={{ width: 34, position: 'sticky', top: 0 }}>✓</th>
                <th style={{ position: 'sticky', top: 0 }}>Fecha</th>
                <th style={{ position: 'sticky', top: 0 }}># Venta</th>
                <th className="cell-right" style={{ position: 'sticky', top: 0 }}>Total SI</th>
                <th className="cell-right" style={{ position: 'sticky', top: 0 }}>Saldo</th>
                <th className="cell-right" style={{ position: 'sticky', top: 0 }}>Asignar</th>
              </tr>
            </thead>
            <tbody>
              {grupo.facturas.map(f => (
                <tr key={f.name}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={parseFloat(alloc[f.name] || 0) > 0}
                      onChange={() => toggleFactura(f)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </td>
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
                <td colSpan={4}></td>
                <td className="cell-right">Se cobra:</td>
                <td className="cell-right" style={{ color: '#16a34a' }}>
                  ${fmt(totalAsignado)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

        <div className="nc-sugerencia-actions" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <button className="nc-btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button
            className="nc-btn-primary"
            onClick={handleConfirmar}
            disabled={loading || totalAsignado <= 0}
          >
            {loading ? 'Registrando...' : `Registrar pago $${fmt(totalAsignado)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
