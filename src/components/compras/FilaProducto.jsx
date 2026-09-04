import { useState, useRef, useEffect } from 'react';
import { comprasService } from '../../services/frappePurchase';
import { fmtUom } from '../../utils/uom';
import { cantidad, pesos } from '../../utils/formato';
import { revisarCostoUnitario, costoPorUnidadBase } from '../../utils/costoAnomalo';
import { convertir } from '../CantidadDual';
import { fmt, totalPorFila, impuestoFila, totalFila, calcVariacion, partirImpuesto } from './compraUtils';

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
  // Lo tecleado TAL CUAL en el campo de Kg mientras tiene el foco. La verdad de
  // la compra siguen siendo los BULTOS (el rate es por bulto); los Kg son una
  // vista. Sin este borrador, teclear "57.5" muere en el punto.
  const [kgTecleado, setKgTecleado] = useState(null);

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
      presentacion:    item.custom_presentación || '',
      kg_por_bulto:    item.custom_cantidad_por_presentación || '',
      precio_por_kg:   item.custom_precio_por_kg || '',
      precio_catalogo: precioCatalogo,
      costo_historico: item.costo_historico ?? null,
      costo_muestras:  item.costo_muestras ?? 0,
      ...(precioCatalogo ? { rate: String(precioCatalogo) } : {}),
    });
    onImpuesto(item.custom_impuesto || 'tasa0');
    setAbierto(false);
    setCursor(-1);
    setTimeout(() => { bultosRef.current?.focus(); bultosRef.current?.select(); }, 0);
  };

  const total        = totalPorFila(fila);
  const impMonto     = impuestoFila(fila);
  const [impNombre, impTasa] = partirImpuesto(fila.impuesto_label);
  const totalConImp  = totalFila(fila);
  const uomLabel     = fmtUom(fila.uom || 'unid');
  const variacion    = calcVariacion(fila);
  const superaMargen = variacion && margen > 0 && Math.abs(variacion.diff) > margen;
  // Contra la HISTORIA del item y en unidad base: es lo que ve el error de UOM,
  // que la alerta de margen no puede ver porque compara presentaciones.
  const revCosto     = revisarCostoUnitario(
    costoPorUnidadBase(fila.rate, fila.kg_por_bulto), fila.costo_historico, fila.costo_muestras);

  return (
    <tr className={superaMargen || revCosto?.nivel === 'bloqueo' ? 'nc-fila-alerta' : ''}>

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
        <label className="nc-dual-campo">
          <input className="nc-input cantidad" type="number" min="0" step="0.000001"
            ref={bultosRef}
            value={fila.bultos} onChange={e => onChange({ bultos: e.target.value })} placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rateRef.current?.focus(); rateRef.current?.select(); } }} />
          <span className="nc-dual-unidad">{fila.presentacion || uomLabel}</span>
        </label>
      </td>

      <td>
        {fila.kg_por_bulto
          ? <span className="nc-catalog-val">{cantidad(fila.kg_por_bulto)} {uomLabel}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      <td>
        {/* Se compra por bulto, pero a veces se sabe el peso y no los bultos.
            Este campo captura Kg y devuelve los bultos: misma verdad, dos
            entradas, como margen ↔ precio de venta en el alta de producto. */}
        {fila.kg_por_bulto ? (
          <label className="nc-dual-campo">
            <input className="nc-input cantidad" type="number" min="0" step="0.000001"
              value={kgTecleado ?? (fila.bultos === '' ? '' : convertir(String(fila.bultos), fila.kg_por_bulto, 'base'))}
              onChange={e => {
                setKgTecleado(e.target.value);
                onChange({ bultos: convertir(e.target.value, fila.kg_por_bulto, 'pres') });
              }}
              onBlur={() => setKgTecleado(null)}
              placeholder="0"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rateRef.current?.focus(); rateRef.current?.select(); } }} />
            <span className="nc-dual-unidad">{uomLabel}</span>
          </label>
        ) : total > 0
          ? <span className="nc-kg-badge">{cantidad(total)} {uomLabel}</span>
          : <span className="nc-uom-empty">—</span>}
      </td>

      <td>
        {fila.precio_catalogo
          ? <span className="nc-precio-fijo">{pesos(fila.precio_catalogo)}</span>
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
        ) : !revCosto || revCosto.nivel === 'ok' ? (
          <span className="nc-uom-empty">—</span>
        ) : null}

        {revCosto && revCosto.nivel !== 'ok' && (
          <span className={`nc-var-badge-sm ${revCosto.nivel === 'bloqueo' ? 'nc-var-alerta' : 'nc-var-baja'}`}
            title={`Este item ha costado ${pesos(revCosto.historico)} por ${uomLabel}. `
                 + `Lo capturado sale en ${pesos(costoPorUnidadBase(fila.rate, fila.kg_por_bulto))}. `
                 + `Revisa si la unidad es la correcta.`}>
            {revCosto.nivel === 'bloqueo' ? '🚫' : '⚠️'}
            {' '}{cantidad(revCosto.factor, 1)}× {revCosto.barato ? 'más barato' : 'más caro'} que su historial
          </span>
        )}
      </td>

      <td>
        <span className={`nc-imp-badge nc-imp-${fila.impuesto_key}`}>
          <span className="nc-imp-nombre">{impNombre}</span>
          {(impTasa || impMonto > 0) && (
            <span className="nc-imp-detalle">
              {impTasa}{impTasa && impMonto > 0 ? ' — ' : ''}{impMonto > 0 ? `$${fmt(impMonto)}` : ''}
            </span>
          )}
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
