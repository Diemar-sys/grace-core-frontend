import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { inventory } from '../services/frappeInventory';
import { sanitizarObjeto } from '../utils/security';

const IMPUESTOS = [
  { key: 'tasa0', label: 'Tasa 0 (Exento)', rate: 0 },
  { key: 'iva16', label: 'IVA 16%',          rate: 0.16 },
  { key: 'ieps',  label: 'IEPS 8%',           rate: 0.08 },
];

const ESTADO_INICIAL = {
  item_code: '',
  item_name: '',
  item_group: '',
  stock_uom: '',
  custom_código_interno: '',
  custom_tipo_item: 'MATERIA PRIMA',
  custom_departamento: '',
  custom_presentación: '',
  custom_cantidad_por_presentación: '',
  custom_precio_de_compra: '',
  custom_precio_por_kg: '',
  custom_impuesto: 'tasa0',
  custom_precio_final: '',
  custom_precio_de_venta: '',
  custom_precio_de_venta_pueblos: '',
  custom_porcentaje_de_ganancia: '',
  custom_ganancia: '',
  custom_vendible_b2b: false,
  disabled: false,
  description: '',
};

export default function useInsumoForm({ editItem, onSuccess }: { editItem?: any; onSuccess?: (result: any) => void }) {
  const isEditing = !!editItem;

  const [formData, setFormData] = useState<any>(ESTADO_INICIAL);
  const [catalogos, setCatalogos] = useState<{ itemGroups: any[]; uoms: any[]; departamentos: any[]; presentaciones: any[]; warehouses: any[] }>({
    itemGroups: [], uoms: [], departamentos: [], presentaciones: [], warehouses: [],
  });
  const [esAbarrotes, setEsAbarrotes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; message: string; type: string }>({ isOpen: false, message: '', type: 'error' });
  const ultimoCampoModificado = useRef<string | null>(null);

  // ── Carga catálogos y, si es edición, hidrata formData ───────────────────
  useEffect(() => {
    const loadCatalogos = async () => {
      try {
        const [itemGroups, uoms, warehouses, departamentos, presentaciones] = await Promise.all([
          inventory.getItemGroups(),
          inventory.getUOMs(),
          inventory.getWarehouses(),
          inventory.getDepartamentos(),
          inventory.getPresentaciones(),
        ]);
        setCatalogos({ itemGroups, uoms, warehouses, departamentos, presentaciones });

        if (editItem) {
          setEsAbarrotes(inventory.esProductoParaVenta(editItem.item_group));
          setFormData({
            item_code:                         editItem.item_code || '',
            custom_código_interno:             editItem.custom_código_interno || '',
            item_name:                         editItem.item_name || '',
            item_group:                        editItem.item_group || '',
            custom_tipo_item:                  editItem.custom_tipo_item || 'MATERIA PRIMA',
            custom_departamento:               editItem.custom_departamento || '',
            stock_uom:                         editItem.stock_uom || '',
            custom_presentación:               editItem.custom_presentación || '',
            custom_cantidad_por_presentación:  editItem.custom_cantidad_por_presentación || '',
            custom_precio_de_compra:           editItem.custom_precio_de_compra || '',
            custom_precio_por_kg:              editItem.custom_precio_por_kg || '',
            custom_impuesto:                   editItem.custom_impuesto || 'tasa0',
            custom_precio_final:               editItem.custom_precio_final || '',
            custom_precio_de_venta:            editItem.custom_precio_de_venta || '',
            custom_precio_de_venta_pueblos:    editItem.custom_precio_de_venta_pueblos || '',
            custom_porcentaje_de_ganancia:     editItem.custom_porcentaje_de_ganancia || '',
            custom_ganancia:                   editItem.custom_ganancia || '',
            custom_vendible_b2b:               editItem.custom_vendible_b2b || false,
            opening_stock:                     '',
            default_warehouse:                 '',
            disabled:                          editItem.disabled || false,
            description:                       editItem.description || '',
          });
        }
      } catch (err) {
        console.error('Error cargando catálogos:', err);
        setInfoModal({ isOpen: true, message: 'Error cargando opciones del formulario', type: 'error' });
      }
    };
    loadCatalogos();
  }, [editItem]);

  // ── Precio por KG — Materia Prima / Insumo General ───────────────────────
  useEffect(() => {
    if (formData.custom_tipo_item === 'PRODUCTO TERMINADO') return;
    const compra   = parseFloat(formData.custom_precio_de_compra) || 0;
    const cantidad = parseFloat(formData.custom_cantidad_por_presentación) || 0;
    let precioPorKg = '';
    let precioFinal = '';
    if (compra > 0 && cantidad > 0) {
      precioPorKg = (compra / cantidad).toFixed(4);
      const imp   = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
      precioFinal = (parseFloat(precioPorKg) * (1 + (imp?.rate ?? 0))).toFixed(4);
    }
    setFormData((prev: any) => ({ ...prev, custom_precio_por_kg: precioPorKg, custom_precio_final: precioFinal }));
  }, [formData.custom_precio_de_compra, formData.custom_cantidad_por_presentación, formData.custom_impuesto, formData.custom_tipo_item]);

  // ── Desglose impuesto — Producto Terminado ───────────────────────────────
  useEffect(() => {
    if (formData.custom_tipo_item !== 'PRODUCTO TERMINADO') return;
    const precioPublico = parseFloat(formData.custom_precio_de_venta) || 0;
    const imp  = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
    const rate = imp?.rate ?? 0;
    const base = precioPublico > 0 ? (precioPublico / (1 + rate)).toFixed(4) : '';
    setFormData((prev: any) => ({ ...prev, custom_precio_final: base }));
  }, [formData.custom_precio_de_venta, formData.custom_impuesto, formData.custom_tipo_item]);

  // ── Cálculo bidireccional abarrotes: costo/base + porcentaje → venta ─────
  // El costo base es el precio POR UNIDAD BASE (precio_por_kg = compra/cantidad),
  // NO el precio de la presentación. Se vende por pza, así que el margen va por pza.
  useEffect(() => {
    if (!esAbarrotes || ultimoCampoModificado.current === 'venta') return;
    const costoBase  = parseFloat(formData.custom_precio_por_kg) || 0;
    const porcentaje = parseFloat(formData.custom_porcentaje_de_ganancia) || 0;
    if (costoBase > 0 && porcentaje > 0) {
      const venta    = costoBase * (1 + porcentaje / 100);
      const ganancia = venta - costoBase;
      setFormData((prev: any) => ({ ...prev, custom_precio_de_venta: venta.toFixed(4), custom_ganancia: ganancia.toFixed(4) }));
    }
  }, [esAbarrotes, formData.custom_precio_por_kg, formData.custom_porcentaje_de_ganancia]);

  // ── Cálculo bidireccional abarrotes: venta → porcentaje ─────────────────
  useEffect(() => {
    if (!esAbarrotes || ultimoCampoModificado.current !== 'venta') return;
    const costoBase = parseFloat(formData.custom_precio_por_kg) || 0;
    const venta     = parseFloat(formData.custom_precio_de_venta) || 0;
    if (costoBase > 0 && venta > 0) {
      const porcentaje = ((venta - costoBase) / costoBase) * 100;
      const ganancia   = venta - costoBase;
      setFormData((prev: any) => ({ ...prev, custom_porcentaje_de_ganancia: porcentaje.toFixed(4), custom_ganancia: ganancia.toFixed(4) }));
    }
  }, [esAbarrotes, formData.custom_precio_de_venta, formData.custom_precio_por_kg]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleItemGroupChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const newGroup  = e.target.value;
    const abarrotes = inventory.esProductoParaVenta(newGroup);
    setFormData((prev: any) => ({
      ...prev,
      item_group: newGroup,
      ...(abarrotes && { custom_departamento: 'ABARROTES' }),
      ...(!abarrotes && {
        custom_precio_de_venta: '',
        custom_porcentaje_de_ganancia: '',
        custom_ganancia: '',
        ...(prev.custom_departamento === 'ABARROTES' && { custom_departamento: '' }),
      }),
    }));
    setEsAbarrotes(abarrotes);
  }, []);

  const handleTipoChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const nuevoTipo = e.target.value;
    setEsAbarrotes(false);
    setFormData((prev: any) => ({
      ...prev,
      custom_tipo_item: nuevoTipo,
      item_group: '',   // el bucket de categorías cambia con el tipo → limpiar para no dejar una inválida del bucket anterior
      ...(nuevoTipo === 'PRODUCTO TERMINADO' && {
        custom_presentación: '',
        custom_cantidad_por_presentación: '',
        custom_precio_de_compra: '',
        custom_precio_por_kg: '',
        stock_uom: 'PZA',
      }),
    }));
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (name === 'custom_precio_de_venta') ultimoCampoModificado.current = 'venta';
    else if (name === 'custom_precio_de_compra' || name === 'custom_porcentaje_de_ganancia')
      ultimoCampoModificado.current = 'compra_o_porcentaje';
    setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const generateCode = () => {
    if (!formData.item_name) {
      setInfoModal({ isOpen: true, message: 'Primero ingresa el nombre del producto para generar su código', type: 'error' });
      return;
    }
    const prefix = esAbarrotes ? 'ABR' : 'MP';
    const code = `${prefix}_${formData.item_name}`
      .toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]/g, '_').substring(0, 20);
    setFormData((prev: any) => ({ ...prev, item_code: code }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.item_code?.trim()) { setInfoModal({ isOpen: true, message: 'El código del producto es obligatorio', type: 'error' }); setLoading(false); return; }
    if (!formData.item_name?.trim()) { setInfoModal({ isOpen: true, message: 'El nombre del producto es obligatorio', type: 'error' }); setLoading(false); return; }
    if (!formData.item_group)        { setInfoModal({ isOpen: true, message: 'La categoría es obligatoria', type: 'error' }); setLoading(false); return; }

    if (formData.custom_tipo_item !== 'PRODUCTO TERMINADO') {
      if (!formData.custom_presentación) { setInfoModal({ isOpen: true, message: 'La presentación es obligatoria', type: 'error' }); setLoading(false); return; }
      if (!(parseFloat(formData.custom_precio_de_compra) > 0)) { setInfoModal({ isOpen: true, message: 'DEBES INGRESAR UN PRECIO DE COMPRA MAYOR A CERO PARA EL INSUMO.', type: 'error' }); setLoading(false); return; }
      if (!(parseFloat(formData.custom_cantidad_por_presentación) > 0)) { setInfoModal({ isOpen: true, message: 'DEBES INGRESAR LOS KG O UNIDADES DE LA PRESENTACIÓN MAYOR A CERO.', type: 'error' }); setLoading(false); return; }
    } else {
      if (!(parseFloat(formData.custom_precio_de_venta) > 0)) { setInfoModal({ isOpen: true, message: 'DEBES INGRESAR UN PRECIO DE VENTA MAYOR A CERO PARA EL PRODUCTO.', type: 'error' }); setLoading(false); return; }
    }

    try {
      let result;
      const datosLimpios = sanitizarObjeto(formData);
      if (isEditing) {
        const codigoOriginal = editItem.item_code;
        const codigoNuevo    = datosLimpios.item_code?.trim().toUpperCase();
        if (codigoNuevo && codigoNuevo !== codigoOriginal) {
          await inventory.renameItem(codigoOriginal, codigoNuevo);
          setFormData((prev: any) => ({ ...prev, item_code: codigoNuevo }));
          result = await inventory.updateItem(codigoNuevo, { ...datosLimpios, item_code: codigoNuevo });
        } else {
          result = await inventory.updateItem(codigoOriginal, datosLimpios);
        }
        setInfoModal({ isOpen: true, message: `PRODUCTO "${datosLimpios.item_name}" ACTUALIZADO CORRECTAMENTE.`, type: 'success-update' });
      } else {
        result = await inventory.createItem(datosLimpios);
        setInfoModal({ isOpen: true, message: `PRODUCTO "${datosLimpios.item_name}" CREADO EXITOSAMENTE.`, type: 'success-create' });
      }
      setTimeout(() => onSuccess?.(result), 2500);
    } catch (err) {
      console.error('Error:', err);
      let msg = (err as any)?.message || 'Error desconocido al guardar';
      if (msg.includes('already exists') || msg.includes('Duplicate')) {
        msg = `EL CÓDIGO ${formData.item_code} YA SE ENCUENTRA REGISTRADO EN OTRO PRODUCTO.`;
      } else if (msg.toLowerCase().includes('must be unique')) {
        msg = `EL CÓDIGO INTERNO ${formData.custom_código_interno} YA ESTÁ EN USO.`;
      } else if (msg.includes('Value missing for')) {
        const match = msg.match(/Value missing for:?\s*(.*)/i);
        const campo = match?.[1] ? match[1].replace(/<\/?[^>]+(>|$)/g, '') : 'un campo obligatorio';
        msg = `FALTA INGRESAR UN VALOR PARA -> ${campo.toUpperCase()}.`;
      }
      setInfoModal({ isOpen: true, message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ── Derivados expuestos al componente ────────────────────────────────────
  const esProductoTerminado = formData.custom_tipo_item === 'PRODUCTO TERMINADO';
  const esInsumoGeneral     = formData.custom_tipo_item === 'INSUMO GENERAL';
  const precioPorKg         = parseFloat(formData.custom_precio_por_kg) || 0;
  const PADRE_PT            = 'PRODUCTOS TERMINADOS';
  const PADRE_IG            = 'INSUMOS GENERALES';
  // 3 buckets por parent_item_group: PT → hijos de PT; INSUMO GENERAL → hijos de IG;
  // MATERIA PRIMA → el resto (excluye PT e IG para no mezclar limpieza/papelería con materia prima)
  // Unidad base = UOM que NO es presentación. stock_uom maneja Bin/valuación/BOM y
  // debe ser base (g/Kg/L/ml/PZA); las presentaciones (CAJA/BULTO…) solo van en el
  // picker de Presentación. Data-driven: una presentación nueva sale sola del picker.
  const nombresPresentacion = new Set(catalogos.presentaciones.map(p => p.name));
  const unidadesBase = catalogos.uoms.filter(u => !nombresPresentacion.has(u.name));

  const categoriasFiltradas = esProductoTerminado
    ? catalogos.itemGroups.filter(g => g.parent_item_group === PADRE_PT)
    : esInsumoGeneral
      ? catalogos.itemGroups.filter(g => g.parent_item_group === PADRE_IG)
      : catalogos.itemGroups.filter(g => g.parent_item_group !== PADRE_PT && g.parent_item_group !== PADRE_IG);

  return {
    formData, setFormData,
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
  };
}
