import { useEffect, useRef, useState } from 'react';
import { ventasService } from '../services/frappeSales';
import { esSucursalInterna } from '../config/clientesB2B';

/**
 * Selector/buscador de clientes B2B. Pre-carga TODOS los clientes al montar
 * (lista típica: DELI, ZAKIA, DULCE CARAMEL — pocos, sin paginación).
 * - Click sin texto → muestra lista completa para seleccionar
 * - Typing → filtra in-memory contra lista pre-cargada
 * - Sucursales internas se excluyen (no son clientes reales)
 */
export default function BuscadorCliente({ value, onChange, grande = false, disabled = false }) {
  const [busqueda, setBusqueda] = useState(value?.label || '');
  const [todos, setTodos] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setBusqueda(value?.label || '');
  }, [value?.label]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await ventasService.buscarClientes('');
        if (cancel) return;
        setTodos(res.filter(c => !esSucursalInterna(c.name)));
      } catch (err) {
        console.error('Error cargando clientes:', err);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sugerencias = busqueda
    ? todos.filter(c =>
        (c.customer_name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (c.name || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : todos;

  const handleInput = (texto) => {
    setBusqueda(texto);
    setCursor(-1);
    if (!texto) onChange({ name: '', label: '' });
    setAbierto(true);
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
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        placeholder="Selecciona o busca cliente..."
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
              {c.customer_group && <div className="d-sub">{c.customer_group}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
