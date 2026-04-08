import React from 'react';
import '../styles/global.css';
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
function ModalError({ isOpen, title, message, type = "error", onClose }) {
  if (!isOpen) return null;

  const isSuccess = type.startsWith("success");
  const defaultTitle = isSuccess ? "ÉXITO" : "ADVERTENCIA";
  const iconColor = isSuccess ? "#16a34a" : "#dc2626"; // Green for success, deep red for error
  const titleColor = isSuccess ? "#16a34a" : "#92400e"; // Darker green for success, darker orange for error

  const renderIcon = () => {
    switch (type) {
      case 'success-create':
        // Double Check
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="modal-icon" fill="none" viewBox="0 0 24 24" stroke={iconColor} width="50" height="50">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M1 13l4 4L15 7" />
          </svg>
        );
      case 'success-update':
        // Check in square
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="modal-icon" fill="none" viewBox="0 0 24 24" stroke={iconColor} width="50" height="50">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
      default:
        // Alert Triangle
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="modal-icon" fill="none" viewBox="0 0 24 24" stroke={iconColor} width="50" height="50">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
          <button className="del-btn-disable" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalError;
