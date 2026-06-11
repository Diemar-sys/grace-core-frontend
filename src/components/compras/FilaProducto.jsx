import React, { useState, useRef, useEffect } from 'react';
import { comprasService } from '../../services/frappePurchase';
import { fmtUom } from '../../utils/uom';
import { fmt, totalPorFila, impuestoFila, totalFila, calcVariacion } from './compraUtils';

function FilaProducto({ fila, margen, onChange, onImpuesto, onEliminar, onFocusNext, inputRef, soloUna }) {
  const [busqueda, setBusqueda] = useState(fila.item_name || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);
  const listRef  = useRef(null);
  const bultosRef = useRef(null);
  const rateRef   = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleBusqueda = (texto) => {
    setBusqueda(texto);
    setCursor(-1);
    if (!texto) { onChange({ item_code: '', item_name: '' }); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await comprasService.buscarItems(texto);
      setSugerencias(res); setAbierto(true);
    }, 500);
  };

  const handleItemKeyDown = (e) => {
    if (!abierto || !sugerencias.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => { const next = Math.min(c + 1, sugerencias.length - 1); listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' }); return next; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => { const prev = Math.max(c - 1, 0); listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' }); return prev; });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = cursor >= 0 ? cursor : 0;
      if (sugerencias[idx]) seleccionar(sugerencias[idx]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  const seleccionar = (item) => {
    setBusqueda(item.item_name);
    const precioCatalogo = item.custom_precio_de_compra || '';
    onChange({
      item_code:       item.item_code,
      item_name:       item.item_name,
      uom:             item.stock_uom,
      kg_por_bulto:    item.custom_cantidad_por_presentación || '',
      precio_por_kg:   item.custom_precio_por_kg || '',
      precio_catalogo: precioCatalogo,
      ...(precioCatalogo ? { rate: String(precioCatalogo) } : {}),
    });
    onImpuesto(item.custom_impuesto || 'tasa0');
    setAbierto(false);
    setCursor(-1);
    setTimeout(() => { bultosRef.current?.focus(); bultosRef.current?.select(); }, 0);
  };

  const total        = totalPorFila(fila);
  const impMonto     = impuestoFila(fila);
  const totalConImp  = totalFila(fila);
  const uomLabel     = fmtUom(fila.uom || 'unid');
  const variacion    = calcVariacion(fila);
  const superaMargen = variacion && margen > 0 && Math.abs(variacion.diff) > margen;

  return (
    <tr className={superaMargen ? 'nc-fila-alerta' : ''}>

      <td>
        <div className="nc-buscador-wrap" ref={wrapRef}>
          <input className="nc-buscar-input" type="text" value={busqueda}
            ref={inputRef}
            title={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            onKeyDown={handleItemKeyDown}
            placeholder="Buscar producto..."
            onFocus={() => sugerencias.length && setAbierto(true)} />
          {abierto && sugerencias.length > 0 && (
            <div className="nc-dropdown" ref={listRef}>
              {sugerencias.map((item, i) => (
                <div key={item.item_code}
                  className={`nc-dropdown-item${i === cursor ? ' nc-dropdown-item--active' : ''}`}
                  onMouseDown={() => seleccionar(item)}>
                  <div className="d-name">{item.item_name}</div>
                  <div className="d-sub">{item.item_group} — {item.item_code}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>

      <td>
        <input className="nc-input cantidad" type="number" min="0" step="0.01"
          ref={bultosRef}
          value={fila.bultos} onChange={e => onChange({ bultos: e.target.value })} placeholder="0"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rateRef.current?.focus(); rateRef.current?.select(); } }} />
      </td>

      <td>
        {fila.kg_por_bulto
          ? <span className="nc-catalog-val">{fila.kg_por_bulto} {uomLabel}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      <td>
        {total > 0
          ? <span className="nc-kg-badge">{Number(total).toFixed(2)} {uomLabel}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      <td>
        {fila.precio_catalogo
          ? <span className="nc-precio-fijo">${parseFloat(fila.precio_catalogo).toFixed(2)}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      <td>
        <input
          className={`nc-input precio ${superaMargen ? 'nc-input-alerta' : variacion?.cambio ? 'nc-input-cambiado' : ''}`}
          type="number" min="0" step="0.000001"
          ref={rateRef}
          value={fila.rate}
          onChange={e => onChange({ rate: e.target.value })}
          placeholder="0.00"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFocusNext?.(); } }}
        />
      </td>

      <td className="nc-td-diff">
        {variacion?.cambio ? (
          <span className={`nc-var-badge-sm ${superaMargen
            ? 'nc-var-alerta'
            : variacion.diff > 0 ? 'nc-var-sube' : 'nc-var-baja'
            }`}>
            {variacion.diff > 0 ? '▲' : '▼'}
            {' '}{Math.abs(variacion.pct).toFixed(1)}%
            {' '}(${fmt(Math.abs(variacion.diff))})
            {superaMargen && ' ⚠️'}
          </span>
        ) : (
          <span className="nc-uom-empty">—</span>
        )}
      </td>

      <td>
        <span className={`nc-imp-badge nc-imp-${fila.impuesto_key}`}>
          {fila.impuesto_label || 'Tasa 0'}
          {impMonto > 0 && <> — ${fmt(impMonto)}</>}
        </span>
      </td>

      <td><span className="nc-subtotal">${fmt(totalConImp)}</span></td>

      <td>
        <button className="nc-btn-eliminar" onClick={onEliminar}
          disabled={soloUna} title="Eliminar">×</button>
      </td>
    </tr>
  );
}

export default FilaProducto;
