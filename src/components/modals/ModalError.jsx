import '../../styles/global.css';
/**
 * ModalError Component
 *
 * Muestra un modal de error crítico o advertencia que superpone la UI.
 * Útil para mostrar errores devueltos por Frappe (ej. códigos duplicados)
 * que requieren atención inmediata del usuario.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Visibilidad del modal
 * @param {string} [props.title="ADVERTENCIA"] - Título rojo
 * @param {string} props.message - El mensaje central del error (acepta saltos de línea)
 * @param {string} [props.type="error"] - "error", "success-create" (doble check), "success-update" (check en cuadro)
 * @param {Function} props.onClose - Handler invocado para descartar la alerta
 * @returns {JSX.Element|null} El contenedor o render null si `!isOpen`
 */
function ModalError({ isOpen, title, message, type = "error", onClose, onConfirm, confirmLabel, cancelLabel }) {
  if (!isOpen) return null;

  const isSuccess = type.startsWith("success");
  const defaultTitle = isSuccess ? "ÉXITO" : "ADVERTENCIA";
  const iconColor = isSuccess ? "#16a34a" : "#dc2626"; // Green for success, deep red for error
  const titleColor = isSuccess ? "#16a34a" : "#92400e"; // Darker green for success, darker orange for error

  const renderIcon = () => {
    const svgProps = {
      xmlns: "http://www.w3.org/2000/svg",
      width: 50, height: 50,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: iconColor,
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    };
    switch (type) {
      case 'success-create':
        return (
          <svg {...svgProps}>
            <path d="M18 6 7 17l-5-5" />
            <path d="m22 10-7.5 7.5L13 16" />
          </svg>
        );
      case 'success-update':
        return (
          <svg {...svgProps}>
            <path d="M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344" />
            <path d="m9 11 3 3L22 4" />
          </svg>
        );
      case 'error':
      default:
        return (
          <svg {...svgProps}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        );
    }
  };

  return (
    <div className="edit-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className={`del-modal modal-aviso ${isSuccess ? 'modal-success' : 'modal-error'}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-aviso-icon">
          {renderIcon()}
        </div>
        <h3 style={{ color: titleColor }}>{title || defaultTitle}</h3>
        <p className="modal-aviso-mensaje">{message}</p>
        <div className="del-modal-actions" style={{ marginTop: '24px' }}>
          {onConfirm ? (
            <>
              <button className="del-btn-cancel" onClick={onClose}
                style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>
                {cancelLabel || 'Cancelar'}
              </button>
              <button className="del-btn-disable" onClick={onConfirm} autoFocus>
                {confirmLabel || 'Aceptar'}
              </button>
            </>
          ) : (
            <button className="del-btn-disable" onClick={onClose} autoFocus>
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalError;
