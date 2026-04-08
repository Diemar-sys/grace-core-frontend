/**
 * FrappeProduccionService
 * Gestiona recetas (BOM) y registro de producción usando
 * el DocType BOM de ERPNext y Stock Entry (Material Issue)
 * ya disponible en frappeStock.js.
 */

import { stockService } from './frappeStock';

const COMPANY = 'Panaderias Grace';

class FrappeProduccionService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  getHeaders() {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': window.csrf_token || 'fetch',
    };
  }

  async _fetch(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: this.getHeaders(),
      ...options,
    });
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
  // RECETAS (BOM)
  // ─────────────────────────────────────────────

  /**
   * Lista recetas (BOMs) activas, con opción de búsqueda por nombre.
   * @param {string} [search=''] - Texto de búsqueda.
   * @returns {Promise<Array>} Lista de BOMs.
   */
  async getBOMs(search = '') {
    const filters = [['docstatus', '!=', 2]];
    if (search) filters.push(['item', 'like', `%${search}%`]);
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'item', 'item_name', 'quantity', 'uom', 'is_active', 'is_default', 'creation']),
      filters: JSON.stringify(filters),
      order_by: 'creation desc',
      limit_page_length: 200,
    });
    const data = await this._fetch(`/api/resource/BOM?${params}`);
    return data.data || [];
  }

  /**
   * Obtiene el detalle completo de una receta, incluyendo la tabla de ingredientes.
   * @param {string} bomName - ID del BOM.
   * @returns {Promise<Object>} Definición completa del BOM.
   */
  async getBOMDetalle(bomName) {
    const data = await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`);
    return data.data;
  }

  /**
   * Crea una nueva receta (BOM) en ERPNext como borrador.
   * @param {Object} payload - Datos de la receta.
   * @param {string} payload.item - item_code del producto final.
   * @param {number} payload.quantity - Cantidad que produce la receta.
   * @param {string} payload.uom - Unidad del producto final.
   * @param {Array}  payload.items - Ingredientes [{item_code, qty, uom}].
   * @param {string} [payload.custom_departamento] - Departamento asociado.
   * @returns {Promise<Object>} Datos del BOM creado.
   */
  async crearBOM({ item, quantity, uom, items, custom_departamento = '' }) {
    const data = await this._fetch('/api/resource/BOM', {
      method: 'POST',
      body: JSON.stringify({
        doctype: 'BOM',
        item,
        quantity: parseFloat(quantity) || 1,
        uom,
        company: COMPANY,
        custom_departamento,
        items: items.map(i => ({
          item_code: i.item_code,
          qty: parseFloat(i.qty),
          uom: i.uom,
          stock_uom: i.uom,
          description: i.item_name || '',
        })),
      }),
    });
    return data.data;
  }

  /**
   * Activa una receta (la pone en docstatus=1 y la marca como activa y predeterminada).
   * @param {string} bomName - ID del BOM.
   * @returns {Promise<Object>} BOM actualizado.
   */
  async activarBOM(bomName) {
    // Primero submiteamos (docstatus 0 → 1)
    await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
      method: 'PUT',
      body: JSON.stringify({ docstatus: 1 }),
    });
    // Luego marcamos activa y predeterminada
    const data = await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: 1, is_default: 1 }),
    });
    return data.data;
  }

  /**
   * Busca ingredientes (materias primas) para la tabla de ingredientes del BOM.
   * @param {string} search - Texto de búsqueda.
   * @returns {Promise<Array>} Lista de ítems activos.
   */
  async buscarItems(search = '') {
    return stockService.buscarItemsTexto(search);
  }

  /**
   * Busca SOLO productos terminados para el campo "Producto Final" del BOM.
   * Filtra por custom_tipo_item = 'PRODUCTO TERMINADO'.
   * @param {string} search - Texto de búsqueda.
   * @returns {Promise<Array>} Lista de productos terminados.
   */
  async buscarProductosTerminados(search = '') {
    const filters = [
      ['disabled', '=', 0],
      ['custom_tipo_item', '=', 'PRODUCTO TERMINADO'],
    ];
    if (search) filters.push(['item_name', 'like', `%${search}%`]);
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'item_name', 'stock_uom', 'custom_precio_de_venta']),
      filters: JSON.stringify(filters),
      limit_page_length: 20,
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    return data.data || [];
  }

  /**
   * Obtiene el precio por unidad (custom_precio_por_kg) de una lista de items
   * para calcular el costo estimado de producción.
   * @param {Array<string>} itemCodes - Lista de item_code de los ingredientes.
   * @returns {Promise<Object>} Mapa { item_code: precio_por_unidad }
   */
  async getPreciosIngredientes(itemCodes) {
    if (!itemCodes.length) return {};
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'custom_precio_por_kg']),
      filters: JSON.stringify([['item_code', 'in', itemCodes]]),
      limit_page_length: 500,
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    const mapa = {};
    (data.data || []).forEach(item => {
      mapa[item.item_code] = parseFloat(item.custom_precio_por_kg) || 0;
    });
    return mapa;
  }

  // ─────────────────────────────────────────────
  // REGISTRO DE PRODUCCIÓN
  // ─────────────────────────────────────────────

  /**
   * Registra la producción de X unidades de un producto:
   * Consume los ingredientes del BOM × cantidad_producida desde el almacén del departamento.
   * @param {Object} args
   * @param {string} args.bomName - ID del BOM (receta).
   * @param {number} args.cantidadProducida - Cuántas unidades se produjeron.
   * @param {string} args.almacenOrigen - Almacén del departamento donde se consumen los insumos.
   * @returns {Promise<Object>} Stock Entry generado.
   */
  async registrarProduccion({ bomName, cantidadProducida, almacenOrigen }) {
    const bom = await this.getBOMDetalle(bomName);
    const factorProduccion = parseFloat(cantidadProducida) / (parseFloat(bom.quantity) || 1);

    const items = (bom.items || []).map(i => ({
      item_code: i.item_code,
      item_name: i.item_name,
      cantidad: (parseFloat(i.qty) * factorProduccion),
      uom: i.stock_uom || i.uom,
      almacen_origen: almacenOrigen,
      precio_promedio: parseFloat(i.rate) || 0,
    }));

    return stockService.salidaPorProduccion({
      company: COMPANY,
      fecha: new Date().toISOString().split('T')[0],
      orden_produccion: `BOM: ${bom.item_name} × ${cantidadProducida}`,
      items,
    });
  }

  // ─────────────────────────────────────────────
  // ALERTAS DE STOCK BAJO
  // ─────────────────────────────────────────────

  /**
   * Consulta qué ítems tienen stock actual <= nivel mínimo de reorden en un almacén dado.
   * @param {string} warehouse - ID del almacén a consultar.
   * @returns {Promise<Array>} Lista de ítems con stock bajo.
   */
  async getStockBajoMinimo(warehouse) {
    const res = await this._fetch(
      `/api/method/gestion_panaderia.api.produccion_api.get_stock_bajo_minimo?warehouse=${encodeURIComponent(warehouse)}`
    );
    return res.message || [];
  }
}

export const produccionService = new FrappeProduccionService();
export default FrappeProduccionService;
