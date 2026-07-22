import { useState, useEffect, useMemo } from 'react';
import { inventory } from '../services/frappeInventory';
import { stockService } from '../services/frappeStock';
import { parseErrorFrappe } from '../utils/errorFrappe';
import ModalError from './modals/ModalError';
import '../styles/NuevaCompra.css';

// Factor presentación→base (Bulto de 25kg → 25; Caja de 0.86kg → 0.86).
// 1 solo si no hay presentación o factor inválido: ese ya está en base, no se multiplica.
export const presFactor = it => {
  const f = parseFloat(it?.custom_cantidad_por_presentación);
  return f > 0 && f !== 1 ? f : 1;
};
// Unidad en la que se captura/muestra: presentación si la tiene, si no la base.
export const presUnit = it =>
  presFactor(it) !== 1 && it?.custom_presentación ? it.custom_presentación : (it?.stock_uom || 'Kg');

// Líneas del ajuste = conteos en BASE que DIFIEREN del stock del sistema.
// ponytail: ERPNext borra los ítems sin cambio en el Stock Reconciliation; si TODOS coinciden
// truena EmptyStockReconciliationItemsError. Filtramos aquí los que ya cuadran (solo compara qty;
// el conteo no toca valuation_rate). Epsilon 0.001 = el step del input.
export function lineasAjuste(conteo, items) {
  const out = [];
  for (const [item_code, v] of Object.entries(conteo)) {
    if (v === '') continue;
    const it = items.find(i => i.item_code === item_code);
    const qty = parseFloat(v) * presFactor(it);
    const actual = parseFloat(it?.actual_qty) || 0;
    if (Math.abs(qty - actual) > 0.001) out.push({ item_code, qty });
  }
  return out;
}

function ConteoFisico({ onSuccess, onCancel }) {
  const [items, setItems]     = useState([]);
  const [conteo, setConteo]   = useState({});
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState(null);
  const [pidiendoPass, setPidiendoPass] = useState(false);
  const [password, setPassword]         = useState('');
  const [passError, setPassError]       = useState(null);

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

  // Paso 1: valida que haya diferencias reales antes de pedir la contraseña.
  const revisar = () => {
    setError(null);
    // Stock Reconciliation guarda qty en base y SOLO acepta ítems con diferencia real.
    if (!lineasAjuste(conteo, items).length) {
      setError('El conteo coincide con el stock del sistema: no hay diferencias que ajustar.');
      return;
    }
    setPassword('');
    setPassError(null);
    setPidiendoPass(true);
  };

  // Paso 2: el backend valida rol Gerente + esta contraseña antes de aplicar el ajuste.
  const confirmar = async () => {
    const lineas = lineasAjuste(conteo, items);
    if (!lineas.length || !password) return;
    setSending(true);
    setPassError(null);
    try {
      await stockService.crearConteoFisico({ items: lineas, password });
      onSuccess?.();
    } catch (e) {
      setPassError(parseErrorFrappe(e)); // inline en el modal → permite reintentar
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
                <th style={{ textAlign: 'center', width: 80 }}>UOM</th>
                <th style={{ textAlign: 'right', width: 90 }}>Stock ERP</th>
                <th style={{ textAlign: 'center', width: 110 }}>Conteo físico</th>
                <th style={{ textAlign: 'right', width: 80 }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(it => {
                const factor    = presFactor(it);
                const unit      = presUnit(it);
                const erpQty    = (parseFloat(it.actual_qty) || 0) / factor; // base → presentación
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
                      {unit}
                      {factor !== 1 && (
                        <div style={{ fontSize: 11, color: 'var(--tv-ink-soft)' }}>
                          ×{factor} {it.stock_uom || 'Kg'}
                        </div>
                      )}
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
          onClick={revisar}
          disabled={sending || pendientes === 0}
          style={pendientes > 0 ? { background: 'var(--tv-marca-deep)', color: '#fff', borderColor: 'var(--tv-marca-deep)' } : {}}
        >
          {sending ? 'Aplicando…' : `Aplicar conteo (${pendientes} items)`}
        </button>
      </div>

      {pidiendoPass && (
        <div className="edit-overlay" onClick={e => e.target === e.currentTarget && !sending && setPidiendoPass(false)}>
          <div className="del-modal">
            <h3>Confirmar ajuste de inventario</h3>
            <p>Ajustar el stock queda registrado a tu nombre. Escribe tu contraseña para continuar.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && password && !sending) confirmar(); }}
              placeholder="Tu contraseña"
              style={{ width: '100%', padding: '10px 14px', marginTop: 8, borderRadius: 12, border: '1px solid var(--tv-line, #e2ddd4)', boxSizing: 'border-box' }}
            />
            {passError && <p style={{ color: 'var(--tv-stop)', marginTop: 10, fontSize: 14 }}>{passError}</p>}
            <div className="del-modal-actions" style={{ marginTop: 16 }}>
              <button className="del-btn-cancel" onClick={() => setPidiendoPass(false)} disabled={sending}>
                Cancelar
              </button>
              <button className="del-btn-confirm" onClick={confirmar} disabled={sending || !password}>
                {sending ? 'Aplicando…' : 'Ajustar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <ModalError mensaje={error} onClose={() => setError(null)} />}
    </div>
  );
}

export default ConteoFisico;
