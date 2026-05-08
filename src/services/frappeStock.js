/**
 * FrappeStockService
 * Combina métodos de consulta/movimiento general con los
 * endpoints específicos usados por RegistroEntrada, RegistroSalida e Inventario.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL } from '../config/constants';

// Tipos de Warehouse esperados en ERPNext (Doctype "Warehouse Type").
// Si el tipo no coincide se cataloga como "Otros" y aparece al final del select.
const TIPO_BODEGA         = 'BODEGA';
const TIPO_DEPARTAMENTO   = 'DEPARTAMENTO';
const TIPO_SUCURSAL       = 'SUCURSAL';
const TIPO_CAMIONETA      = 'CAMIONETA';
const TIPO_PUNTO_VENTA    = 'PUNTO DE VENTA';

const ORDEN_TIPOS = [TIPO_BODEGA, TIPO_DEPARTAMENTO, TIPO_SUCURSAL, TIPO_CAMIONETA, TIPO_PUNTO_VENTA];

class FrappeStockService extends FrappeBase {
  #almacenesCache = null;

  getBodegaCentral() { return BODEGA_CENTRAL; }

  /**
   * Lee los warehouses activos de ERPNext (no grupos, sin disabled, de la company).
   * Cachea la respuesta para evitar requests repetidos. Llamar a clearCache() en logout.
   * @returns {Promise<Array<{name, label, warehouse_type, parent_warehouse}>>}
   */
  async fetchAlmacenes() {
    if (this.#almacenesCache) return this.#almacenesCache;
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'warehouse_name', 'warehouse_type', 'parent_warehouse']),
      filters: JSON.stringify([
        ['company',  '=', COMPANY],
        ['is_group', '=', 0],
        ['disabled', '=', 0],
      ]),
      limit_page_length: 0,
      order_by: 'warehouse_name asc',
    });
    const data = await this._fetch(`/api/resource/Warehouse?${params}`);
    const lista = (data?.data || []).map(w => ({
      name: w.name,
      label: w.warehouse_name || w.name,
      warehouse_type: w.warehouse_type || 'OTROS',
      parent_warehouse: w.parent_warehouse || null,
    }));
    this.#almacenesCache = lista;
    return lista;
  }

  /**
   * Devuelve únicamente warehouses tipo "Departamento" (Pan Dulce, Pan Blanco, etc).
   * Reemplaza al antiguo getAlmacenesDepartamento() sync hardcoded.
   * @returns {Promise<Array<{name, label}>>}
   */
  async fetchAlmacenesDepartamento() {
    const todos = await this.fetchAlmacenes();
    return todos.filter(w => w.warehouse_type === TIPO_DEPARTAMENTO);
  }

  /**
   * Devuelve warehouses agrupados por warehouse_type, con orden estable
   * (Departamento → Sucursal → Camioneta → Punto de Venta → otros).
   * @returns {Promise<Array<{tipo: string, almacenes: Array}>>}
   */
  async fetchAlmacenesAgrupados() {
    const todos = await this.fetchAlmacenes();
    const grupos = {};
    todos.forEach(w => {
      if (!grupos[w.warehouse_type]) grupos[w.warehouse_type] = [];
      grupos[w.warehouse_type].push(w);
    });
    const tiposOrdenados = [
      ...ORDEN_TIPOS.filter(t => grupos[t]),
      ...Object.keys(grupos).filter(t => !ORDEN_TIPOS.includes(t)),
    ];
    return tiposOrdenados.map(tipo => ({ tipo, almacenes: grupos[tipo] }));
  }

  /**
   * Bodega Central + Departamentos. Usado en RegistroEntrada (compras llegan a estos).
   * @returns {Promise<Array<{name, label}>>}
   */
  async fetchAllWarehouses() {
    const dept = await this.fetchAlmacenesDepartamento();
    return [{ name: BODEGA_CENTRAL, label: 'Bodega Central' }, ...dept];
  }

  /**
   * Bodega Central + TODOS los warehouses no-grupo (Departamentos, Sucursales,
   * Camionetas, Puntos de Venta). Usado en Inventario para vista "Por Almacén".
   * @returns {Promise<Array<{name, label, warehouse_type}>>}
   */
  async fetchAllWarehousesInclusive() {
    const todos = await this.fetchAlmacenes();
    return [
      { name: BODEGA_CENTRAL, label: 'Bodega Central', warehouse_type: 'BODEGA' },
      ...todos,
    ];
  }

  clearCache() { this.#almacenesCache = null; }

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
      fields: JSON.stringify(["item_code", "item_name", "stock_uom", "item_group", "custom_cantidad_por_presentación", "custom_presentación", "custom_precio_por_kg", "custom_precio_final", "custom_precio_de_compra", "valuation_rate"]),
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
  async registrarEntrada({ items, notas = "", warehouse = BODEGA_CENTRAL }) {
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const destino = warehouse || BODEGA_CENTRAL;
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          COMPANY,
      to_warehouse:     destino,
      remarks:          notas || "Entrada de insumos",
      items: items.map(item => {
        const row = {
          item_code:         item.item_code,
          t_warehouse:       item.almacen || destino,
          qty:               parseFloat(item.qty),
          uom:               item.uom,
          stock_uom:         item.uom,
          conversion_factor: 1,
          transfer_qty:      parseFloat(item.qty),
        };
        const rate = parseFloat(item.basic_rate);
        if (rate > 0) row.basic_rate = rate;
        return row;
      }),
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
   * Transacción de Manufactura ("Manufacture")
   * Descuenta ingredientes y suma el producto final al inventario.
   */
  async entradaPorManufactura(datos) {
    const items = [];
    
    // 1. Ingredientes (Salen)
    if (datos.ingredientes) {
      datos.ingredientes.forEach(item => {
        items.push({
          item_code: item.item_code,
          s_warehouse: datos.almacen_produccion,
          qty: parseFloat(item.cantidad),
          uom: item.uom,
          stock_uom: item.uom,
        });
      });
    }

    // 2. Producto Final (Entra)
    if (datos.producto_final) {
      items.push({
        item_code: datos.producto_final.item_code,
        t_warehouse: datos.almacen_produccion,
        qty: parseFloat(datos.producto_final.cantidad),
        uom: datos.producto_final.uom,
        stock_uom: datos.producto_final.uom,
        is_finished_item: 1,
      });
    }

    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Manufacture",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      bom_no:           datos.bom_no,
      remarks:          `Produccion: ${datos.orden_produccion}`,
      items:            items,
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