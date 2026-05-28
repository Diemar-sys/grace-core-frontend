import React from 'react';

/**
 * Modal de confirmación genérico.
 *
 * Props:
 *  title            – Título del modal
 *  description      – Texto principal (acepta JSX)
 *  subdescription   – Texto secundario, gris pequeño (opcional)
 *  icon             – Elemento SVG a mostrar (opcional)
 *  iconStyle        – Style override para el contenedor del ícono (opcional)
 *  confirmLabel     – Texto del botón de confirmar
 *  loadingLabel     – Texto del botón cuando loading=true
 *  confirmClassName – Clase CSS del botón confirmar (default: 'del-btn-confirm')
 *  confirmStyle     – Style override del botón confirmar (opcional)
 *  cancelLabel      – Texto del botón cancelar (default: 'Cancelar')
 *  onConfirm        – Callback al confirmar
 *  onCancel         – Callback al cancelar / click fuera
 *  loading          – Deshabilita botones y muestra loadingLabel
 *  error            – Mensaje de error (string)
 *  onFallback       – Si hay error Y este prop existe, muestra acción alternativa
 *  fallbackLabel    – Texto del botón alternativo
 *  fallbackLoadingLabel – Texto cuando loading en fallback
 *  fallbackDescription  – Descripción extra dentro del área de error (acepta JSX)
 */
function ConfirmModal({
  title,
  description,
  subdescription,
  icon,
  iconStyle,
  confirmLabel = 'Confirmar',
  loadingLabel = 'Procesando...',
  confirmClassName,
  confirmStyle,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
  error,
  onFallback,
  fallbackLabel,
  fallbackLoadingLabel = 'Procesando...',
  fallbackDescription,
}) {
  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="del-modal">
        {icon && (
          <div className="del-modal-icon" style={iconStyle}>
            {icon}
          </div>
        )}
        <h3>{title}</h3>
        <p>{description}</p>
        {subdescription && <p className="del-modal-sub">{subdescription}</p>}

        {error && (
          <div className="del-modal-error">
            {onFallback ? (
              <>
                <p>{fallbackDescription}</p>
                <div className="del-modal-actions">
                  <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>
                    {cancelLabel}
                  </button>
                  <button className="del-btn-disable" onClick={onFallback} disabled={loading}>
                    {loading ? fallbackLoadingLabel : fallbackLabel}
                  </button>
                </div>
              </>
            ) : (
              <p>{error}</p>
            )}
          </div>
        )}

        {!error && (
          <div className="del-modal-actions">
            <button className="del-btn-cancel" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </button>
            <button
              className={confirmClassName || 'del-btn-confirm'}
              style={confirmStyle}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? loadingLabel : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfirmModal;
