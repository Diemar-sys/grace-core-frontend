// src/components/NuevoInsumo.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { inventory } from '../services/frappeInventory';
import ModalError from './ModalError';
import { sanitizarObjeto } from '../utils/security';
import '../styles/NuevoInsumo.css';

/**
 * Modal dinámico para la Creación y Edición de Items (Insumos/Productos).
 * Soporta lógica condicionada (Ej. Precios de reventa solo para el grupo Abarrotes),
 * y validaciones custom antes de delegar escritura al backend mediante `frappeInventory`.
 *
 * @param {Object} props - Propiedades.
 * @param {Function} props.onSuccess - Callback activado con el doc final tras éxito.
 * @param {Function} props.onCancel - Para cerrar el modal.
 * @param {Object} [props.editItem=null] - Documento preexistente dictando modo "edición".
 * @returns {JSX.Element} Formulario interactivo.
 */
function NuevoInsumo({ onSuccess, onCancel, editItem = null }) {
    const isEditing = !!editItem;

    const IMPUESTOS = [
        { key: 'tasa0', label: 'Tasa 0 (Exento)', rate: 0 },
        { key: 'iva16', label: 'IVA 16%', rate: 0.16 },
        { key: 'ieps', label: 'IEPS 8%', rate: 0.08 },
    ];

    const [formData, setFormData] = useState({
        item_code: '',
        item_name: '',
        item_group: '',
        stock_uom: '',
        custom_código_interno: '',
        custom_tipo_item: 'MATERIA PRIMA',   // ← tipo de item
        custom_departamento: '',
        custom_presentación: '',
        custom_cantidad_por_presentación: '',
        custom_precio_de_compra: '',
        custom_precio_por_kg: '',          // ← calculado y guardado
        custom_impuesto: 'tasa0',
        custom_precio_final: '',           // ← final price included taxes
        custom_precio_de_venta: '',
        custom_porcentaje_de_ganancia: '',
        custom_ganancia: '',
        disabled: false,
        description: ''
    });

    const [catalogos, setCatalogos] = useState({
        itemGroups: [], uoms: [], departamentos: [], presentaciones: [], warehouses: []
    });

    const [esAbarrotes, setEsAbarrotes] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [infoModal, setInfoModal] = useState({ isOpen: false, message: '', type: 'error' });
    const ultimoCampoModificado = useRef(null);

    useEffect(() => {
        const loadCatalogos = async () => {
            try {
                const [itemGroups, uoms, warehouses, departamentos, presentaciones] = await Promise.all([
                    inventory.getItemGroups(),
                    inventory.getUOMs(),
                    inventory.getWarehouses(),
                    inventory.getDepartamentos(),
                    inventory.getPresentaciones()
                ]);
                setCatalogos({
                    itemGroups, uoms, warehouses,
                    departamentos,
                    presentaciones
                });

                if (editItem) {
                    const abarrotes = inventory.esProductoParaVenta(editItem.item_group);
                    setEsAbarrotes(abarrotes);
                    setFormData({
                        item_code: editItem.item_code || '',
                        custom_código_interno: editItem.custom_código_interno || '',
                        item_name: editItem.item_name || '',
                        item_group: editItem.item_group || '',
                        custom_tipo_item: editItem.custom_tipo_item || 'MATERIA PRIMA',
                        custom_departamento: editItem.custom_departamento || '',
                        stock_uom: editItem.stock_uom || '',
                        custom_presentación: editItem.custom_presentación || '',
                        custom_cantidad_por_presentación: editItem.custom_cantidad_por_presentación || '',
                        custom_precio_de_compra: editItem.custom_precio_de_compra || '',
                        custom_precio_por_kg: editItem.custom_precio_por_kg || '',
                        custom_impuesto: editItem.custom_impuesto || 'tasa0',
                        custom_precio_final: editItem.custom_precio_final || '',
                        custom_precio_de_venta: editItem.custom_precio_de_venta || '',
                        custom_porcentaje_de_ganancia: editItem.custom_porcentaje_de_ganancia || '',
                        custom_ganancia: editItem.custom_ganancia || '',
                        opening_stock: '',
                        default_warehouse: '',
                        disabled: editItem.disabled || false,
                        description: editItem.description || ''
                    });
                }
            } catch (err) {
                console.error('Error cargando catálogos:', err);
                setError('Error cargando opciones del formulario');
            }
        };
        loadCatalogos();
    }, [editItem]);

    // ── Precio por KG — solo Materia Prima / Insumo General ──
    useEffect(() => {
        if (formData.custom_tipo_item === 'PRODUCTO TERMINADO') return;
        const compra = parseFloat(formData.custom_precio_de_compra) || 0;
        const cantidad = parseFloat(formData.custom_cantidad_por_presentación) || 0;

        let precioPorKg = '';
        let precioFinal = '';

        if (compra > 0) {
            if (cantidad > 0) {
                precioPorKg = (compra / cantidad).toFixed(4);
                const impuestoConf = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
                const rate = impuestoConf ? impuestoConf.rate : 0;
                precioFinal = (parseFloat(precioPorKg) * (1 + rate)).toFixed(4);
            }
        }

        setFormData(prev => ({
            ...prev,
            custom_precio_por_kg: precioPorKg,
            custom_precio_final: precioFinal,
        }));
    }, [formData.custom_precio_de_compra, formData.custom_cantidad_por_presentación, formData.custom_impuesto, formData.custom_tipo_item]);

    // ── Precio con impuesto — solo Producto Terminado ─────────
    useEffect(() => {
        if (formData.custom_tipo_item !== 'PRODUCTO TERMINADO') return;
        const venta = parseFloat(formData.custom_precio_de_venta) || 0;
        const impuestoConf = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
        const rate = impuestoConf ? impuestoConf.rate : 0;
        const precioFinal = venta > 0 ? (venta * (1 + rate)).toFixed(4) : '';
        setFormData(prev => ({ ...prev, custom_precio_final: precioFinal }));
    }, [formData.custom_precio_de_venta, formData.custom_impuesto, formData.custom_tipo_item]);

    // ── Cálculo bidireccional precios abarrotes ───────────
    useEffect(() => {
        if (!esAbarrotes) return;
        if (ultimoCampoModificado.current === 'venta') return;
        const compra = parseFloat(formData.custom_precio_de_compra) || 0;
        const porcentaje = parseFloat(formData.custom_porcentaje_de_ganancia) || 0;
        if (compra > 0 && porcentaje >= 0) {
            const venta = compra * (1 + porcentaje / 100);
            const ganancia = venta - compra;
            setFormData(prev => ({
                ...prev,
                custom_precio_de_venta: venta.toFixed(4),
                custom_ganancia: ganancia.toFixed(4)
            }));
        }
    }, [esAbarrotes, formData.custom_precio_de_compra, formData.custom_porcentaje_de_ganancia]);

    useEffect(() => {
        if (!esAbarrotes) return;
        if (ultimoCampoModificado.current !== 'venta') return;
        const compra = parseFloat(formData.custom_precio_de_compra) || 0;
        const venta = parseFloat(formData.custom_precio_de_venta) || 0;
        if (compra > 0 && venta > 0) {
            const porcentaje = ((venta - compra) / compra) * 100;
            const ganancia = venta - compra;
            setFormData(prev => ({
                ...prev,
                custom_porcentaje_de_ganancia: porcentaje.toFixed(4),
                custom_ganancia: ganancia.toFixed(4)
            }));
        }
    }, [esAbarrotes, formData.custom_precio_de_venta]);

    const handleItemGroupChange = useCallback((e) => {
        const newGroup = e.target.value;
        const abarrotes = inventory.esProductoParaVenta(newGroup);
        setFormData(prev => ({
            ...prev,
            item_group: newGroup,
            ...(!abarrotes && {
                custom_precio_de_venta: '',
                custom_porcentaje_de_ganancia: '',
                custom_ganancia: ''
            })
        }));
        setEsAbarrotes(abarrotes);
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'custom_precio_de_venta')
            ultimoCampoModificado.current = 'venta';
        else if (name === 'custom_precio_de_compra' || name === 'custom_porcentaje_de_ganancia')
            ultimoCampoModificado.current = 'compra_o_porcentaje';
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const generateCode = () => {
        if (!formData.item_name) { setInfoModal({ isOpen: true, message: 'Primero ingresa el nombre del producto para generar su código', type: 'error' }); return; }
        const prefix = esAbarrotes ? 'ABR' : 'MP';
        const code = `${prefix}_${formData.item_name}`
            .toUpperCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9]/g, '_').substring(0, 20);
        setFormData(prev => ({ ...prev, item_code: code }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');

        if (!formData.item_code?.trim()) { setInfoModal({ isOpen: true, message: 'El código del producto es obligatorio', type: 'error' }); setLoading(false); return; }
        if (!formData.item_name?.trim()) { setInfoModal({ isOpen: true, message: 'El nombre del producto es obligatorio', type: 'error' }); setLoading(false); return; }
        if (!formData.item_group) { setInfoModal({ isOpen: true, message: 'La categoría es obligatoria', type: 'error' }); setLoading(false); return; }

        if (formData.custom_tipo_item !== 'PRODUCTO TERMINADO') {
            // Validaciones para Materia Prima / Insumo General
            if (!formData.custom_presentación) { setInfoModal({ isOpen: true, message: 'La presentación es obligatoria', type: 'error' }); setLoading(false); return; }
            const compra = parseFloat(formData.custom_precio_de_compra) || 0;
            const cantidad = parseFloat(formData.custom_cantidad_por_presentación) || 0;
            if (compra <= 0) {
                setInfoModal({ isOpen: true, message: 'DEBES INGRESAR UN PRECIO DE COMPRA MAYOR A CERO PARA EL INSUMO.', type: 'error' });
                setLoading(false); return;
            }
            if (cantidad <= 0) {
                setInfoModal({ isOpen: true, message: 'DEBES INGRESAR LOS KG O UNIDADES DE LA PRESENTACIÓN MAYOR A CERO.', type: 'error' });
                setLoading(false); return;
            }
        } else {
            // Validaciones para Producto Terminado
            const venta = parseFloat(formData.custom_precio_de_venta) || 0;
            if (venta <= 0) {
                setInfoModal({ isOpen: true, message: 'DEBES INGRESAR UN PRECIO DE VENTA MAYOR A CERO PARA EL PRODUCTO.', type: 'error' });
                setLoading(false); return;
            }
        }

        try {
            let result;
            // Limpiar campos de texto libre antes de enviar al backend
            const datosLimpios = sanitizarObjeto(formData);
            if (isEditing) {
                const codigoOriginal = editItem.item_code;
                const codigoNuevo = datosLimpios.item_code?.trim().toUpperCase();

                // Si el código cambió, renombramos primero en ERPNext
                if (codigoNuevo && codigoNuevo !== codigoOriginal) {
                    await inventory.renameItem(codigoOriginal, codigoNuevo);
                    setFormData(prev => ({ ...prev, item_code: codigoNuevo }));
                    result = await inventory.updateItem(codigoNuevo, { ...datosLimpios, item_code: codigoNuevo });
                } else {
                    result = await inventory.updateItem(codigoOriginal, datosLimpios);
                }
                setInfoModal({ isOpen: true, message: `PRODUCTO "${datosLimpios.item_name}" ACTUALIZADO CORRECTAMENTE.`, type: 'success-update' });
            } else {
                result = await inventory.createItem(datosLimpios);
                setInfoModal({ isOpen: true, message: `PRODUCTO "${datosLimpios.item_name}" CREADO EXITOSAMENTE.`, type: 'success-create' });
            }
            // Retrasar el cierre/onSuccess para que el usuario pueda leer el modal de éxito
            setTimeout(() => onSuccess?.(result), 2500);
        } catch (err) {
            console.error('Error:', err);
            let mensajeError = err.message || 'Error desconocido al guardar';

            // Atrapando el error de duplicado de ERPNext "Item <strong>...</strong> already exists"
            if (mensajeError.includes('already exists') || mensajeError.includes('Duplicate')) {
                mensajeError = `EL CÓDIGO ${formData.item_code} YA SE ENCUENTRA REGISTRADO EN OTRO PRODUCTO.`;
            } else if (mensajeError.toLowerCase().includes('must be unique')) {
                // Atrapando el error de campo único "CÓDIGO INTERNO must be unique"
                mensajeError = `EL CÓDIGO INTERNO ${formData.custom_código_interno} YA ESTÁ EN USO.`;
            } else if (mensajeError.includes('Value missing for')) {
                // Atrapando cualquier error genérico de Frappe "Value missing for: [Nombre del Campo]"
                const match = mensajeError.match(/Value missing for:?\s*(.*)/i);
                const campoFaltante = match && match[1] ? match[1].replace(/<\/?[^>]+(>|$)/g, "") : 'un campo obligatorio';
                mensajeError = `FALTA INGRESAR UN VALOR PARA -> ${campoFaltante.toUpperCase()}.`;
            }


            setInfoModal({ isOpen: true, message: mensajeError, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const precioPorKg = parseFloat(formData.custom_precio_por_kg) || 0;
    const esProductoTerminado = formData.custom_tipo_item === 'PRODUCTO TERMINADO';

    // ── Filtrar categorías según tipo de item ─────────────────
    const PADRE_PRODUCTOS_TERMINADOS = 'PRODUCTOS TERMINADOS';
    const categoriasFiltradas = esProductoTerminado
        ? catalogos.itemGroups.filter(g => g.parent_item_group === PADRE_PRODUCTOS_TERMINADOS)
        : catalogos.itemGroups.filter(g => g.parent_item_group !== PADRE_PRODUCTOS_TERMINADOS);

    return (
        <div className="nuevo-insumo-modal">
            <ModalError
                isOpen={infoModal.isOpen}
                message={infoModal.message}
                type={infoModal.type}
                onClose={() => {
                    setInfoModal({ isOpen: false, message: '', type: 'error' });
                    // Si era éxito y cierran el modal manual, forzamos salir más rápido
                    if (infoModal.type.startsWith('success')) {
                        onSuccess?.();
                    }
                }}
            />
            <div className="nuevo-insumo-container">
                <div className="form-header">
                    <h2>{isEditing ? 'Editar' : 'Nuevo'} Insumo</h2>
                    <button className="btn-close" onClick={onCancel}>×</button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

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
                                <small style={{ color: esProductoTerminado ? '#0284c7' : '#8b6a4e' }}>
                                    {esProductoTerminado
                                        ? '🥐 Selecciona el tipo de producto terminado'
                                        : 'Grupo al que pertenece el insumo'}
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Tipo de Item *</label>
                                <select
                                    name="custom_tipo_item"
                                    value={formData.custom_tipo_item}
                                    onChange={e => {
                                        const nuevoTipo = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            custom_tipo_item: nuevoTipo,
                                            item_group: '',
                                            // Limpiar campos de presentación al cambiar a Producto Terminado
                                            // para evitar que Frappe rechace el registro por campos vacíos
                                            ...(nuevoTipo === 'PRODUCTO TERMINADO' && {
                                                custom_presentación: '',
                                                custom_cantidad_por_presentación: '',
                                                custom_precio_de_compra: '',
                                                custom_precio_por_kg: '',
                                            })
                                        }));
                                        setEsAbarrotes(false);
                                    }}
                                    required
                                >
                                    <option value="MATERIA PRIMA">Materia Prima / Insumo</option>
                                    <option value="PRODUCTO TERMINADO">Producto Terminado</option>
                                    <option value="INSUMO GENERAL">Insumo General</option>
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
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        let newDepts = [...currentDepts];
                                                        if (e.target.checked) {
                                                            newDepts.push(d.name);
                                                        } else {
                                                            newDepts = newDepts.filter(x => x !== d.name);
                                                        }
                                                        handleChange({
                                                            target: {
                                                                name: 'custom_departamento',
                                                                value: newDepts.join(', ')
                                                            }
                                                        });
                                                    }}
                                                />
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
                                <select name="custom_presentación" value={formData.custom_presentación}
                                    onChange={handleChange}>
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
                                    onChange={handleChange} placeholder="Ej: 25" min="0" step="0.01" />
                            </div>
                            <div className="form-group">
                                <label>Unidad de Medida *</label>
                                <select name="stock_uom" value={formData.stock_uom} onChange={handleChange} required>
                                    <option value="">Selecciona unidad...</option>
                                    {catalogos.uoms.map(u => (
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
                                    {catalogos.uoms.map(u => (
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
                                        const tasa = imp ? imp.rate : 0;
                                        const precio = parseFloat(formData.custom_precio_de_compra) || 0;
                                        if (tasa > 0 && precio > 0) {
                                            const montoImpuesto = precio * tasa;
                                            return `Con un ${imp.label} = $${montoImpuesto.toFixed(4)}`;
                                        }
                                        return tasa === 0 ? 'Sin impuesto aplicable' : 'Ingresa el precio de compra primero';
                                    })()}
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Total presentación + Impuesto ($)</label>
                                <input
                                    type="number"
                                    value={(() => {
                                        const precio = parseFloat(formData.custom_precio_de_compra) || 0;
                                        const imp = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
                                        const tasa = imp ? imp.rate : 0;
                                        return precio > 0 ? (precio * (1 + tasa)).toFixed(4) : '';
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
                                <label>Precio de Venta por {formData.stock_uom || 'unidad'} ($) *</label>
                                <input type="number" name="custom_precio_de_venta"
                                    value={formData.custom_precio_de_venta}
                                    onChange={handleChange} placeholder="0.00" min="0" step="0.01"
                                    className="input-highlight" />
                                <small>Precio al que se vende al cliente</small>
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
                                        const tasa = imp ? imp.rate : 0;
                                        const precio = parseFloat(formData.custom_precio_de_venta) || 0;
                                        if (tasa > 0 && precio > 0) {
                                            return `${imp.label} = $${(precio * tasa).toFixed(4)}`;
                                        }
                                        return tasa === 0 ? 'Sin impuesto (pan de sal, etc.)' : 'Ingresa el precio de venta primero';
                                    })()}
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Precio Final con Impuesto ($)</label>
                                <input type="number" value={formData.custom_precio_final}
                                    readOnly className="input-calculated" placeholder="Auto" />
                                <small>
                                    {formData.custom_precio_final && formData.custom_precio_de_venta
                                        ? `$${parseFloat(formData.custom_precio_de_venta).toFixed(2)} + impuesto = $${parseFloat(formData.custom_precio_final).toFixed(2)}`
                                        : 'Calculado automáticamente'}
                                </small>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* PRECIOS DE REVENTA — SOLO ABARROTES (no aplica a productos terminados) */}
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
                                        onChange={handleChange} placeholder="Ej: 30" min="0" step="0.01" />
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
                        <div className="form-group">
                            <label>Descripción / Notas</label>
                            <textarea name="description" value={formData.description}
                                onChange={handleChange} rows="3" />
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