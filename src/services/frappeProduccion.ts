/**
 * FrappeProduccionService
 * Gestiona recetas (BOM) y registro de producción usando
 * el DocType BOM de ERPNext y Stock Entry (Material Issue)
 * ya disponible en frappeStock.js.
 */

import FrappeBase from './FrappeBase';
import { stockService } from './frappeStock';
import { COMPANY } from '../config/constants';

interface BOMItemInput {
  item_code: string;
  qty: number | string;
  uom: string;
  item_name?: string;
}
interface BOMPayload {
  item: string;
  quantity: number | string;
  uom: string;
  items: BOMItemInput[];
  custom_departamento?: string;
}

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
    const filters: (string | number)[][] = [['docstatus', '!=', 2]];
    if (search) filters.push(['item', 'like', `%${search}%`]);
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'item', 'item_name', 'quantity', 'uom', 'docstatus', 'is_active', 'is_default', 'creation', 'custom_departamento']),
      filters: JSON.stringify(filters),
      // Mostrar solo la receta vigente (activa) y borradores reales (docstatus=0);
      // ocultar las versiones submitted-inactivas que deja el auto-versionado como histórico.
      or_filters: JSON.stringify([['docstatus', '=', 0], ['is_active', '=', 1]]),
      order_by: 'creation desc',
      limit_page_length: '200',
    });
    const data = await this._fetch(`/api/resource/BOM?${params}`);
    return data.data || [];
  }

  /**
   * Obtiene el detalle completo de una receta, incluyendo la tabla de ingredientes.
   * @param {string} bomName - ID del BOM.
   * @returns {Promise<Object>} Definición completa del BOM.
   */
  async getBOMDetalle(bomName: string) {
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
  async crearBOM({ item, quantity, uom, items, custom_departamento = '' }: BOMPayload) {
    const data = await this._fetch('/api/resource/BOM', {
      method: 'POST',
      body: JSON.stringify({
        doctype: 'BOM',
        item,
        quantity: parseFloat(String(quantity)) || 1,
        uom,
        company: COMPANY,
        custom_departamento,
        items: items.map(i => ({
          item_code: i.item_code,
          qty: parseFloat(String(i.qty)),
          uom: i.uom,
          stock_uom: i.uom,
          description: i.item_name || '',
        })),
      }),
    });
    return data.data;
  }
  /**
   * Actualiza una receta (BOM).
   *
   * ERPNext NO permite editar un BOM ya activo (docstatus=1): un PUT sobre el
   * documento confirmado dispara "Falta un valor para: Precio" porque la validación
   * de campos obligatorios del renglón corre sin pasar por el costeo por catálogo.
   *
   * Por eso, si la receta está activa, se desactiva la versión vigente y se crea una
   * NUEVA como borrador con los cambios; la activación (si aplica) la decide quien
   * llama. Desactivar (no cancelar) es seguro aunque haya producción vinculada al BOM
   * viejo, que queda como histórico inactivo. Si es borrador, se edita en su lugar.
   *
   * @param {string} bomName - ID del BOM a actualizar.
   * @param {Object} payload - Datos de la receta.
   * @returns {Promise<Object>} BOM resultante (el mismo si era borrador; uno nuevo si estaba activo).
   */
  async actualizarBOM(bomName: string, { item, quantity, uom, items, custom_departamento = '' }: BOMPayload) {
    const actual = await this.getBOMDetalle(bomName);

    // Receta activa → desactivar la vigente y crear una versión nueva (borrador).
    if (actual?.docstatus === 1) {
      await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: 0, is_default: 0 }),
      });
      return this.crearBOM({ item, quantity, uom, items, custom_departamento });
    }

    // Borrador → edición en su lugar.
    const data = await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
      method: 'PUT',
      body: JSON.stringify({
        item,
        quantity: parseFloat(String(quantity)) || 1,
        uom,
        custom_departamento,
        items: items.map(i => ({
          item_code: i.item_code,
          qty: parseFloat(String(i.qty)),
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
  async activarBOM(bomName: string) {
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
   * Elimina una receta (BOM).
   * Borrador (docstatus=0) → DELETE directo.
   * Activa (docstatus=1)  → se desmarca default/active, se cancela y luego se elimina.
   * Falla si la receta tiene producción registrada vinculada (Stock Entry); en ese
   * caso usar desactivarBOM como alternativa.
   * @param {string} bomName - ID del BOM.
   */
  async eliminarBOM(bomName: string) {
    const detalle = await this.getBOMDetalle(bomName);
    if (detalle.docstatus === 1) {
      await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: 0, is_default: 0 }),
      });
      await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
        method: 'PUT',
        body: JSON.stringify({ docstatus: 2 }),
      });
    }
    return this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, { method: 'DELETE' });
  }

  /**
   * Desactiva una receta sin eliminarla (la oculta del selector de producción
   * conservando el historial). Alternativa segura cuando no se puede borrar.
   * @param {string} bomName - ID del BOM.
   * @returns {Promise<Object>} BOM actualizado.
   */
  async desactivarBOM(bomName: string) {
    const data = await this._fetch(`/api/resource/BOM/${encodeURIComponent(bomName)}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: 0, is_default: 0 }),
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
  async buscarProductosTerminados(search = '', limit = 20) {
    const filters = [
      ['disabled', '=', 0],
      ['custom_tipo_item', '=', 'PRODUCTO TERMINADO'],
    ];
    if (search) filters.push(['item_name', 'like', `%${search}%`]);
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'item_name', 'stock_uom', 'custom_precio_de_venta', 'custom_costo_estimado']),
      filters: JSON.stringify(filters),
      limit_page_length: String(limit),
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    return data.data || [];
  }

  /**
   * Da de alta pan terminado SIN receta (Material Receipt valuado al costo estimado).
   * items: [{ item_code, qty, costo? }]. Sin `costo` se usa el del catálogo;
   * si el producto tampoco lo tiene, el backend rechaza la entrada (rate 0 hunde
   * el moving average).
   */
  async registrarEntradaPan({ items, fecha = null, notas = '' }:
    { items: any[]; fecha?: string | null; notas?: string }) {
    if (!items?.length) throw new Error('Agrega al menos un producto');
    // El almacén lo deriva el backend del departamento de cada producto.
    const res = await this._fetch(
      '/api/method/gestion_panaderia.api.produccion_api.registrar_entrada_pan',
      {
        method: 'POST',
        body: JSON.stringify({ items, fecha, notas }),
      },
    );
    return res?.message ?? res;
  }

  /**
   * Obtiene el precio por unidad (custom_precio_por_kg) de una lista de items
   * para calcular el costo estimado de producción.
   * @param {Array<string>} itemCodes - Lista de item_code de los ingredientes.
   * @returns {Promise<Object>} Mapa { item_code: precio_por_unidad }
   */
  async getPreciosIngredientes(itemCodes: string[]) {
    if (!itemCodes.length) return {};
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'custom_precio_por_kg']),
      filters: JSON.stringify([['item_code', 'in', itemCodes]]),
      limit_page_length: '500',
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    const mapa: Record<string, number> = {};
    (data.data || []).forEach((item: any) => {
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
  async getPreciosCosteo(itemCodes: string[]) {
    if (!itemCodes.length) return {};
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'custom_precio_final', 'custom_precio_por_kg']),
      filters: JSON.stringify([['item_code', 'in', itemCodes]]),
      limit_page_length: '500',
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    const mapa: Record<string, { precio_final: number; precio_por_kg: number }> = {};
    (data.data || []).forEach((item: any) => {
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
  async calcularCostoBOM(itemCode: string) {
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'item', 'quantity', 'uom']),
      filters: JSON.stringify([
        ['item', '=', itemCode],
        ['is_active', '=', 1],
        ['is_default', '=', 1],
        ['docstatus', '=', 1],
      ]),
      limit_page_length: '1',
    });
    const bomList = await this._fetch(`/api/resource/BOM?${params}`);
    const bomMeta = (bomList.data || [])[0];
    if (!bomMeta) return null;

    const bom = await this.getBOMDetalle(bomMeta.name);
    const items: any[] = bom.items || [];
    if (!items.length) return null;

    const codes: string[] = [...new Set(items.map((i: any) => String(i.item_code)))];
    const precios = await this.getPreciosCosteo(codes);

    let costoTotal = 0;
    const ingredientes = items.map((i: any) => {
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
  async calcularCostosBOMBatch(itemCodes: string[]) {
    if (!itemCodes.length) return {};
    const resultados = await Promise.all(
      itemCodes.map(code => this.calcularCostoBOM(code).catch(() => null))
    );
    const mapa: Record<string, any> = {};
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
  async calcularCostoEnVivo(ingredientes: any[], cantidadProducida: number | string) {
    const validos = ingredientes.filter(i => i.item_code && parseFloat(i.qty) > 0);
    if (!validos.length) return { costoTotal: 0, costoPorUnidad: 0, detalle: [] };

    const codes: string[] = [...new Set(validos.map(i => i.item_code))];
    const precios = await this.getPreciosCosteo(codes);

    let costoTotal = 0;
    const detalle = validos.map(i => {
      const precioFinal = precios[i.item_code]?.precio_final || 0;
      const qty = parseFloat(i.qty);
      const costo = precioFinal * qty;
      costoTotal += costo;
      return { item_code: i.item_code, qty, precio_final: precioFinal, costo };
    });

    const cant = parseFloat(String(cantidadProducida)) || 1;
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
  async registrarProduccion(
    { bomName, cantidadProducida, almacenOrigen }:
      { bomName: string; cantidadProducida: number | string; almacenOrigen: string },
  ) {
    const bom = await this.getBOMDetalle(bomName);
    const factorProduccion = parseFloat(String(cantidadProducida)) / (parseFloat(bom.quantity) || 1);

    const ingredientes = (bom.items || []).map((i: any) => ({
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
  async getStockBajoMinimo(warehouse: string) {
    const res = await this._fetch(
      `/api/method/gestion_panaderia.api.produccion_api.get_stock_bajo_minimo?warehouse=${encodeURIComponent(warehouse)}`
    );
    return res.message || [];
  }
}

export const produccionService = new FrappeProduccionService();
export default FrappeProduccionService;
