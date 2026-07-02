import ModalError from './modals/ModalError';
import useInsumoForm from '../hooks/useInsumoForm';
import '../styles/NuevoInsumo.css';

function NuevoInsumo({ onSuccess, onCancel, editItem = null }) {
  const {
    formData,
    catalogos,
    esAbarrotes,
    loading,
    infoModal, setInfoModal,
    isEditing,
    esProductoTerminado,
    precioPorKg,
    categoriasFiltradas,
    unidadesBase,
    IMPUESTOS,
    handleChange,
    handleItemGroupChange,
    handleTipoChange,
    generateCode,
    handleSubmit,
  } = useInsumoForm({ editItem, onSuccess });

  return (
    <div className="nuevo-insumo-modal">
      <ModalError
        isOpen={infoModal.isOpen}
        message={infoModal.message}
        type={infoModal.type}
        onClose={() => {
          setInfoModal({ isOpen: false, message: '', type: 'error' });
          if (infoModal.type.startsWith('success')) onSuccess?.();
        }}
      />
      <div className="nuevo-insumo-container">
        <div className="form-header">
          <h2>{isEditing ? 'Editar' : 'Nuevo'} Insumo</h2>
          <button className="btn-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="insumo-form">

          {/* IDENTIFICACIÓN */}
          <div className="form-section">
            <h3>Identificación</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Código del Producto {!isEditing && '*'}</label>
                <div className="input-group">
                  <input type="text" name="item_code" value={formData.item_code}
                    onChange={handleChange} placeholder="Código de barras"
                    style={{ textTransform: 'uppercase', background: isEditing ? '#fffbf0' : undefined }}
                    required />
                  {!isEditing && (
                    <button type="button" onClick={generateCode} className="btn-auto">Auto</button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Código Interno</label>
                <input type="text" name="custom_código_interno"
                  value={formData.custom_código_interno} onChange={handleChange}
                  placeholder="CÓDIGO INTERNO" />
              </div>
            </div>
            <div className="form-group">
              <label>Nombre del Producto *</label>
              <input type="text" name="item_name" value={formData.item_name}
                onChange={handleChange} style={{ textTransform: 'uppercase' }}
                placeholder={
                  esAbarrotes ? 'Ej: Leche Lala 1L' :
                    esProductoTerminado ? 'Ej: Concha, Bolillo, Cuernito' :
                      'Ej: Harina de Trigo'
                }
                required />
            </div>
          </div>

          {/* CLASIFICACIÓN */}
          <div className="form-section">
            <h3>Clasificación</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Categoría *</label>
                <select name="item_group" value={formData.item_group}
                  onChange={handleItemGroupChange} required
                  className={esAbarrotes ? 'select-abarrotes' : ''}>
                  <option value="">
                    {esProductoTerminado ? 'Tipo de pan...' : 'Seleccionar categoría...'}
                  </option>
                  {categoriasFiltradas.map(g => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
                <small style={{ color: esProductoTerminado ? '#2b2825ff' : '#514a44ff' }}>
                  {esProductoTerminado
                    ? 'SELECCIONE LA CATEGORÍA DEL PAN'
                    : 'Grupo al que pertenece el insumo'}
                </small>
              </div>
              <div className="form-group">
                <label>Tipo de Item *</label>
                <select name="custom_tipo_item" value={formData.custom_tipo_item}
                  onChange={handleTipoChange}
                  required>
                  <option value="MATERIA PRIMA">MATERIA PRIMA / INSUMO</option>
                  <option value="PRODUCTO TERMINADO">PRODUCTO TERMINADO</option>
                  <option value="INSUMO GENERAL">INSUMO GENERAL</option>
                </select>
                <small>
                  {formData.custom_tipo_item === 'PRODUCTO TERMINADO'
                    ? '⚠️ ADVERTENCIA: ESTE ÍTEM SERÁ USADO COMO PRODUCTO TERMINADO EN UNA RECETA'
                    : formData.custom_tipo_item === 'MATERIA PRIMA'
                      ? 'Ingrediente / materia prima comprada a proveedores'
                      : 'Insumo de uso general (limpieza, empaque, etc.)'}
                </small>
              </div>
              <div className="form-group">
                <label>Departamentos</label>
                <div className="departamentos-checkboxes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e5d2b8' }}>
                  {catalogos.departamentos.map(d => {
                    const currentDepts = formData.custom_departamento
                      ? formData.custom_departamento.split(',').map(x => x.trim()).filter(Boolean)
                      : [];
                    const isChecked = currentDepts.includes(d.name);
                    return (
                      <label key={d.name} className="checkbox-label" style={{ margin: 0 }}>
                        <input type="checkbox" checked={isChecked}
                          onChange={(e) => {
                            let newDepts = [...currentDepts];
                            if (e.target.checked) newDepts.push(d.name);
                            else newDepts = newDepts.filter(x => x !== d.name);
                            handleChange({ target: { name: 'custom_departamento', value: newDepts.join(', ') } });
                          }} />
                        <span>{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* PRESENTACIÓN — Solo Materia Prima / Insumo General */}
          {!esProductoTerminado && (
            <div className="form-section">
              <h3>Presentación</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Presentación *</label>
                  <select name="custom_presentación" value={formData.custom_presentación} onChange={handleChange}>
                    <option value="">Seleccione la presentación...</option>
                    {catalogos.presentaciones.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cantidad por Presentación</label>
                  <input type="number" name="custom_cantidad_por_presentación"
                    value={formData.custom_cantidad_por_presentación}
                    onChange={handleChange} placeholder="Ej: 25" min="0" step="0.0001" />
                </div>
                <div className="form-group">
                  <label>Unidad de Medida *</label>
                  <select name="stock_uom" value={formData.stock_uom} onChange={handleChange} required>
                    <option value="">Selecciona unidad...</option>
                    {unidadesBase.map(u => (
                      <option key={u.name} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* UNIDAD DE VENTA — Solo Producto Terminado */}
          {esProductoTerminado && (
            <div className="form-section">
              <h3>Unidad de Venta</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Unidad de Medida *</label>
                  <select name="stock_uom" value={formData.stock_uom} onChange={handleChange} required>
                    <option value="">Selecciona unidad...</option>
                    {unidadesBase.map(u => (
                      <option key={u.name} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                  <small>¿Cómo se vende? Por pieza, docena, kg...</small>
                </div>
              </div>
            </div>
          )}

          {/* PRECIO DE COMPRA — Materia Prima / Insumo General */}
          {!esProductoTerminado && (
            <div className="form-section">
              <h3>Precio de Compra</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio por presentación ($)</label>
                  <input type="number" name="custom_precio_de_compra"
                    value={formData.custom_precio_de_compra}
                    onChange={handleChange} placeholder="0.00" min="0" step="0.000001" />
                </div>
                <div className="form-group">
                  <label>Precio por {formData.stock_uom || 'unidad'} ($)</label>
                  <input type="number" value={formData.custom_precio_por_kg}
                    readOnly className="input-calculated" placeholder="Auto" />
                  <small>
                    {precioPorKg > 0
                      ? `$${parseFloat(formData.custom_precio_de_compra).toFixed(4)} / ${formData.custom_cantidad_por_presentación} ${formData.stock_uom} = $${precioPorKg.toFixed(4)}`
                      : `Ingresa precio y ${formData.stock_uom || 'unidad'} por presentación`}
                  </small>
                </div>
                <div className="form-group">
                  <label>Impuesto</label>
                  <select name="custom_impuesto" value={formData.custom_impuesto} onChange={handleChange}>
                    {IMPUESTOS.map(imp => (
                      <option key={imp.key} value={imp.key}>{imp.label}</option>
                    ))}
                  </select>
                  <small>
                    {(() => {
                      const imp = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
                      const tasa = imp?.rate ?? 0;
                      const precio = parseFloat(formData.custom_precio_de_compra) || 0;
                      if (tasa > 0 && precio > 0) return `Con un ${imp.label} = $${(precio * tasa).toFixed(4)}`;
                      return tasa === 0 ? 'Sin impuesto aplicable' : 'Ingresa el precio de compra primero';
                    })()}
                  </small>
                </div>
                <div className="form-group">
                  <label>Total presentación + Impuesto ($)</label>
                  <input type="number"
                    value={(() => {
                      const precio = parseFloat(formData.custom_precio_de_compra) || 0;
                      const imp = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
                      return precio > 0 ? (precio * (1 + (imp?.rate ?? 0))).toFixed(4) : '';
                    })()}
                    readOnly className="input-calculated" placeholder="Auto" />
                </div>
                <div className="form-group">
                  <label>Precio por {formData.stock_uom || 'unidad'} + Impuesto ($)</label>
                  <input type="number" value={formData.custom_precio_final}
                    readOnly className="input-calculated" placeholder="Auto" />
                </div>
              </div>
            </div>
          )}

          {/* PRECIO DE VENTA — Solo Producto Terminado */}
          {esProductoTerminado && (
            <div className="form-section">
              <h3>Precio de Venta</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio al Público por {formData.stock_uom || 'unidad'} ($) *</label>
                  <input type="number" name="custom_precio_de_venta"
                    value={formData.custom_precio_de_venta}
                    onChange={handleChange} placeholder="Ej: 14.00" min="0" step="0.01"
                    className="input-highlight" />
                  <small style={{ color: '#b45309', fontWeight: 600 }}>
                    ⚠️ CAPTURA EL PRECIO EXACTO AL QUE SE VENDES
                  </small>
                </div>
                <div className="form-group">
                  <label>Impuesto incluido en el precio</label>
                  <select name="custom_impuesto" value={formData.custom_impuesto} onChange={handleChange}>
                    {IMPUESTOS.map(imp => (
                      <option key={imp.key} value={imp.key}>{imp.label}</option>
                    ))}
                  </select>
                  <small>
                    {formData.custom_impuesto === 'tasa0' ? 'SIN IMPUESTO'
                      : formData.custom_impuesto === 'ieps' ? 'IMPUESTO ESPECIAL SOBRE PRODUCCIÓN Y SERVICIOS'
                        : 'IMPUESTO SOBRE EL VALOR AGREGADO'}
                  </small>
                </div>
                <div className="form-group">
                  <label>Base sin impuesto ($) — desglose fiscal</label>
                  <input type="number" value={formData.custom_precio_final}
                    readOnly className="input-calculated" placeholder="Auto" />
                  <small>
                    {(() => {
                      const precioPublico = parseFloat(formData.custom_precio_de_venta) || 0;
                      const imp = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
                      const tasa = imp?.rate ?? 0;
                      if (precioPublico > 0 && tasa > 0) {
                        const base = precioPublico / (1 + tasa);
                        return `$${base.toFixed(2)} base + $${(precioPublico - base).toFixed(2)} ${imp.label} = $${precioPublico.toFixed(2)}`;
                      }
                      if (precioPublico > 0 && tasa === 0) return `$${precioPublico.toFixed(2)} (sin impuesto, base = precio público)`;
                      return 'Ingresa el precio al público primero';
                    })()}
                  </small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Precio Pueblos-Camionetas ($)</label>
                  <input type="number" name="custom_precio_de_venta_pueblos"
                    value={formData.custom_precio_de_venta_pueblos}
                    onChange={handleChange} placeholder="Ej: 18.00" min="0" step="0.01" />
                  <small>Precio para el canal Pueblos/Camionetas. Si lo dejas vacío, ese canal usa el precio de Sucursal.</small>
                </div>
              </div>
            </div>
          )}

          {/* PRECIOS DE REVENTA — SOLO ABARROTES */}
          {esAbarrotes && !esProductoTerminado && (
            <div className="form-section section-precios">
              <h3>
                Precios de Reventa
                <span className="hint">Modifica cualquier campo, los demás se calculan automáticamente</span>
              </h3>
              <div className="precios-grid">
                <div className="form-group">
                  <label>% Margen de Ganancia</label>
                  <input type="number" name="custom_porcentaje_de_ganancia"
                    value={formData.custom_porcentaje_de_ganancia}
                    onChange={handleChange} placeholder="Ej: 30" min="0" step="0.0001" />
                </div>
                <div className="form-group">
                  <label>Precio de Venta *</label>
                  <input type="number" name="custom_precio_de_venta"
                    value={formData.custom_precio_de_venta}
                    onChange={handleChange} placeholder="0.00" min="0" step="0.01"
                    required className="input-highlight" />
                </div>
                <div className="form-group">
                  <label>Ganancia ($)</label>
                  <input type="number" name="custom_ganancia"
                    value={formData.custom_ganancia} readOnly className="input-calculated" />
                  <small>Calculado automáticamente</small>
                </div>
              </div>
            </div>
          )}

          {/* CONFIGURACIÓN */}
          <div className="form-section">
            <h3>Configuración</h3>
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" name="disabled" checked={formData.disabled} onChange={handleChange} />
                <span>Fuera de Existencia (Deshabilitar)</span>
              </label>
            </div>
            {!esProductoTerminado && (
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="custom_vendible_b2b"
                    checked={!!formData.custom_vendible_b2b} onChange={handleChange} />
                  <span>Vendible a sucursales (B2B)</span>
                </label>
                <small>Marca esto para que esta materia prima aparezca en Venta B2B (ej. Puerta Real).</small>
              </div>
            )}
            <div className="form-group">
              <label>Descripción / Notas</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : `${isEditing ? 'Actualizar' : 'Guardar'} Insumo`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NuevoInsumo;
