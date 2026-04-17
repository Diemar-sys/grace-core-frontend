import { useState } from 'react';

/**
 * Hook para modales de confirmación con acción asíncrona.
 *
 * @param {Function} action         - async (item) => void  — acción principal
 * @param {Object}   opts
 * @param {Function} opts.onSuccess - Callback tras éxito (ej. recargar lista)
 * @param {Function} opts.fallbackAction - async (item) => void — acción alternativa
 *                                         mostrada cuando `action` falla (ej. deshabilitar en lugar de eliminar)
 *
 * @returns {{ item, loading, error, open, close, confirm, confirmFallback }}
 */
function useConfirmModal(action, { onSuccess, fallbackAction } = {}) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const open  = (target) => { setItem(target); setError(''); };
  const close = ()       => { setItem(null);   setError(''); };

  const confirm = async () => {
    setLoading(true);
    setError('');
    try {
      await action(item);
      close();
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const confirmFallback = fallbackAction
    ? async () => {
        setLoading(true);
        try {
          await fallbackAction(item);
          close();
          onSuccess?.();
        } catch (err) {
          setError(err.message || 'Error desconocido');
        } finally {
          setLoading(false);
        }
      }
    : undefined;

  return { item, loading, error, open, close, confirm, confirmFallback };
}

export default useConfirmModal;
