import React, { useState, useEffect, useMemo } from 'react';
import { inventory } from '../services/frappeInventory';
import { stockService } from '../services/frappeStock';
import { parseErrorFrappe } from '../utils/errorFrappe';
import ModalError from './modals/ModalError';
import '../styles/NuevaCompra.css';

function ConteoFisico({ onSuccess, onCancel }) {
  const [items, setItems]     = useState([]);
  const [conteo, setConteo]   = useState({});
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    inventory.getProductosRegistrados({})
      .then(data => setItems(data.filter(i => !i.disabled)))
      .catch(e => setError(parseErrorFrappe(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter(i => i.item_name?.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q))
      : items;
  }, [items, search]);

  const pendientes = useMemo(
    () => Object.values(conteo).filter(v => v !== '').length,
    [conteo]
  );

  const handleSubmit = async () => {
    const lineas = Object.entries(conteo)
      .filter(([, v]) => v !== '')
      .map(([item_code, qty]) => ({ item_code, qty }));
    if (!lineas.length) return;
    setSending(true);
    try {
      await stockService.crearConteoFisico({ items: lineas });
      onSuccess?.();
    } catch (e) {
      setError(parseErrorFrappe(e));
    } finally {
      setSending(false);
    }
  };

  const setQty = (item_code, val) =>
    setConteo(prev => ({ ...prev, [item_code]: val }));

  return (
    <div className="nc-container">
      <div className="nc-header">
        <h2>Conteo Físico</h2>
        <button className="nc-btn-close" onClick={onCancel}>×</button>
      </div>

      <div className="nc-section-title">Productos a contar</div>

      <input
        type="text"
        placeholder="Buscar item..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
        style={{
          width: '100%', padding: '10px 14px', marginBottom: 14,
          border: '1px solid var(--color-border-input)', borderRadius: 8,
          fontSize: 15, fontFamily: 'inherit', color: 'var(--tv-ink)',
          background: 'var(--tv-surface)', boxSizing: 'border-box',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--tv-marca)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,80,60,.15)'; }}
        onBlur={e =>  { e.target.style.borderColor = 'var(--color-border-input)'; e.target.style.boxShadow = 'none'; }}
      />

      {loading ? (
        <p style={{ color: 'var(--tv-ink-soft)', padding: '20px 0' }}>Cargando inventario…</p>
      ) : (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
          <table className="nc-tabla">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'center', width: 60 }}>UOM</th>
                <th style={{ textAlign: 'right', width: 90 }}>Stock ERP</th>
                <th style={{ textAlign: 'center', width: 110 }}>Conteo físico</th>
                <th style={{ textAlign: 'right', width: 80 }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(it => {
                const erpQty    = parseFloat(it.actual_qty) || 0;
                const rawVal    = conteo[it.item_code] ?? '';
                const fisicoQty = rawVal !== '' ? parseFloat(rawVal) : null;
                const diff      = fisicoQty !== null ? fisicoQty - erpQty : null;
                const diffColor = diff === null ? 'var(--color-border)'
                  : diff > 0 ? 'var(--tv-ok)'
                  : diff < 0 ? 'var(--tv-stop)'
                  : 'var(--tv-ink-soft)';
                return (
                  <tr key={it.item_code}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--tv-ink)' }}>{it.item_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--tv-ink-soft)' }}>{it.item_code}</div>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--tv-ink-soft)', fontWeight: 500 }}>
                      {it.stock_uom || 'Kg'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--tv-ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {erpQty.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="—"
                        value={rawVal}
                        onChange={e => setQty(it.item_code, e.target.value)}
                        style={{
                          width: 90, textAlign: 'right', padding: '5px 8px',
                          border: '1px solid', borderColor: rawVal !== '' ? 'var(--tv-marca)' : 'var(--color-border-input)',
                          borderRadius: 6, fontSize: 14, fontFamily: 'inherit',
                          background: rawVal !== '' ? 'var(--tv-marca-wash)' : 'var(--tv-surface)',
                        }}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: diffColor, fontVariantNumeric: 'tabular-nums' }}>
                      {diff === null ? '—' : (diff >= 0 ? '+' : '') + diff.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--tv-ink-soft)' }}>
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="nc-actions">
        <button className="nc-btn-secondary" onClick={onCancel} disabled={sending}>
          Cancelar
        </button>
        <button
          className="nc-btn-primary"
          onClick={handleSubmit}
          disabled={sending || pendientes === 0}
          style={pendientes > 0 ? { background: 'var(--tv-marca-deep)', color: '#fff', borderColor: 'var(--tv-marca-deep)' } : {}}
        >
          {sending ? 'Aplicando…' : `Aplicar conteo (${pendientes} items)`}
        </button>
      </div>

      {error && <ModalError mensaje={error} onClose={() => setError(null)} />}
    </div>
  );
}

export default ConteoFisico;
