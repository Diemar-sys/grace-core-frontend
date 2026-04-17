/**
 * FrappeComprasService
 * Maneja Purchase Receipt en ERPNext para registro de compras a proveedores.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL } from '../config/constants';

const IMPUESTOS = [
  { key: "tasa0", label: "Tasa 0", rate: 0 },
  { key: "iva16", label: "IVA 16%", rate: 0.16 },
  { key: "ieps", label: "IEPS 8%", rate: 0.08 },
];

class FrappeComprasService extends FrappeBase {
  /**
   * Obtiene la lista de impuestos aplicables predefinidos.
   * @returns {Array<{key: string, label: string, rate: number}>} Lista de impuestos predefinidos.
   */
  getImpuestos() { return IMPUESTOS; }

  async getItemsCatalogo(itemCodes) {
    const res = await this._fetch(
      `/api/method/gestion_panaderia.api.compras_api.get_items_catalogo?item_codes=${encodeURIComponent(JSON.stringify(itemCodes))}`
    );
    return res.message || [];
  }

  // ── Auto-incremento No. de Compra ────────────────────────────────────────
  
  /**
   * Obtiene el siguiente número de compra consecutivo leyendo el último
   * documento de tipo 'Purchase Receipt' registrado en el sistema.
   * @returns {Promise<number>} Siguiente número de compra disponible.
   */
  async getSiguienteNumero() {
    const params = new URLSearchParams({
      fields: JSON.stringify(["custom_no_de_compra"]),
      filters: JSON.stringify([["docstatus", "in", [0, 1]]]),
      order_by: "custom_no_de_compra desc",
      limit_page_length: 1,
    });
    const data = await this._fetch("/api/resource/Purchase Receipt?" + params);
    const ultimo = data.data?.[0]?.custom_no_de_compra || 0;
    return ultimo + 1;
  }

  /**
   * Busca proveedores activos en la base de datos de ERPNext.
   * Requiere mínimo 2 caracteres para evitar consultas demasiado amplias.
   * Cancela automáticamente el request anterior si se llama de nuevo antes de recibir respuesta.
   * @param {string} [search=""] - Término de búsqueda parcial (filtrará por nombre).
   * @returns {Promise<Array<Object>>} Lista de proveedores que coincidan.
   */
  async buscarProveedores(search = "") {
    // 🛑 Mínimo 2 caracteres: evita queries como "%a%" que devuelven toda la tabla
    if (search.length > 0 && search.length < 2) return [];

    // Cancelar request anterior (AbortController)
    if (this._abortProveedor) this._abortProveedor.abort();
    this._abortProveedor = new AbortController();

    const filters = [["disabled", "=", 0]];
    if (search) filters.push(["supplier_name", "like", "%" + search + "%"]);
    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "supplier_name", "supplier_group"]),
      filters: JSON.stringify(filters),
      limit_page_length: 20,
    });
    try {
      const data = await this._fetch("/api/resource/Supplier?" + params, {
        signal: this._abortProveedor.signal,
      });
      return data?.data || [];
    } catch (err) {
      if (err.name === "AbortError") return [];  // Request cancelado intencionalmente
      throw err;
    }
  }

  /**
   * Busca insumos/productos habilitados en el sistema ERPNext.
   * Requiere mínimo 3 caracteres para reducir la carga en la base de datos.
   * Cancela automáticamente el request anterior si se llama antes de recibir respuesta.
   * @param {string} [search=""] - Término de búsqueda parcial (filtrará por nombre del ítem).
   * @returns {Promise<Array<Object>>} Lista de ítems con detalles de stock y precio.
   */
  async buscarItems(search = "") {
    // 🛑 Mínimo 3 caracteres: una "h" devuelve TODA la tabla Item sin filtro útil
    if (search.length > 0 && search.length < 3) return [];

    // Cancelar request anterior si el usuario sigue escribiendo
    if (this._abortItems) this._abortItems.abort();
    this._abortItems = new AbortController();

    const filters = [["disabled", "=", 0]];
    if (search) filters.push(["item_name", "like", "%" + search + "%"]);
    const params = new URLSearchParams({
      fields: JSON.stringify([
        "item_code", "item_name", "stock_uom", "item_group",
        "last_purchase_rate", "custom_impuesto",
        "custom_cantidad_por_presentación", "custom_precio_de_compra",
        "custom_precio_por_kg",
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: 20,
    });
    try {
      const data = await this._fetch("/api/resource/Item?" + params, {
        signal: this._abortItems.signal,
      });
      return data?.data || [];
    } catch (err) {
      if (err.name === "AbortError") return [];  // Request cancelado intencionalmente
      throw err;
    }
  }

  /**
   * Calcula y agrupa los impuestos generados por los ítems comprados.
   * Prepara la estructura JSON esperada por ERPNext para la tabla de impuestos.
   * @private
   * @param {Array<Object>} items - Lista de ítems de la compra.
   * @returns {Array<Object>} Arreglo de impuestos agrupados por tipo (IVA, IEPS, etc.)
   */
  _calcularImpuestos(items) {
    const grupos = {};
    items.forEach(item => {
      const rate = parseFloat(item.impuesto_rate || 0);
      const key = item.impuesto_key || "tasa0";
      const label = item.impuesto_label || "Tasa 0";
      const base = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
      const monto = base * rate;
      if (!grupos[key]) grupos[key] = { label, rate, monto: 0 };
      grupos[key].monto += monto;
    });
    return Object.values(grupos)
      .filter(g => g.monto > 0)
      .map(g => ({
        charge_type: "Actual",
        description: g.label,
        tax_amount: parseFloat(g.monto.toFixed(2)),
        account_head: g.label.startsWith("IVA")
          ? "IVA por Acreditar - PG"
          : "IEPS por Acreditar - PG",
      }));
  }

  // ── Construye el payload base ────────────────────────────────────────────
  
  /**
   * Construye el cuerpo (payload) JSON para la creación o actualización de 'Purchase Receipt'.
   * Transforma los datos de la interfaz a la estructura que espera la API de ERPNext.
   * @private
   * @param {Object} data - Datos del formulario de la compra.
   * @param {string} data.supplier - ID del proveedor.
   * @param {string} [data.fecha] - Fecha de entrega (formato YYYY-MM-DD).
   * @param {string} [data.billNo=""] - Número de factura/nota del proveedor.
   * @param {Array<Object>} data.items - Ítems comprados.
   * @param {string} [data.notas=""] - Comentarios de la compra.
   * @param {number|string} [data.ajuste=0] - Ajuste por redondeo.
   * @param {number|null} [data.noCompra=null] - Número de compra interno para el documento.
   * @returns {Object} Payload final para enviar a Frappe.
   */
  _buildPayload({ supplier, fecha, billNo = "", items, notas = "", ajuste = 0, noCompra = null }) {
    const resumenImpuestos = this._calcularImpuestos(items);
    const ajusteNum = parseFloat(ajuste || 0);

    if (ajusteNum !== 0) {
      resumenImpuestos.push({
        charge_type: "Actual",
        description: "Ajuste por Redondeo",
        tax_amount: ajusteNum,
        account_head: "AJUSTE POR REDONDEO - PG", // Coincide con la cuenta creada por el usuario
      });
    }

    return {
      doctype: "Purchase Receipt",
      supplier: supplier,
      company: COMPANY,
      posting_date: fecha || new Date().toISOString().split("T")[0],
      supplier_delivery_note: billNo || "",
      set_warehouse: BODEGA_CENTRAL,
      remarks: notas || "",
      custom_no_de_compra: noCompra || null,
      items: items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: parseFloat(item.qty),
        rate: parseFloat(item.rate),
        uom: item.uom,
        stock_uom: item.uom,
        warehouse: BODEGA_CENTRAL,
        conversion_factor: 1,
        description: "Impuesto: " + (item.impuesto_label || "Tasa 0"),
      })),
      taxes: resumenImpuestos,
      // Se removió disable_rounded_total y rounding_adjustment explícito del root
      // ya que ERPNext los gestiona ahora sumando la tabla taxes.
    };
  }

  // ── Guardar borrador (docstatus: 0) ─────────────────────────────────────
  
  /**
   * Crea un 'Purchase Receipt' en estado Borrador (docstatus: 0)
   * @param {Object} data - Datos de la compra provenientes del formulario.
   * @returns {Promise<Object>} Datos del documento creado en ERPNext.
   */
  async guardarBorrador({ supplier, fecha, billNo, items, notas, ajuste }) {
    if (!supplier) throw new Error("Selecciona un proveedor");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const noCompra = await this.getSiguienteNumero();
    const payload = this._buildPayload({ supplier, fecha, billNo, items, notas, ajuste, noCompra });
    const created = await this._fetch("/api/resource/Purchase Receipt", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return created.data;
  }

  // ── Confirmar compra nueva (docstatus: 1) ────────────────────────────────
  
  /**
   * Crea un 'Purchase Receipt' e inmediatamente lo submitea/confirma (docstatus: 1).
   * Genera el movimiento de inventario bloqueándolo de futuras ediciones.
   * @param {Object} data - Datos de la compra provenientes del formulario.
   * @returns {Promise<Object>} Datos del documento final.
   */
  async registrarCompra({ supplier, fecha, billNo, items, notas, ajuste }) {
    if (!supplier) throw new Error("Selecciona un proveedor");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const noCompra = await this.getSiguienteNumero();
    const payload = this._buildPayload({ supplier, fecha, billNo, items, notas, ajuste, noCompra });
    const created = await this._fetch("/api/resource/Purchase Receipt", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(created.data.name),
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) }
    );
    return created.data;
  }

  // ── Obtener borrador completo para editar ────────────────────────────────
  
  /**
   * Recupera todos los detalles de una compra en borrador para su recuperación en la UI.
   * @param {string} name - Identificador (name) del Purchase Receipt.
   * @returns {Promise<Object>} Datos del documento recuperado.
   */
  async getCompraBorrador(name) {
    const data = await this._fetch("/api/resource/Purchase Receipt/" + encodeURIComponent(name));
    return data.data;
  }

  // ── Actualizar borrador existente (sin submitear) ────────────────────────
  
  /**
   * Actualiza los datos de un 'Purchase Receipt' previamente guardado como Borrador.
   * Evita modificar compras que ya hayan sido sometidas.
   * @param {string} name - Identificador de la compra.
   * @param {Object} data - Nuevos datos.
   * @returns {Promise<Object>} Datos actualizados.
   */
  async actualizarBorrador(name, { supplier, fecha, billNo, items, notas, ajuste }) {
    if (!supplier) throw new Error("Selecciona un proveedor");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    // Obtener el no_de_compra existente para no reasignar uno nuevo
    const doc = await this.getCompraBorrador(name);
    const noCompra = doc.custom_no_de_compra || null;
    const payload = this._buildPayload({ supplier, fecha, billNo, items, notas, ajuste, noCompra });
    const updated = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "PUT", body: JSON.stringify(payload) }
    );
    return updated.data;
  }

  // ── Confirmar borrador existente ─────────────────────────────────────────
  
  /**
   * Pasa un Borrador existente (docstatus: 0) a estado Solicitado/Submiteado (docstatus: 1).
   * @param {string} name - Identificador de la compra.
   * @returns {Promise<Object>} Datos actualizados luego del submit.
   */
  async confirmarBorrador(name) {
    const updated = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) }
    );
    return updated.data;
  }

  // ── Actualizar precio en Catálogo ────────────────────────────────────────

  /**
   * Actualiza únicamente los campos de precio de compra y precio por KG
   * en el Catálogo de un Item, sin tocar otros campos.
   * Se usa al confirmar una compra cuando el precio cambió dentro del margen permitido.
   * @param {string} itemCode - Código del item en ERPNext.
   * @param {number} nuevoPrecioCompra - Nuevo precio por empaque/bulto.
   * @param {number|null} nuevoPrecioPorKg - Nuevo precio por KG (null si no aplica).
   * @returns {Promise<Object>} Datos actualizados del item.
   */
  async actualizarPrecioCatalogo(itemCode, nuevoPrecioCompra, nuevoPrecioPorKg = null) {
    const payload = { custom_precio_de_compra: parseFloat(nuevoPrecioCompra) };
    if (nuevoPrecioPorKg !== null && nuevoPrecioPorKg !== undefined) {
      payload.custom_precio_por_kg = parseFloat(nuevoPrecioPorKg);
    }
    const data = await this._fetch(
      `/api/resource/Item/${encodeURIComponent(itemCode)}`,
      { method: "PUT", body: JSON.stringify(payload) }
    );
    return data.data;
  }

  // ── Cancelar compra confirmada (docstatus: 1 → 2) ───────────────────────

  /**
   * Cancela un Purchase Receipt confirmado (docstatus 1).
   * ERPNext revierte automáticamente el movimiento de inventario.
   * El documento queda como historial con docstatus=2.
   * @param {string} name - Identificador de la compra.
   * @returns {Promise<Object>} Datos del documento cancelado.
   */
  async cancelarCompra(name) {
    const data = await this._fetch(
      "/api/method/frappe.client.cancel",
      {
        method: "POST",
        body: JSON.stringify({ doctype: "Purchase Receipt", name }),
      }
    );
    return data.message;
  }

  // ── Eliminar borrador existente ──────────────────────────────────────────
  
  /**
   * Elimina un Borrador permanentemente de la base de datos de Frappe.
   * @param {string} name - Identificador de la compra a eliminar.
   * @returns {Promise<Object>} Respuesta de cancelación.
   */
  async eliminarBorrador(name) {
    const result = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "DELETE" }
    );
    return result;
  }

  // ── Lista de compras ─────────────────────────────────────────────────────
  
  /**
   * Obtiene la lista histórico de compras filtrada por fechas o proveedor.
   * @param {Object} filtros - Rango de fechas y/o proveedor específico.
   * @returns {Promise<Array<Object>>} Lista de documentos de Purchase Receipt.
   */
  async getCompras({ desde = null, hasta = null, supplier = null } = {}, signal) {
    const filters = [["docstatus", "in", [0, 1, 2]]];
    if (desde) filters.push(["posting_date", ">=", desde]);
    if (hasta) filters.push(["posting_date", "<=", hasta]);
    if (supplier) filters.push(["supplier", "=", supplier]);
    const params = new URLSearchParams({
      fields: JSON.stringify([
        "name", "supplier", "supplier_name", "docstatus",
        "posting_date", "total", "grand_total", "status",
        "custom_no_de_compra", "rounding_adjustment",
      ]),
      filters: JSON.stringify(filters),
      order_by: "custom_no_de_compra desc",
      limit_page_length: 100,
    });
    const data = await this._fetch("/api/resource/Purchase Receipt?" + params, { signal });
    return data?.data || [];
  }

  /**
   * Recupera las compras anteriores (historial de facturas) para un ítem determinado.
   * Útil para observar y graficar la volatilidad en los precios de compra.
   * @param {string} itemCode - Código de producto de Frappe.
   * @param {number} [meses=6] - Rango de retroceso en meses para evaluar costos.
   * @returns {Promise<Array<Object>>} Histórico de precios por ítem.
   */
  async getHistorialPrecios(itemCode, meses = 6) {
    const desde = new Date();
    desde.setMonth(desde.getMonth() - meses);
    const desdeStr = desde.toISOString().split("T")[0];
    const params = new URLSearchParams({
      fields: JSON.stringify([
        "parent", "item_code", "item_name",
        "qty", "rate", "amount", "uom", "posting_date",
      ]),
      filters: JSON.stringify([
        ["item_code", "=", itemCode],
        ["posting_date", ">=", desdeStr],
        ["docstatus", "=", 1],
      ]),
      order_by: "posting_date asc",
      limit_page_length: 200,
    });
    const data = await this._fetch("/api/resource/Purchase Receipt Item?" + params);
    return data.data || [];
  }
}

export const comprasService = new FrappeComprasService();
export default FrappeComprasService;