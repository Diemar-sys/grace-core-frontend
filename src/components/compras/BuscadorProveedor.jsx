import React, { useState, useRef, useEffect } from 'react';
import { comprasService } from '../../services/frappePurchase';

function BuscadorProveedor({ value, onChange, grande = false }) {
  const [busqueda, setBusqueda] = useState(value.label || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = (texto) => {
    setBusqueda(texto);
    setCursor(-1);
    if (!texto) { onChange({ name: '', label: '' }); setSugerencias([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await comprasService.buscarProveedores(texto);
      setSugerencias(res); setAbierto(true);
    }, 500);
  };

  const seleccionar = (prov) => {
    setBusqueda(prov.supplier_name);
    onChange({ name: prov.name, label: prov.supplier_name });
    setAbierto(false);
    setCursor(-1);
  };

  const handleKeyDown = (e) => {
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

  return (
    <div className="nc-buscador-wrap" ref={wrapRef}>
      <input type="text" className={grande ? 'nc-buscar-input grande' : 'nc-buscar-input'}
        value={busqueda} onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar proveedor..."
        onFocus={() => sugerencias.length && setAbierto(true)} />
      {abierto && sugerencias.length > 0 && (
        <div className="nc-dropdown" ref={listRef}>
          {sugerencias.map((p, i) => (
            <div key={p.name}
              className={`nc-dropdown-item${i === cursor ? ' nc-dropdown-item--active' : ''}`}
              onMouseDown={() => seleccionar(p)}>
              <div className="d-name">{p.supplier_name}</div>
              <div className="d-sub">{p.supplier_group}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BuscadorProveedor;
