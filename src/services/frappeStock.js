/**
 * FrappeStockService
 * Combina métodos de consulta/movimiento general con los
 * endpoints específicos usados por RegistroEntrada, RegistroSalida e Inventario.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL } from '../config/constants';

const ALMACENES_DEPARTAMENTO = [
  { name: "ALMACEN - PIZZERIA - PG",    label: "Pizzeria"    },
  { name: "ALMACEN - PANQUELERIA - PG", label: "Panqueleria" },
  { name: "ALMACEN - PAN DULCE - PG",   label: "Pan Dulce"   },
  { name: "ALMACEN - PAN BLANCO - PG",  label: "Pan Blanco"  },
  { name: "ALMACEN - REPOSTERIA - PG",  label: "Reposteria"  },
];

class FrappeStockService extends FrappeBase {
  // Constantes de almacenes
  /**
   * Obtiene el nombre del almacén predeterminado para recepción (Bodega Central).
   * @returns {string} ID del almacén.
   */
  getBodegaCentral()         { return BODEGA_CENTRAL; }
  
  /**
   * Obtiene la configuración de los almacenes departamentales internos.
   * @returns {Array<{name: string, label: string}>} Lista de sub-almacenes.
   */
  getAlmacenesDepartamento() { return ALMACENES_DEPARTAMENTO; }
  
  /**
   * Retorna una lista unificada de todos los almacenes gestionados por frontend.
   * @returns {Array<{name: string, label: string}>} Lista consolidada de almacenes.
   */
  getAllWarehouses()          { return [{ name: BODEGA_CENTRAL, label: "Bodega Central" }, ...ALMACENES_DEPARTAMENTO]; }

  // ─────────────────────────────────────────────
  // BÚSQUEDA DE ÍTEMS (usada por los formularios)
  // ─────────────────────────────────────────────

  /**
   * Consulta Items filtrando por nombre para poblar selects autocompletables en los formularios de movimiento.
   * @param {string} [search=""] - Consulta de usuario.
   * @returns {Promise<Array<Object>>} Coincidencias activas.
   */
  async buscarItemsTexto(search = "") {
    const filters = [["disabled", "=", 0]];
    if (search) filters.push(["item_name", "like", `%${search}%`]);
    const params = new URLSearchParams({
      fields: JSON.stringify(["item_code", "item_name", "stock_uom", "item_group", "custom_cantidad_por_presentación", "custom_presentación"]),
      filters: JSON.stringify(filters),
      limit_page_length: 20,
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    return data.data || [];
  }

  // ─────────────────────────────────────────────
  // CONSULTAS DE STOCK
  // ─────────────────────────────────────────────

  /** 
   * Obtiene el Stock completo de un almacén en base al Bin DocType de Frappe.
   * Cruza la información con la tabla Item para devolver detalles amigables (nombre, UoM).
   * @param {string} warehouse - ID del almacén en Frappe.
   * @returns {Promise<Array<Object>>} Lista de existencias con metadata detallada.
   */
  async getStockPorAlmacen(warehouse) {
    const binParams = new URLSearchParams({
      fields: JSON.stringify(["item_code", "warehouse", "actual_qty", "reserved_qty", "projected_qty"]),
      filters: JSON.stringify([["warehouse", "=", warehouse], ["actual_qty", ">", 0]]),
      limit_page_length: 1000,
    });
    const binData = await this._fetch(`/api/resource/Bin?${binParams}`);
    const bins = binData.data || [];
    if (!bins.length) return [];

    const itemCodes = bins.map(b => b.item_code);
    const itemParams = new URLSearchParams({
      fields: JSON.stringify(["item_code", "item_name", "item_group", "stock_uom", "custom_c_digo_interno"]),
      filters: JSON.stringify([["item_code", "in", itemCodes], ["disabled", "=", 0]]),
      limit_page_length: 1000,
    });
    const itemData = await this._fetch(`/api/resource/Item?${itemParams}`);
    const itemMap = {};
    (itemData.data || []).forEach(i => { itemMap[i.item_code] = i; });

    return bins
      .filter(b => itemMap[b.item_code])
      .map(b => ({ ...itemMap[b.item_code], ...b }))
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
  }

  /** 
   * Recupera rápidamente el Stock actual de un único ítem en un almacén específico.
   * @param {string} itemCode - Código del artículo.
   * @param {string} warehouse - ID Almacén.
   * @returns {Promise<{actual_qty: number, reserved_qty: number, projected_qty: number}>} Detalle de cantidades.
   */
  async getStockActual(itemCode, warehouse) {
    const response = await this._fetch(
      `/api/resource/Bin?fields=["actual_qty","reserved_qty","projected_qty"]&filters=[["item_code","=","${itemCode}"],["warehouse","=","${warehouse}"]]`
    );
    return response.data?.[0] || { actual_qty: 0, reserved_qty: 0, projected_qty: 0 };
  }

  /** 
   * Historial de movimientos (Stock Ledger) de un ítem. 
   * Permite rastrear vida del inventario.
   * @param {string} itemCode - PK Artículo.
   * @param {number} [limit=50] - Cantidad de movimientos a cargar.
   * @returns {Promise<Array<Object>>} Lista de registros contables.
   */
  async getMovimientos(itemCode, limit = 50) {
    const response = await this._fetch(
      `/api/resource/Stock Ledger Entry?fields=["posting_date","warehouse","actual_qty","qty_after_transaction","voucher_type","voucher_no"]&filters=[["item_code","=","${itemCode}"]]&order_by=creation desc&limit_page_length=${limit}`
    );
    return response.data || [];
  }

  // ─────────────────────────────────────────────
  // MÉTODO AUXILIAR — crear y submitir Stock Entry
  // ─────────────────────────────────────────────

  /**
   * Helper encapsulando la lógica transaccional de crear y confirmar en ERPNext en un solo paso.
   * @private
   * @param {Object} payload - Diccionario configurado del Stock Entry.
   * @returns {Promise<Object>} Datos aprobados por la plataforma backend.
   */
  async crearYSubmitirStockEntry(payload) {
    const created = await this._fetch("/api/resource/Stock Entry", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const submitted = await this._fetch(
      `/api/resource/Stock Entry/${encodeURIComponent(created.data.name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) }
    );
    return submitted.data;
  }

  // ─────────────────────────────────────────────
  // ENTRADAS
  // ─────────────────────────────────────────────

  /** 
   * Entrada estándar desde formulario simplificado de "Añadir Stock" (RegistroEntrada.jsx).
   * Genera un "Material Receipt".
   * @param {Object} payloadData
   * @param {Array<Object>} payloadData.items - Artículos a ingresar.
   * @param {string} [payloadData.notas=""] - Notas opcionales.
   * @returns {Promise<Object>} Resultado de la transacción.
   */
  async registrarEntrada({ items, notas = "" }) {
    if (!items?.length) throw new Error("Agrega al menos un producto");
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          COMPANY,
      to_warehouse:     BODEGA_CENTRAL,
      remarks:          notas || "Entrada de insumos",
      items: items.map(item => ({
        item_code:         item.item_code,
        t_warehouse:       BODEGA_CENTRAL,
        qty:               parseFloat(item.qty),
        uom:               item.uom,
        stock_uom:         item.uom,
        conversion_factor: 1,
        transfer_qty:      parseFloat(item.qty),
      })),
    });
  }

  /** 
   * Entrada de artículos que ingresan costados desde un pedido o compra.
   * Conserva el valor en libros correcto (`basic_rate`).
   * @param {Object} datos - Parámetros con compañía, fecha de compra e items con precios unitarios.
   * @returns {Promise<Object>} Resultado de la transacción.
   */
  async entradaPorCompra(datos) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha || new Date().toISOString().split("T")[0],
      items: datos.items.map(item => ({
        item_code:         item.item_code,
        t_warehouse:       item.almacen_destino || BODEGA_CENTRAL,
        qty:               parseFloat(item.cantidad),
        basic_rate:        parseFloat(item.precio_unitario) || 0,
        uom:               item.uom,
        stock_uom:         item.uom,
        conversion_factor: 1,
        transfer_qty:      parseFloat(item.cantidad),
      })),
    });
  }

  /** 
   * Ajuste positivo de inventario con fines conciliatorios (inventarios físicos).
   * @param {Object} datos - Detalle de los ajustes y motivo especificado.
   * @returns {Promise<Object>} Resultado de la transacción.
   */
  async entradaPorAjuste(datos) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Ajuste positivo: ${datos.motivo || "Inventario fisico"}`,
      items: datos.items.map(item => ({
        item_code:         item.item_code,
        t_warehouse:       item.almacen || BODEGA_CENTRAL,
        qty:               parseFloat(item.cantidad),
        basic_rate:        parseFloat(item.precio_unitario) || 0,
        uom:               item.uom,
        stock_uom:         item.uom,
        conversion_factor: 1,
      })),
    });
  }

  // ─────────────────────────────────────────────
  // SALIDAS
  // ─────────────────────────────────────────────

  /** 
   * Transferencia estándar de Bodega Central hacia un departamento productivo
   * (Panadería, Pizzería, etc). Tipo "Material Transfer".
   * @param {Object} args
   * @param {string} args.almacenDestino - Cód. del Almacén en Frappe.
   * @param {Array<Object>} args.items - Artículos a transferir.
   * @param {string} [args.notas=""] - Explicación extra.
   * @returns {Promise<Object>} Resultado de la transacción.
   */
  async registrarSalida({ almacenDestino, items, notas = "" }) {
    if (!almacenDestino) throw new Error("Selecciona un almacen destino");
    if (!items?.length)  throw new Error("Agrega al menos un producto");
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Transfer",
      company:          COMPANY,
      from_warehouse:   BODEGA_CENTRAL,
      to_warehouse:     almacenDestino,
      remarks:          notas || `Transferencia a ${almacenDestino}`,
      items: items.map(item => ({
        item_code:         item.item_code,
        s_warehouse:       BODEGA_CENTRAL,
        t_warehouse:       almacenDestino,
        qty:               parseFloat(item.qty),
        uom:               item.uom,
        stock_uom:         item.uom,
        conversion_factor: 1,
        transfer_qty:      parseFloat(item.qty),
      })),
    });
  }

  /** 
   * Salida permanente ("Material Issue") indicando el término del flujo
   * por consumo en piso de producción.
   * @param {Object} datos - Detalle de consumo y opcional "orden producción".
   * @returns {Promise<Object>} Formulario generado.
   */
  async salidaPorProduccion(datos) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Consumo produccion: ${datos.orden_produccion || "Manual"}`,
      items: datos.items.map(item => ({
        item_code:  item.item_code,
        s_warehouse: item.almacen_origen || BODEGA_CENTRAL,
        qty:         parseFloat(item.cantidad),
        basic_rate:  parseFloat(item.precio_promedio) || 0,
        uom:         item.uom,
        stock_uom:   item.uom,
      })),
    });
  }

  /** 
   * Salida del inventario por merma o caducidad.
   * @param {Object} datos - Motivo especifico y tipo de merma registrada.
   * @returns {Promise<Object>} Formulario generado en Frappe.
   */
  async salidaPorMerma(datos) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Merma: ${datos.tipo_merma || ""} - ${datos.motivo || ""}`,
      items: datos.items.map(item => ({
        item_code:   item.item_code,
        s_warehouse: item.almacen_origen || BODEGA_CENTRAL,
        qty:         parseFloat(item.cantidad),
        basic_rate:  parseFloat(item.costo) || 0,
        uom:         item.uom,
        stock_uom:   item.uom,
      })),
    });
  }

  /** 
   * Ajuste negativo de inventario con fines conciliatorios (pérdidas detectadas).
   * @param {Object} datos - Formulario del ajuste con motivo.
   * @returns {Promise<Object>} Stock Entry consumado y aprobado.
   */
  async salidaPorAjuste(datos) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Ajuste negativo: ${datos.motivo || "Inventario fisico"}`,
      items: datos.items.map(item => ({
        item_code:   item.item_code,
        s_warehouse: item.almacen || BODEGA_CENTRAL,
        qty:         parseFloat(item.cantidad),
        basic_rate:  parseFloat(item.costo_promedio) || 0,
        uom:         item.uom,
        stock_uom:   item.uom,
      })),
    });
  }
}

export const stockService = new FrappeStockService();
export default FrappeStockService;