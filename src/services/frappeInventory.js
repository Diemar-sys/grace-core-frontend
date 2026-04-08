/**
 * FrappeInventoryService
 *
 * Versión optimizada: usa endpoints @frappe.whitelist() en gestion_panaderia
 * para consultas de inventario, y la API REST estándar de Frappe para
 * catálogos y operaciones de escritura (crear/editar ítems).
 *
 * Requiere: apps/gestion_panaderia/gestion_panaderia/api/inventory_api.py
 */

const FRAPPE_METHOD = (fn) =>
  `/api/method/gestion_panaderia.api.inventory_api.${fn}`;

const GRUPOS_PARA_VENTA = ["ABARROTES"];

class FrappeInventoryService {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  #cache = {};

  async #cachedFetch(key, fetchFn) {
    if (this.#cache[key]) return this.#cache[key];
    const result = await fetchFn();
    this.#cache[key] = result;
    return result;
  }

  /**
   * Genera los headers para HTTP, inyectando el token CSRF si está disponible.
   * @returns {Object} Headers estándar de Frappe.
   */
  getHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": window.csrf_token || "fetch",
    };
  }

  /**
   * Llama un método whitelisted en la app backend custom `gestion_panaderia`.
   * @private
   * @param {string} methodName - Nombre de la función en Python.
   * @param {Object} [params={}] - Parámetros GET (query string).
   * @returns {Promise<any>} Datos extraídos del atributo `message` retornado por Frappe.
   */
  async #callMethod(methodName, params = {}) {
    const queryString = Object.entries(params)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    const path = `${this.baseUrl}${FRAPPE_METHOD(methodName)}${queryString ? "?" + queryString : ""}`;

    const response = await fetch(path, {
      credentials: "include",
      headers: this.getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Error ${response.status} al llamar ${methodName}`);

    const json = await response.json();
    return json.message || [];
  }

  /**
   * Consulta recursos de la API REST nativa de Frappe.
   * @private
   * @param {string} path - URL base de Frappe REST API.
   * @param {Object} [options={}] - Configuraciones de fetch.
   * @returns {Promise<any>} Objeto JSON completo devuelto por el servidor.
   */
  async #fetchResource(path, options = {}) {
    const fetchOptions = {
      credentials: "include",
      headers: this.getHeaders(),
      cache: "no-store",
      ...options,
    };
    const response = await fetch(`${this.baseUrl}${path}`, fetchOptions);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        err._server_messages
          ? JSON.parse(JSON.parse(err._server_messages)[0]).message
          : err.message || `Error ${response.status}`
      );
    }

    return response.json();
  }

  // ─────────────────────────────────────────────
  // CATÁLOGOS
  // ─────────────────────────────────────────────

  // ── CATÁLOGOS ─────────────────────────────────────────────

  /**
   * Obtiene la lista de almacenes disponibles.
   * @returns {Promise<Array<Object>>} Lista de almacenes
   */
  async getWarehouses() {
    return this.#cachedFetch('warehouse', async () => {
      const data = await this.#fetchResource(
        `/api/resource/Warehouse?fields=["name","warehouse_name"]&filters=[["is_group","=",0],["disabled","=",0]]&limit_page_length=100`
      );
      return data.data || [];
    });
  }

  /**
   * Obtiene grupos de artículos de nivel hoja (no carpetas).
   * @returns {Promise<Array<Object>>} Lista de Item Groups
   */
  async getItemGroups() {
    return this.#cachedFetch('itemGroups', async () => {
      const data = await this.#fetchResource(
        `/api/resource/Item Group?fields=["name"]&filters=[["is_group","=",0]]&limit_page_length=100`
      );
      return data.data || [];
    });
  }

  /**
   * Obtiene Unidades de Medida activas.
   * @returns {Promise<Array<Object>>} Lista de UoM
   */
  async getUOMs() {
    return this.#cachedFetch('uoms', async () => {
      const data = await this.#fetchResource(
        `/api/resource/UOM?fields=["name","enabled"]&filters=[["enabled","=",1]]&limit_page_length=100`
      );
      return data.data || [];
    });
  }

  /**
   * Obtiene dinámicamente los departamentos mapeando desde los Almacenes de ERPNext.
   * Selecciona los que contienen 'ALMACEN -' y extrae la parte central (Ej: 'ALMACEN - PAN BLANCO - PG' -> 'PAN BLANCO').
   * @returns {Promise<Array<Object>>} Lista de departamentos
   */
  async getDepartamentos() {
    try {
      const warehouses = await this.getWarehouses();
      const depts = warehouses
        .filter(w => w.name && w.name.includes('ALMACEN -'))
        .map(w => {
          const parts = w.name.split('-');
          return { name: parts.length >= 2 ? parts[1].trim() : w.name };
        });

      if (depts.length > 0) return depts;
    } catch (e) {
      console.warn("Error cargando departamentos desde ERPNext", e);
    }
    // Fallback original para evitar pantalla vacía
    return [
      { name: "PAN BLANCO" },
      { name: "PAN DULCE" },
      { name: "PANQUELERIA" },
      { name: "REPOSTERIA" },
      { name: "PIZZERIA" }
    ];
  }

  /**
   * Obtiene dinámicamente las presentaciones leyendo las opciones del Custom Field.
   * @returns {Promise<Array<Object>>} Lista de presentaciones
   */
  async getPresentaciones() {
    return this.#cachedFetch('presentaciones', async () => {
      try {
        const data = await this.#fetchResource('/api/resource/Custom%20Field?filters=[["dt","=","Item"],["fieldname","=","custom_presentación"]]&fields=["options"]');
        if (data.data?.[0]?.options) {
          return data.data[0].options.split('\n').map(opt => ({ name: opt.trim() })).filter(opt => opt.name);
        }
      } catch (e) {
        console.warn("Error cargando presentaciones desde ERPNext", e);
        return [];
      }
    });
  }

  /**
   * Valida si un grupo de ítem específico es de venta pública.
   * @param {string} itemGroup - El grupo del artículo.
   * @returns {boolean} True si es para venta, False si es consumo interno.
   */
  esProductoParaVenta(itemGroup) { return GRUPOS_PARA_VENTA.includes(itemGroup); }

  // ─────────────────────────────────────────────
  // OBTENER ÍTEM COMPLETO PARA EDICIÓN
  // ─────────────────────────────────────────────

  // ── OBTENER ÍTEM COMPLETO PARA EDICIÓN ─────────────────────────────────────────────

  /**
   * Recupera la totalidad de los campos de un ítem. Útil para rellenar formularios de edición.
   * @param {string} itemCode - `item_code` identificador en Frappe.
   * @returns {Promise<Object>} Definición exhaustiva del Item.
   */
  async getItemCompleto(itemCode) {
    const fields = [
      "item_code", "item_name", "item_group", "stock_uom", "disabled", "description",
      "custom_código_interno", "custom_tipo_item", "custom_departamento",
      "custom_presentación", "custom_cantidad_por_presentación",
      "custom_precio_de_compra", "custom_impuesto", "custom_precio_por_kg", "custom_precio_final",
      "custom_precio_de_venta", "custom_porcentaje_de_ganancia", "custom_ganancia",
    ].join('","');

    const data = await this.#fetchResource(
      `/api/resource/Item/${encodeURIComponent(itemCode)}?fields=["${fields}"]`
    );
    return data.data;
  }

  // ── CONSULTAS DE INVENTARIO ─────────────────────────────────────────────

  /**
   * Obtiene stock general de todos los productos en una bodega determinada.
   * Agrega metadata para simplificar vistas consolidadas.
   * @param {string|null} warehouse - Almacén a consultar
   * @param {string|null} itemGroup - Grupo a prefiltrar
   * @returns {Promise<Array<Object>>} Lista de existencias
   */
  async getStock(warehouse = null, itemGroup = null) {
    const items = await this.#callMethod("get_items_con_stock", { warehouse, item_group: itemGroup });
    return items.map((item) => ({
      ...item,
      tipo_vista: "con_stock",
      tiene_stock: true,
    }));
  }

  async #injectPricingData(items) {
    if (!items || items.length === 0) return items;
    try {
      const chunkedItems = [];
      const chunkSize = 200;
      for (let i = 0; i < items.length; i += chunkSize) {
        chunkedItems.push(items.slice(i, i + chunkSize));
      }

      const extraMap = {};
      for (const chunk of chunkedItems) {
        const itemCodes = chunk.map(i => i.item_code);
        const urlParams = new URLSearchParams({
          fields: JSON.stringify(["item_code", "custom_precio_final", "custom_precio_de_compra", "custom_impuesto"]),
          filters: JSON.stringify([["item_code", "in", itemCodes]]),
          limit_page_length: chunkSize
        });
        const resp = await this.#fetchResource(`/api/resource/Item?${urlParams}`);
        (resp.data || []).forEach(e => { extraMap[e.item_code] = e; });
      }

      const IMPUESTOS = { 'tasa0': 0, 'iva16': 0.16, 'ieps': 0.08 };

      return items.map(item => {
        const extra = extraMap[item.item_code] || {};
        const compra = parseFloat(extra.custom_precio_de_compra) || 0;
        const tasa = IMPUESTOS[extra.custom_impuesto] || 0;
        const totalConImpuesto = compra > 0 ? compra * (1 + tasa) : null;

        return {
          ...item,
          custom_total_presentacion: totalConImpuesto,
          custom_precio_final: extra.custom_precio_final ?? null,
        };
      });
    } catch (e) {
      console.warn("Fallo inyectando precios:", e);
      return items;
    }
  }

  /**
   * Obtiene todos los artículos registrados. Se muestra su estado base 
   * omitiendo cálculos de saldo (útil para administración del catálogo maestro).
   * @param {Object} filtros - Filtros como `itemGroup`, `search`.
   * @returns {Promise<Array<Object>>} Lista cruda de items registrados.
   */
  async getProductosRegistrados(filtros = {}) {
    const { itemGroup, search, departamento, tipoItem } = filtros;
    let items = await this.#callMethod("get_inventory_view", {
      vista: "registrado", item_group: itemGroup, departamento, search, tipo_item: tipoItem,
    });

    const IMPUESTOS = { 'tasa0': 0, 'iva16': 0.16, 'ieps': 0.08 };

    return items.map((item) => {
      const compra = parseFloat(item.custom_precio_de_compra) || 0;
      const tasa = IMPUESTOS[item.custom_impuesto] || 0;
      return {
        ...item,
        custom_total_presentacion: compra > 0 ? compra * (1 + tasa) : null,
        tipo_vista: "registrado",
        stock_total: 0,
        tiene_stock: false,
      };
    });
  }

  /**
   * Solo retorna ítems cuyo saldo supera el parámetro minStock (>0 por defecto).
   * @param {Object} filtros - `warehouse`, `itemGroup`, `minStock`.
   * @returns {Promise<Array<Object>>} Lista con disponibilidad positiva.
   */
  async getProductosConStock(filtros = {}) {
    const { warehouse, itemGroup, minStock = 0, departamento } = filtros;
    const items = await this.#callMethod("get_items_con_stock", {
      warehouse, item_group: itemGroup, min_stock: minStock, departamento,
    });
    return items.map((item) => ({ ...item, tipo_vista: "con_stock", tiene_stock: true }));
  }

  /**
   * Retorna ítems descontinuados / marcados como `disabled=1`.
   * @param {Object} filtros - Opciones de filtrado (grupo, texto).
   * @returns {Promise<Array<Object>>} Lista de items inactivos.
   */
  async getProductosDeshabilitados(filtros = {}) {
    const { itemGroup, search, tipoItem } = filtros;
    let items = await this.#callMethod("get_inventory_view", {
      vista: "deshabilitado", item_group: itemGroup, search, tipo_item: tipoItem,
    });

    const IMPUESTOS = { 'tasa0': 0, 'iva16': 0.16, 'ieps': 0.08 };

    return items.map((item) => {
      const compra = parseFloat(item.custom_precio_de_compra) || 0;
      const tasa = IMPUESTOS[item.custom_impuesto] || 0;
      return {
        ...item,
        custom_total_presentacion: compra > 0 ? compra * (1 + tasa) : null,
        tipo_vista: "deshabilitado",
        fecha_deshabilitado: item.modified,
        stock_restante: 0,
      };
    });
  }

  /**
   * Consulta ítems cuyo stock está en 0 de forma estricta (o es negativo).
   * @param {Object} filtros - Bodega y Grupo específico.
   * @returns {Promise<Array<Object>>} Lista de productos agotados.
   */
  async getProductosAgotados(filtros = {}) {
    const { warehouse, itemGroup, departamento } = filtros;
    const items = await this.#callMethod("get_items_sin_stock", {
      warehouse, item_group: itemGroup, departamento,
    });
    return items.map((item) => ({ ...item, tipo_vista: "agotado", ultimo_stock: 0, fecha_agotado: "Desconocida" }));
  }

  // ─────────────────────────────────────────────
  // ESCRITURA
  // ─────────────────────────────────────────────

  /**
   * Registra un nuevo Item en el catálogo de Frappe.
   * Mapea todas las variables personalizadas (custom_*).
   * @param {Object} formData - Objeto con valores del formulario NuevoInsumo.
   * @returns {Promise<Object>} Datos creados por el ERP.
   */
  async createItem(formData) {
    const payload = {
      doctype: "Item",
      item_code: formData.item_code?.trim().toUpperCase(),
      item_name: formData.item_name?.trim(),
      item_group: formData.item_group,
      stock_uom: formData.stock_uom,
      custom_código_interno: formData.custom_código_interno || "",
      custom_departamento: formData.custom_departamento || "",
      custom_presentación:
        formData.custom_presentacion || formData.custom_presentación || "",
      custom_cantidad_por_presentación:
        parseFloat(formData.custom_cantidad_por_presentacion || formData.custom_cantidad_por_presentación) || null,
      custom_precio_de_compra: parseFloat(formData.custom_precio_de_compra) || null,
      custom_tipo_item: formData.custom_tipo_item || "MATERIA PRIMA",
      custom_impuesto: formData.custom_impuesto || "tasa0",
      custom_precio_por_kg: parseFloat(formData.custom_precio_por_kg) || null,
      custom_precio_final: parseFloat(formData.custom_precio_final) || null,
      custom_precio_de_venta: parseFloat(formData.custom_precio_de_venta) || null,
      custom_porcentaje_de_ganancia: parseFloat(formData.custom_porcentaje_de_ganancia) || null,
      custom_ganancia: parseFloat(formData.custom_ganancia) || null,
      disabled: formData.disabled ? 1 : 0,
      description: formData.description || "",
      is_stock_item: 1,
    };

    const data = await this.#fetchResource("/api/resource/Item", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.data;
  }

  /**
   * Actualiza los datos de un ítem existente en Frappe (Método PUT).
   * @param {string} itemCode - PK original en Frappe.
   * @param {Object} formData - Objetos modificados desde el Front.
   * @returns {Promise<Object>} Datos actualizados.
   */
  async updateItem(itemCode, formData) {
    const payload = {
      item_name: formData.item_name?.trim(),
      item_group: formData.item_group,
      stock_uom: formData.stock_uom,
      custom_código_interno: formData.custom_código_interno || "",
      custom_departamento: formData.custom_departamento || "",
      custom_presentación:
        formData.custom_presentacion || formData.custom_presentación || "",
      custom_cantidad_por_presentación:
        parseFloat(formData.custom_cantidad_por_presentacion || formData.custom_cantidad_por_presentación) || null,
      custom_precio_de_compra: parseFloat(formData.custom_precio_de_compra) || null,
      custom_tipo_item: formData.custom_tipo_item || "MATERIA PRIMA",
      custom_impuesto: formData.custom_impuesto || "tasa0",
      custom_precio_por_kg: parseFloat(formData.custom_precio_por_kg) || null,
      custom_precio_final: parseFloat(formData.custom_precio_final) || null,
      custom_precio_de_venta: parseFloat(formData.custom_precio_de_venta) || null,
      custom_porcentaje_de_ganancia: parseFloat(formData.custom_porcentaje_de_ganancia) || null,
      custom_ganancia: parseFloat(formData.custom_ganancia) || null,
      disabled: formData.disabled ? 1 : 0,
      description: formData.description || "",
    };

    const data = await this.#fetchResource(
      `/api/resource/Item/${encodeURIComponent(itemCode)}`,
      { method: "PUT", body: JSON.stringify(payload) }
    );
    return data.data;
  }

  // ── ELIMINAR / DESHABILITAR ─────────────────────────────────────────────

  /**
   * Renombra (cambia la PK) de un Item en Frappe usando rename_doc.
   * @param {string} oldCode - `item_code` original.
   * @param {string} newCode - Nuevo `item_code` deseado.
   * @returns {Promise<string>} El nuevo nombre asignado por Frappe.
   */
  async renameItem(oldCode, newCode) {
    const response = await fetch(
      `${this.baseUrl}/api/method/frappe.client.rename_doc`,
      {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders(),
        body: JSON.stringify({
          doctype: 'Item',
          old_name: oldCode,
          new_name: newCode.trim().toUpperCase(),
          merge: 0
        })
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        err._server_messages
          ? JSON.parse(JSON.parse(err._server_messages)[0]).message
          : err.message || `Error ${response.status} al renombrar`
      );
    }
    const json = await response.json();
    return json.message; // Frappe returns the new name
  }

  /**
   * Elimina un registro base de Frappe (sólo permitido si no tiene historial de movimientos).
   * @param {string} itemCode 
   * @returns {Promise<void>}
   */
  async deleteItem(itemCode) {
    // ERPNext rechaza el DELETE si el item tiene transacciones vinculadas
    await this.#fetchResource(
      `/api/resource/Item/${encodeURIComponent(itemCode)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Desactiva lógicamente el producto marcando 'disabled = 1'.
   * @param {string} itemCode 
   * @returns {Promise<Object>}
   */
  async disableItem(itemCode) {
    const data = await this.#fetchResource(
      `/api/resource/Item/${encodeURIComponent(itemCode)}`,
      { method: "PUT", body: JSON.stringify({ disabled: 1 }) }
    );
    return data.data;
  }

  /**
   * Reactiva lógicamente el producto marcando 'disabled = 0'.
   * @param {string} itemCode 
   * @returns {Promise<Object>}
   */
  async enableItem(itemCode) {
    const data = await this.#fetchResource(
      `/api/resource/Item/${encodeURIComponent(itemCode)}`,
      { method: "PUT", body: JSON.stringify({ disabled: 0 }) }
    );
    return data.data;
  }
}

export const inventory = new FrappeInventoryService();
export default FrappeInventoryService;