import { useState, useEffect } from 'react';

/**
 * Retrasa la actualización de un valor hasta que deja de cambiar.
 * Elimina el patrón manual de dos useState + setTimeout en buscadores.
 *
 * @param {*}      value - Valor a debouncear (generalmente el input del usuario)
 * @param {number} delay - Milisegundos de espera (default: 350)
 * @returns {*} Valor debounceado
 */
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
