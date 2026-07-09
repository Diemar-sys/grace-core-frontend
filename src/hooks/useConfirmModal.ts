import { useState } from 'react';

interface ConfirmModalOpts<T> {
  onSuccess?: () => void;
  fallbackAction?: (item: T | null) => Promise<void>;
}

/**
 * Hook para modales de confirmación con acción asíncrona.
 * `fallbackAction` se muestra cuando `action` falla (ej. deshabilitar en vez de eliminar).
 */
function useConfirmModal<T = unknown>(
  action: (item: T | null) => Promise<void>,
  { onSuccess, fallbackAction }: ConfirmModalOpts<T> = {},
) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const open  = (target: T): void => { setItem(target); setError(''); };
  const close = (): void => { setItem(null); setError(''); };

  const confirm = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      await action(item);
      close();
      onSuccess?.();
    } catch (err) {
      setError((err as Error)?.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const confirmFallback = fallbackAction
    ? async (): Promise<void> => {
        setLoading(true);
        try {
          await fallbackAction(item);
          close();
          onSuccess?.();
        } catch (err) {
          setError((err as Error)?.message || 'Error desconocido');
        } finally {
          setLoading(false);
        }
      }
    : undefined;

  return { item, loading, error, open, close, confirm, confirmFallback };
}

export default useConfirmModal;
