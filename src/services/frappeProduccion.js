/**
 * FrappeProduccionService
 * Gestiona recetas (BOM) y registro de producción usando
 * el DocType BOM de ERPNext y Stock Entry (Material Issue)
 * ya disponible en frappeStock.js.
 */

import FrappeBase from './FrappeBase';
import { stockService } from './frappeStock';
import { COMPANY } from '../config/constants';

class FrappeProduccionService extends FrappeBase {

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
   * Actualiza una receta (BOM) existente (solo posible si es borrador / docstatus=0).
   * @param {string} bomName - ID del BOM.
   * @param {Object} payload - Datos de la receta a actualizar.
   * @returns {Promise<Object>} Datos del BOM actualizado.
   */
  async actualizarBOM(bomName, { item, quantity, uom, items, custom_departamento = '' }) {
    const data = await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
      method: 'PUT',
      body: JSON.stringify({
        item,
        quantity: parseFloat(quantity) || 1,
        uom,
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
  // COSTEO BOM
  // ─────────────────────────────────────────────

  /**
   * Obtiene costo MP por ingrediente. Incluye custom_precio_final (con
   * impuestos cuando aplica; igual a precio_por_kg si MP es tasa 0) y
   * custom_precio_por_kg (base sin impuesto).
   * @param {Array<string>} itemCodes
   * @returns {Promise<Object>} Mapa { item_code: { precio_final, precio_por_kg } }
   */
  async getPreciosCosteo(itemCodes) {
    if (!itemCodes.length) return {};
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'custom_precio_final', 'custom_precio_por_kg']),
      filters: JSON.stringify([['item_code', 'in', itemCodes]]),
      limit_page_length: 500,
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    const mapa = {};
    (data.data || []).forEach(item => {
      mapa[item.item_code] = {
        precio_final: parseFloat(item.custom_precio_final) || 0,
        precio_por_kg: parseFloat(item.custom_precio_por_kg) || 0,
      };
    });
    return mapa;
  }

  /**
   * Calcula costo de producción de UN item PRODUCTO TERMINADO sumando
   * MP × precio_final desde su BOM activa default.
   * @param {string} itemCode - item_code del PT.
   * @returns {Promise<Object|null>} { bomName, costoTotal, costoPorUnidad,
   *   cantidadProducida, uom, ingredientes:[{item_code, item_name, qty,
   *   precio_final, costo}] } o null si no hay BOM activa.
   */
  async calcularCostoBOM(itemCode) {
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'item', 'quantity', 'uom']),
      filters: JSON.stringify([
        ['item', '=', itemCode],
        ['is_active', '=', 1],
        ['is_default', '=', 1],
        ['docstatus', '=', 1],
      ]),
      limit_page_length: 1,
    });
    const bomList = await this._fetch(`/api/resource/BOM?${params}`);
    const bomMeta = (bomList.data || [])[0];
    if (!bomMeta) return null;

    const bom = await this.getBOMDetalle(bomMeta.name);
    const items = bom.items || [];
    if (!items.length) return null;

    const codes = [...new Set(items.map(i => i.item_code))];
    const precios = await this.getPreciosCosteo(codes);

    let costoTotal = 0;
    const ingredientes = items.map(i => {
      const precioFinal = precios[i.item_code]?.precio_final || 0;
      const qty = parseFloat(i.qty) || 0;
      const costo = precioFinal * qty;
      costoTotal += costo;
      return {
        item_code: i.item_code,
        item_name: i.item_name || i.description || i.item_code,
        qty,
        uom: i.stock_uom || i.uom,
        precio_final: precioFinal,
        costo,
      };
    });

    const cantidadProducida = parseFloat(bom.quantity) || 1;
    return {
      bomName: bom.name,
      costoTotal,
      costoPorUnidad: costoTotal / cantidadProducida,
      cantidadProducida,
      uom: bom.uom,
      ingredientes,
    };
  }

  /**
   * Calcula costo BOM en lote para muchos PT. Paraleliza con Promise.all.
   * @param {Array<string>} itemCodes
   * @returns {Promise<Object>} Mapa { item_code: resultado_calcularCostoBOM | null }
   */
  async calcularCostosBOMBatch(itemCodes) {
    if (!itemCodes.length) return {};
    const resultados = await Promise.all(
      itemCodes.map(code => this.calcularCostoBOM(code).catch(() => null))
    );
    const mapa = {};
    itemCodes.forEach((code, i) => { mapa[code] = resultados[i]; });
    return mapa;
  }

  /**
   * Costeo en vivo desde un arreglo de ingredientes (sin BOM persistido).
   * Para uso en NuevaReceta mientras el usuario arma la receta.
   * @param {Array} ingredientes - [{item_code, qty, ...}]
   * @param {number} cantidadProducida - Cuántas unidades produce la receta.
   * @returns {Promise<Object>} { costoTotal, costoPorUnidad, detalle:[{item_code, qty, precio_final, costo}] }
   */
  async calcularCostoEnVivo(ingredientes, cantidadProducida) {
    const validos = ingredientes.filter(i => i.item_code && parseFloat(i.qty) > 0);
    if (!validos.length) return { costoTotal: 0, costoPorUnidad: 0, detalle: [] };

    const codes = [...new Set(validos.map(i => i.item_code))];
    const precios = await this.getPreciosCosteo(codes);

    let costoTotal = 0;
    const detalle = validos.map(i => {
      const precioFinal = precios[i.item_code]?.precio_final || 0;
      const qty = parseFloat(i.qty);
      const costo = precioFinal * qty;
      costoTotal += costo;
      return { item_code: i.item_code, qty, precio_final: precioFinal, costo };
    });

    const cant = parseFloat(cantidadProducida) || 1;
    return { costoTotal, costoPorUnidad: costoTotal / cant, detalle };
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

    const ingredientes = (bom.items || []).map(i => ({
      item_code: i.item_code,
      item_name: i.item_name,
      cantidad: (parseFloat(i.qty) * factorProduccion),
      uom: i.stock_uom || i.uom,
      precio_promedio: parseFloat(i.rate) || 0,
    }));

    return stockService.entradaPorManufactura({
      company: COMPANY,
      fecha: new Date().toISOString().split('T')[0],
      orden_produccion: `BOM: ${bom.item_name} × ${cantidadProducida}`,
      bom_no: bomName,
      almacen_produccion: almacenOrigen,
      producto_final: {
        item_code: bom.item,
        cantidad: cantidadProducida,
        uom: bom.uom
      },
      ingredientes
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
