import { useEffect, useRef, useState } from 'react';
import { ventasService } from '../services/frappeSales';
import { esSucursalInterna } from '../config/clientesB2B';

export default function BuscadorCliente({ value, onChange, grande = false, disabled = false }) {
  const [busqueda, setBusqueda] = useState(value?.label || '');
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setBusqueda(value?.label || '');
  }, [value?.label]);

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
      const res = await ventasService.buscarClientes(texto);
      // Filtra sucursales internas — destino Stock Entry, NO clientes B2B reales.
      setSugerencias(res.filter(c => !esSucursalInterna(c.name)));
      setAbierto(true);
    }, 500);
  };

  const seleccionar = (cli) => {
    setBusqueda(cli.customer_name);
    onChange({ name: cli.name, label: cli.customer_name });
    setAbierto(false);
    setCursor(-1);
  };

  const handleKeyDown = (e) => {
    if (!abierto || !sugerencias.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => {
        const next = Math.min(c + 1, sugerencias.length - 1);
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => {
        const prev = Math.max(c - 1, 0);
        listRef.current?.children[prev]?.scrollIntoView({ block: 'nearest' });
        return prev;
      });
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
      <input
        type="text"
        className={grande ? 'nc-buscar-input grande' : 'nc-buscar-input'}
        value={busqueda}
        onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => sugerencias.length && setAbierto(true)}
        placeholder="Buscar cliente..."
        disabled={disabled}
      />
      {abierto && sugerencias.length > 0 && (
        <div className="nc-dropdown" ref={listRef}>
          {sugerencias.map((c, i) => (
            <div
              key={c.name}
              className={`nc-dropdown-item${i === cursor ? ' nc-dropdown-item--active' : ''}`}
              onMouseDown={() => seleccionar(c)}
            >
              <div className="d-name">{c.customer_name}</div>
              <div className="d-sub">{c.customer_group || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
