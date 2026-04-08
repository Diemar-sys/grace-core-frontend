// src/components/NuevoProveedor.jsx
import React, { useState, useEffect } from 'react';
import { proveedores } from '../services/frappeSupplier';
import '../styles/NuevoProveedor.css';

const FORM_INICIAL = {
  supplier_name:           '',
  custom_alias:            '',
  custom_razon_social:     '',
  supplier_group:          '',
  custom_direccion:        '',
  custom_puesto_encargado: '',
  custom_teléfono:         '',
  custom_correo:           '',
  custom_tipo:             '',
  // Contacto principal
  custom_contacto_1_nombre:   '',
  custom_contacto_1_teléfono: '',
  custom_contacto_1_puesto:   '',
  // Contacto secundario
  custom_contacto_2_nombre:   '',
  custom_contacto_2_teléfono: '',
  custom_contacto_2_puesto:   '',
  // Meta
  disabled: false,
  custom_no_de_proveedor: '',
};

/**
 * Modal para registrar o editar un Proveedor y sus contactos asociados.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Function} props.onSuccess - Callback para recargar la lista de datos padre.
 * @param {Function} props.onCancel - Callback para cerrar el modal sin guardar.
 * @param {Object} [props.editItem=null] - Información preexistente del proveedor a editar.
 * @returns {JSX.Element} Formulario de Proveedor.
 */
function NuevoProveedor({ onSuccess, onCancel, editItem = null }) {
  const isEditing = !!editItem;

  const [formData, setFormData] = useState(FORM_INICIAL);
  const [grupos, setGrupos]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const g = await proveedores.getGruposProveedor();
        setGrupos(g);
      } catch (_) {}
    })();

    if (editItem) {
      setFormData({ ...FORM_INICIAL, ...editItem });
    } else {
      setFormData(FORM_INICIAL);
    }
  }, [editItem]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!formData.supplier_name?.trim()) {
      setError('El nombre del proveedor es obligatorio');
      setLoading(false);
      return;
    }

    try {
      let result;
      if (isEditing) {
        result = await proveedores.updateProveedor(editItem.name, formData);
        setSuccess(`✅ Proveedor "${formData.supplier_name}" actualizado`);
      } else {
        result = await proveedores.createProveedor(formData);
        setSuccess(`✅ Proveedor "${formData.supplier_name}" registrado`);
      }
      setTimeout(() => onSuccess?.(result), 1200);
    } catch (err) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-modal">
      <div className="np-container">

        {/* HEADER */}
        <div className="np-header">
          <h2>{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
          <button className="np-btn-close" type="button" onClick={onCancel}>×</button>
        </div>

        {error   && <div className="np-alert np-alert-error">{error}</div>}
        {success && <div className="np-alert np-alert-success">{success}</div>}

        <form onSubmit={handleSubmit} className="np-form">

          {/* ── DATOS GENERALES ── */}
          <div className="np-section">
            <h3>Datos del Proveedor</h3>

            <div className="np-row">
              {/* Número — solo en edición o si ya existe */}
              {formData.custom_no_de_proveedor && (
                <div className="np-group np-numero">
                  <label>No. Proveedor</label>
                  <input
                    type="text"
                    value={formData.custom_no_de_proveedor}
                    readOnly
                    className="np-input-readonly"
                  />
                </div>
              )}
              <div className="np-group np-full">
                <label>Nombre del Proveedor *</label>
                <input
                  type="text"
                  name="supplier_name"
                  value={formData.supplier_name}
                  onChange={handleChange}
                  placeholder="Ej: Distribuidora García"
                  required
                />
              </div>
            </div>

            <div className="np-row">
              <div className="np-group">
                <label>Alias</label>
                <input
                  type="text"
                  name="custom_alias"
                  value={formData.custom_alias}
                  onChange={handleChange}
                  placeholder="Nombre corto para identificarlo"
                />
              </div>
              <div className="np-group">
                <label>Razón Social</label>
                <input
                  type="text"
                  name="custom_razon_social"
                  value={formData.custom_razon_social}
                  onChange={handleChange}
                  placeholder="Ej: DISTRIBUIDORA GARCIA S.A. DE C.V."
                />
              </div>
            </div>

            <div className="np-row">
              <div className="np-group np-full">
                <label>Dirección</label>
                <input
                  type="text"
                  name="custom_direccion"
                  value={formData.custom_direccion}
                  onChange={handleChange}
                  placeholder="Ej: Av. Constitución 123, Col. Centro, Querétaro"
                />
              </div>
            </div>

            <div className="np-row">
              <div className="np-group">
                <label>Puesto del encargado</label>
                <input
                  type="text"
                  name="custom_puesto_encargado"
                  value={formData.custom_puesto_encargado}
                  onChange={handleChange}
                  placeholder="Ej: Gerente de ventas"
                />
              </div>
              <div className="np-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  name="custom_teléfono"
                  value={formData.custom_teléfono}
                  onChange={handleChange}
                  placeholder="Ej: 442 123 4567"
                />
              </div>
            </div>

            <div className="np-row">
              <div className="np-group">
                <label>Correo de la empresa</label>
                <input
                  type="email"
                  name="custom_correo"
                  value={formData.custom_correo}
                  onChange={handleChange}
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div className="np-group">
                <label>Tipo</label>
                <select name="custom_tipo" value={formData.custom_tipo} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="Gasto">GASTO</option>
                  <option value="Costo">COSTO</option>
                </select>
              </div>
              <div className="np-group">
                <label>Grupo</label>
                <select name="supplier_group" value={formData.supplier_group} onChange={handleChange}>
                  <option value="">Sin grupo</option>
                  {grupos.map(g => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── CONTACTOS ── */}
          <div className="np-section np-contactos-grid">

            {/* Contacto principal */}
            <div className="np-contacto-col">
              <h3>Contacto Principal</h3>
              <div className="np-group">
                <label>Nombre</label>
                <input
                  type="text"
                  name="custom_contacto_1_nombre"
                  value={formData.custom_contacto_1_nombre}
                  onChange={handleChange}
                  placeholder="Ej: Carlos García"
                />
              </div>
              <div className="np-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  name="custom_contacto_1_teléfono"
                  value={formData.custom_contacto_1_teléfono}
                  onChange={handleChange}
                  placeholder="Ej: 442 123 4567"
                />
              </div>
              <div className="np-group">
                <label>Puesto</label>
                <input
                  type="text"
                  name="custom_contacto_1_puesto"
                  value={formData.custom_contacto_1_puesto}
                  onChange={handleChange}
                  placeholder="Ej: Asesor comercial"
                />
              </div>
            </div>

            {/* Contacto secundario */}
            <div className="np-contacto-col">
              <h3>Contacto Secundario</h3>
              <div className="np-group">
                <label>Nombre</label>
                <input
                  type="text"
                  name="custom_contacto_2_nombre"
                  value={formData.custom_contacto_2_nombre}
                  onChange={handleChange}
                  placeholder="Ej: María López"
                />
              </div>
              <div className="np-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  name="custom_contacto_2_teléfono"
                  value={formData.custom_contacto_2_teléfono}
                  onChange={handleChange}
                  placeholder="Ej: 442 987 6543"
                />
              </div>
              <div className="np-group">
                <label>Puesto</label>
                <input
                  type="text"
                  name="custom_contacto_2_puesto"
                  value={formData.custom_contacto_2_puesto}
                  onChange={handleChange}
                  placeholder="Ej: Soporte técnico"
                />
              </div>
            </div>

          </div>

          {/* ── CONFIGURACIÓN (solo edición) ── */}
          {isEditing && (
            <div className="np-section">
              <h3>Configuración</h3>
              <label className="np-checkbox-label">
                <input
                  type="checkbox"
                  name="disabled"
                  checked={formData.disabled}
                  onChange={handleChange}
                />
                <span>Deshabilitar proveedor</span>
              </label>
            </div>
          )}

          {/* ACCIONES */}
          <div className="np-actions">
            <button type="button" onClick={onCancel} className="np-btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="np-btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : `${isEditing ? 'Actualizar' : 'Registrar'} Proveedor`}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default NuevoProveedor;