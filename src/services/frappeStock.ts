/**
 * FrappeStockService
 * Combina métodos de consulta/movimiento general con los
 * endpoints específicos usados por RegistroEntrada, RegistroSalida e Inventario.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL } from '../config/constants';
import { horaFrappe } from '../utils/hora';

// Tipos de Warehouse esperados en ERPNext (Doctype "Warehouse Type").
// Si el tipo no coincide se cataloga como "Otros" y aparece al final del select.
const TIPO_BODEGA         = 'BODEGA';
const TIPO_DEPARTAMENTO   = 'DEPARTAMENTO';
const TIPO_SUCURSAL       = 'SUCURSAL';
const TIPO_CAMIONETA      = 'CAMIONETA';
const TIPO_PUNTO_VENTA    = 'PUNTO DE VENTA';

const ORDEN_TIPOS = [TIPO_BODEGA, TIPO_DEPARTAMENTO, TIPO_SUCURSAL, TIPO_CAMIONETA, TIPO_PUNTO_VENTA];

// Superficie limpia consumida por los selects de almacén en la UI.
interface Almacen {
  name: string;
  label: string;
  warehouse_type: string;
  parent_warehouse: string | null;
}

class FrappeStockService extends FrappeBase {
  #almacenesCache: Almacen[] | null = null;

  getBodegaCentral() { return BODEGA_CENTRAL; }

  /**
   * Lee los warehouses activos de ERPNext (no grupos, sin disabled, de la company).
   * Cachea la respuesta para evitar requests repetidos. Llamar a clearCache() en logout.
   */
  async fetchAlmacenes(): Promise<Almacen[]> {
    if (this.#almacenesCache) return this.#almacenesCache;
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'warehouse_name', 'warehouse_type', 'parent_warehouse']),
      filters: JSON.stringify([
        ['company',  '=', COMPANY],
        ['is_group', '=', 0],
        ['disabled', '=', 0],
      ]),
      limit_page_length: '0',
      order_by: 'warehouse_name asc',
    });
    const data = await this._fetch(`/api/resource/Warehouse?${params}`);
    const lista: Almacen[] = (data?.data || []).map((w: any) => ({
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
   */
  async fetchAlmacenesDepartamento(): Promise<Almacen[]> {
    const todos = await this.fetchAlmacenes();
    return todos.filter(w => w.warehouse_type === TIPO_DEPARTAMENTO);
  }

  /**
   * Devuelve warehouses agrupados por warehouse_type, con orden estable
   * (Departamento → Sucursal → Camioneta → Punto de Venta → otros).
   */
  async fetchAlmacenesAgrupados(): Promise<Array<{ tipo: string; almacenes: Almacen[] }>> {
    const todos = await this.fetchAlmacenes();
    const grupos: Record<string, Almacen[]> = {};
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
   */
  async fetchAllWarehouses() {
    const dept = await this.fetchAlmacenesDepartamento();
    return [{ name: BODEGA_CENTRAL, label: 'Bodega Central' }, ...dept];
  }

  /**
   * Bodega Central + TODOS los warehouses no-grupo (Departamentos, Sucursales,
   * Camionetas, Puntos de Venta). Usado en Inventario para vista "Por Almacén".
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
   * @param search - Consulta de usuario.
   * @returns Coincidencias activas.
   */
  async buscarItemsTexto(search = ""): Promise<any[]> {
    const params = new URLSearchParams({
      fields: JSON.stringify(["item_code", "item_name", "stock_uom", "item_group", "custom_cantidad_por_presentación", "custom_presentación", "custom_precio_por_kg", "custom_precio_final", "custom_precio_de_compra", "valuation_rate"]),
      filters: JSON.stringify([["disabled", "=", 0]]),
      limit_page_length: '20',
    });
    if (search) {
      // or_filters: grupo OR (item_name | item_code | código interno), AND'd con disabled=0
      params.set("or_filters", JSON.stringify([
        ["item_name", "like", `%${search}%`],
        ["item_code", "like", `%${search}%`],
        ["custom_código_interno", "like", `%${search}%`],
      ]));
    }
    const data = await this._fetch(`/api/resource/Item?${params}`);
    return data.data || [];
  }

  async getItemsPresentacion(codes: string[] = []): Promise<Record<string, any>> {
    if (!codes.length) return {};
    const params = new URLSearchParams({
      fields: JSON.stringify(['item_code', 'custom_cantidad_por_presentación', 'custom_presentación']),
      filters: JSON.stringify([['name', 'in', codes]]),
      limit_page_length: '200',
    });
    const data = await this._fetch(`/api/resource/Item?${params}`);
    const dict: Record<string, any> = {};
    (data.data || []).forEach((it: any) => { dict[it.item_code] = it; });
    return dict;
  }

  // ─────────────────────────────────────────────
  // CONSULTAS DE STOCK
  // ─────────────────────────────────────────────

  /**
   * Obtiene el Stock completo de un almacén en base al Bin DocType de Frappe.
   * Cruza la información con la tabla Item para devolver detalles amigables (nombre, UoM).
   * @param warehouse - ID del almacén en Frappe.
   * @returns Lista de existencias con metadata detallada.
   */
  async getStockPorAlmacen(warehouse: string): Promise<any[]> {
    const binParams = new URLSearchParams({
      fields: JSON.stringify(["item_code", "warehouse", "actual_qty", "reserved_qty", "projected_qty"]),
      filters: JSON.stringify([["warehouse", "=", warehouse], ["actual_qty", ">", 0]]),
      limit_page_length: '1000',
    });
    const binData = await this._fetch(`/api/resource/Bin?${binParams}`);
    const bins = binData.data || [];
    if (!bins.length) return [];

    const itemCodes = bins.map((b: any) => b.item_code);
    const itemParams = new URLSearchParams({
      fields: JSON.stringify(["item_code", "item_name", "item_group", "stock_uom", "custom_código_interno"]),
      filters: JSON.stringify([["item_code", "in", itemCodes], ["disabled", "=", 0]]),
      limit_page_length: '1000',
    });
    const itemData = await this._fetch(`/api/resource/Item?${itemParams}`);
    const itemMap: Record<string, any> = {};
    (itemData.data || []).forEach((i: any) => { itemMap[i.item_code] = i; });

    return bins
      .filter((b: any) => itemMap[b.item_code])
      .map((b: any) => ({ ...itemMap[b.item_code], ...b }))
      .sort((a: any, b: any) => a.item_name.localeCompare(b.item_name));
  }

  /**
   * Recupera rápidamente el Stock actual de un único ítem en un almacén específico.
   * @param itemCode - Código del artículo.
   * @param warehouse - ID Almacén.
   */
  async getStockActual(itemCode: string, warehouse: string) {
    const response = await this._fetch(
      `/api/resource/Bin?fields=["actual_qty","reserved_qty","projected_qty"]&filters=[["item_code","=","${itemCode}"],["warehouse","=","${warehouse}"]]`
    );
    return response.data?.[0] || { actual_qty: 0, reserved_qty: 0, projected_qty: 0 };
  }

  /**
   * Historial de movimientos (Stock Ledger) de un ítem.
   * Permite rastrear vida del inventario.
   * @param itemCode - PK Artículo.
   * @param limit - Cantidad de movimientos a cargar.
   */
  async getMovimientos(itemCode: string, limit = 50): Promise<any[]> {
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
   * @param payload - Diccionario configurado del Stock Entry.
   */
  async crearYSubmitirStockEntry(payload: any) {
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
   */
  async registrarEntrada({ items, notas = "", warehouse = BODEGA_CENTRAL }: { items: any[]; notas?: string; warehouse?: string }) {
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const destino = warehouse || BODEGA_CENTRAL;
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          COMPANY,
      to_warehouse:     destino,
      remarks:          notas || "Entrada de insumos",
      items: items.map(item => {
        const row: any = {
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
   * @param datos - Parámetros con compañía, fecha de compra e items con precios unitarios.
   */
  async entradaPorCompra(datos: any) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha || new Date().toISOString().split("T")[0],
      items: datos.items.map((item: any) => ({
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
   * @param datos - Detalle de los ajustes y motivo especificado.
   */
  async entradaPorAjuste(datos: any) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Receipt",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Ajuste positivo: ${datos.motivo || "Inventario fisico"}`,
      items: datos.items.map((item: any) => ({
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
   */
  async registrarSalida({ almacenDestino, items, notas = "" }: { almacenDestino: string; items: any[]; notas?: string }) {
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
   * @param datos - Detalle de consumo y opcional "orden producción".
   */
  async salidaPorProduccion(datos: any) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Consumo produccion: ${datos.orden_produccion || "Manual"}`,
      items: datos.items.map((item: any) => ({
        item_code:  item.item_code,
        s_warehouse: item.almacen_origen || BODEGA_CENTRAL,
        qty:         parseFloat(item.cantidad),
        basic_rate:  parseFloat(item.precio_promedio) || 0,
        uom:         item.uom,
        stock_uom:   item.uom,
      })),
    });
  }

  // El ajuste va por endpoint whitelisted (no REST directo): el backend valida rol Gerente
  // + la contraseña propia del usuario antes de crear/submitear el Stock Reconciliation.
  async crearConteoFisico({ items, password, warehouse, remarks = 'Conteo físico de inventario' }: { items: any[]; password: string; warehouse?: string; remarks?: string }) {
    if (!items?.length) throw new Error('Sin ítems para ajustar');
    const res = await this._fetch('/api/method/gestion_panaderia.api.inventory_api.crear_ajuste_inventario', {
      method: 'POST',
      body: JSON.stringify({
        items: JSON.stringify(items),
        password,
        warehouse: warehouse || BODEGA_CENTRAL,
        remarks,
      }),
    });
    return res.message;
  }

  /**
   * Historial de movimientos por almacén (Stock Entry submitted).
   * Incluye movimientos donde el almacén aparece como origen o destino.
   * Tipos: Material Receipt (entrada), Material Transfer (transferencia),
   * Material Issue (mermas / consumo), Manufacture (producción).
   * rol = 'origen' | 'destino' (cómo participó el almacén filtrado).
   */
  async getHistorialMovimientos({ warehouse, desde, hasta }: { warehouse?: string; desde?: string; hasta?: string } = {}, signal?: AbortSignal): Promise<any[]> {
    if (!warehouse) throw new Error('Almacén requerido');
    if (!desde || !hasta) throw new Error('Rango de fechas requerido');

    const baseFields = ['name', 'posting_date', 'posting_time', 'stock_entry_type', 'from_warehouse', 'to_warehouse', 'remarks'];
    const baseFilters: any[] = [
      ['docstatus', '=', 1],
      ['posting_date', '>=', desde],
      ['posting_date', '<=', hasta],
    ];

    // Dos queries: como origen y como destino. Luego merge.
    const buildParams = (rolFilter: any[]) => new URLSearchParams({
      fields: JSON.stringify(baseFields),
      filters: JSON.stringify([...baseFilters, rolFilter]),
      order_by: 'posting_date desc, posting_time desc, name desc',
      limit_page_length: '500',
    });

    const [resOrigen, resDestino] = await Promise.all([
      this._fetch('/api/resource/Stock Entry?' + buildParams(['from_warehouse', '=', warehouse]), { signal }),
      this._fetch('/api/resource/Stock Entry?' + buildParams(['to_warehouse', '=', warehouse]), { signal }),
    ]);

    const mapEntries = new Map<string, any>();
    (resOrigen?.data || []).forEach((e: any) => mapEntries.set(e.name, { ...e, _roles: new Set(['origen']) }));
    (resDestino?.data || []).forEach((e: any) => {
      if (mapEntries.has(e.name)) {
        mapEntries.get(e.name)._roles.add('destino');
      } else {
        mapEntries.set(e.name, { ...e, _roles: new Set(['destino']) });
      }
    });
    const entries = [...mapEntries.values()];

    // Fetch items por cada SE.
    const itemsByParent: Record<string, any[]> = {};
    await Promise.all(entries.map(async (e) => {
      try {
        const doc = await this._fetch('/api/resource/Stock Entry/' + encodeURIComponent(e.name), { signal });
        itemsByParent[e.name] = doc?.data?.items || [];
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.warn('No se pudieron cargar items de', e.name, err);
        itemsByParent[e.name] = [];
      }
    }));

    const seMovs = entries.map(e => {
      const items = (itemsByParent[e.name] || []).map((d: any) => {
        return {
          item_code: d.item_code,
          item_name: d.item_name || d.item_code,
          qty: parseFloat(d.qty || 0), // el doc ya guarda en unidad base
          uom: d.stock_uom || d.uom || '',
          s_warehouse: d.s_warehouse || null,
          t_warehouse: d.t_warehouse || null,
          basic_rate: parseFloat(d.basic_rate || 0),
          amount: parseFloat(d.amount || 0),
        };
      });
      const rol = e._roles.has('origen') && e._roles.has('destino')
        ? 'interno' : e._roles.has('origen') ? 'origen' : 'destino';
      return {
        name: e.name,
        fecha: e.posting_date,
        hora: horaFrappe(e.posting_time),
        _time: e.posting_time || '',
        tipo: e.stock_entry_type,
        rol,
        origen: e.from_warehouse || null,
        destino: e.to_warehouse || null,
        remarks: e.remarks || '',
        items,
      };
    });

    // Los ajustes (Stock Reconciliation) también son movimientos → mismo timeline.
    const ajusteMovs = await this._getAjustes(warehouse, desde, hasta, signal);

    return [...seMovs, ...ajusteMovs].sort((a, b) => {
      const cmp = (b.fecha || '').localeCompare(a.fecha || '');
      if (cmp !== 0) return cmp;
      return (b._time || '').localeCompare(a._time || '');
    });
  }

  // Ajustes de inventario = Stock Reconciliation (docstatus 1) que tocan el almacén.
  // ponytail: trae los reconciliation del rango y filtra items por almacén en cliente;
  // son pocos (spot-fixes). Si crecen mucho, filtrar server-side por Stock Reconciliation Item.
  async _getAjustes(warehouse: string, desde: string, hasta: string, signal?: AbortSignal): Promise<any[]> {
    const params = new URLSearchParams({
      // 'remarks' no se permite en la query de lista → lo leo del doc completo abajo.
      fields: JSON.stringify(['name', 'posting_date', 'posting_time']),
      filters: JSON.stringify([
        ['docstatus', '=', 1],
        ['posting_date', '>=', desde],
        ['posting_date', '<=', hasta],
      ]),
      order_by: 'posting_date desc, posting_time desc',
      limit_page_length: '500',
    });
    const res = await this._fetch('/api/resource/Stock Reconciliation?' + params, { signal });
    const list = res?.data || [];
    const movs: any[] = [];
    await Promise.all(list.map(async (r: any) => {
      try {
        const doc = await this._fetch('/api/resource/Stock Reconciliation/' + encodeURIComponent(r.name), { signal });
        // Solo ítems de este almacén CON cambio de cantidad real. Descarta reconciliaciones
        // de solo-valuación (quantity_difference 0) que no movieron stock → no son movimientos.
        const items = (doc?.data?.items || []).filter(
          (it: any) => it.warehouse === warehouse && Math.abs(parseFloat(it.quantity_difference || 0)) > 0.0001
        );
        if (!items.length) return;
        movs.push({
          name: r.name,
          fecha: r.posting_date,
          hora: horaFrappe(r.posting_time),
          _time: r.posting_time || '',
          tipo: 'Stock Reconciliation',
          rol: 'ajuste',
          origen: null,
          destino: warehouse,
          remarks: doc?.data?.remarks || '',
          items: items.map((it: any) => {
            const delta = parseFloat(it.quantity_difference || 0); // + subió, - bajó
            const rate  = parseFloat(it.valuation_rate || 0);
            return {
              item_code: it.item_code,
              item_name: it.item_name || it.item_code,
              qty: delta,
              antes: parseFloat(it.current_qty || 0),   // stock del sistema antes del ajuste
              despues: parseFloat(it.qty || 0),          // stock contado (después)
              uom: it.stock_uom || '',
              s_warehouse: null,
              t_warehouse: warehouse,
              basic_rate: rate,
              amount: Math.abs(delta * rate), // valor del cambio, no el monto absoluto del item
            };
          }),
        });
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.warn('No se pudieron cargar items del ajuste', r.name, err);
      }
    }));
    return movs;
  }

  // Regalo de proveedor (free goods): Material Receipt a rate de mercado.
  // El backend (api.regalos) arma el Stock Entry + cuenta de ingreso en especie.
  async getRegaloDefaults(itemCode: string) {
    const json = await this._fetch(
      `/api/method/gestion_panaderia.api.regalos.get_regalo_defaults?item_code=${encodeURIComponent(itemCode)}`,
    );
    return json?.message || {};
  }

  async registrarRegalo({ item_code, qty, valuation_rate, warehouse }: { item_code: string; qty: number; valuation_rate: number; warehouse: string }) {
    const json = await this._fetch('/api/method/gestion_panaderia.api.regalos.registrar_regalo', {
      method: 'POST',
      body: JSON.stringify({ item_code, qty, valuation_rate, warehouse }),
    });
    return json?.message;
  }

  async registrarMerma({ almacenOrigen, motivo, items, notas = "" }: { almacenOrigen: string; motivo: string; items: any[]; notas?: string }) {
    if (!almacenOrigen) throw new Error("Selecciona el almacen origen");
    if (!motivo) throw new Error("Indica el motivo de la merma");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          COMPANY,
      from_warehouse:   almacenOrigen,
      remarks:          `Merma (${motivo})${notas ? ' — ' + notas : ''}`,
      items: items.map(item => ({
        item_code:         item.item_code,
        s_warehouse:       almacenOrigen,
        qty:               parseFloat(item.qty),
        uom:               item.uom,
        stock_uom:         item.uom,
        conversion_factor: 1,
        transfer_qty:      parseFloat(item.qty),
      })),
    });
  }

  /**
   * Transacción de Manufactura ("Manufacture")
   * Descuenta ingredientes y suma el producto final al inventario.
   */
  async entradaPorManufactura(datos: any) {
    const items: any[] = [];

    // 1. Ingredientes (Salen)
    if (datos.ingredientes) {
      datos.ingredientes.forEach((item: any) => {
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

  // ─────────────────────────────────────────────
  // TRANSFERENCIA A SUCURSAL INTERNA (Puerta Real, etc.)
  // ─────────────────────────────────────────────

  /**
   * Resuelve precio venta congelado desde catálogo. Prioridad espejo NuevaVentaB2B.
   * Retorna precio por stock_uom (peso real, ej. por Kg). Devuelve 0 si no hay datos.
   */
  _resolverPrecioVenta(item: any): number {
    const cantPres = parseFloat(item.custom_cantidad_por_presentación) || 1;
    if (item.custom_precio_por_kg) return parseFloat(item.custom_precio_por_kg);
    if (item.custom_precio_de_venta) return parseFloat(item.custom_precio_de_venta) / cantPres;
    if (item.standard_rate) return parseFloat(item.standard_rate) / cantPres;
    return 0;
  }

  /**
   * Crea Stock Entry Material Transfer BODEGA → sucursal interna.
   * Guarda custom_precio_venta congelado del catálogo al momento del envío.
   * items: qty en stock_uom (Kg/Lt/Pza). asBorrador=true no submitea (docstatus=0).
   */
  async crearTransferenciaSucursal({ warehouseDestino, items, fecha = null, notas = '', asBorrador = false }: { warehouseDestino: string; items: any[]; fecha?: string | null; notas?: string; asBorrador?: boolean }) {
    if (!warehouseDestino) throw new Error('Selecciona warehouse destino');
    if (!items?.length) throw new Error('Agrega al menos un producto');

    // Si no traen precio congelado, jalarlo del catálogo ahora.
    const sinPrecio = items.filter(it => !(parseFloat(it.precio_venta_congelado) >= 0)).map(it => it.item_code);
    let dictPrecios: Record<string, any> = {};
    if (sinPrecio.length) {
      const params = new URLSearchParams({
        fields: JSON.stringify([
          'item_code', 'custom_cantidad_por_presentación',
          'custom_precio_por_kg', 'custom_precio_de_venta', 'standard_rate',
        ]),
        filters: JSON.stringify([['name', 'in', sinPrecio]]),
        limit_page_length: '200',
      });
      const cat = await this._fetch('/api/resource/Item?' + params);
      (cat?.data || []).forEach((it: any) => { dictPrecios[it.item_code] = it; });
    }

    const payload = {
      doctype: 'Stock Entry',
      stock_entry_type: 'Material Transfer',
      company: COMPANY,
      posting_date: fecha || new Date().toISOString().split('T')[0],
      from_warehouse: BODEGA_CENTRAL,
      to_warehouse: warehouseDestino,
      remarks: notas || `Envio a sucursal ${warehouseDestino}`,
      items: items.map(it => {
        let precio = parseFloat(it.precio_venta_congelado);
        if (!(precio >= 0)) precio = this._resolverPrecioVenta(dictPrecios[it.item_code] || {});
        return {
          item_code: it.item_code,
          item_name: it.item_name,
          s_warehouse: BODEGA_CENTRAL,
          t_warehouse: warehouseDestino,
          qty: parseFloat(it.qty),
          uom: it.uom,
          stock_uom: it.uom,
          conversion_factor: 1,
          transfer_qty: parseFloat(it.qty),
          custom_precio_venta: precio,
        };
      }),
    };

    if (asBorrador) {
      const created = await this._fetch('/api/resource/Stock Entry', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return created.data;
    }
    return this.crearYSubmitirStockEntry(payload);
  }

  /**
   * Lista transferencias enviadas a una sucursal interna en rango de fechas.
   * Cada transferencia trae items con qty + custom_precio_venta congelado.
   */
  async getTransferenciasSucursal({ warehouseDestino, desde = null, hasta = null, docstatus = null }: { warehouseDestino: string; desde?: string | null; hasta?: string | null; docstatus?: number | null } = {} as any, signal?: AbortSignal): Promise<any[]> {
    if (!warehouseDestino) throw new Error('warehouseDestino requerido');

    const filtersSE: any[] = [
      ['stock_entry_type', '=', 'Material Transfer'],
      ['to_warehouse', '=', warehouseDestino],
    ];
    if (docstatus != null) {
      filtersSE.push(['docstatus', '=', docstatus]);
    } else {
      filtersSE.push(['docstatus', 'in', [0, 1, 2]]);
    }
    if (desde) filtersSE.push(['posting_date', '>=', desde]);
    if (hasta) filtersSE.push(['posting_date', '<=', hasta]);
    const paramsSE = new URLSearchParams({
      fields: JSON.stringify(['name', 'posting_date', 'remarks', 'from_warehouse', 'to_warehouse', 'docstatus']),
      filters: JSON.stringify(filtersSE),
      order_by: 'posting_date desc, name desc',
      limit_page_length: '500',
    });
    const seRes = await this._fetch('/api/resource/Stock Entry?' + paramsSE, { signal });
    const entries = seRes?.data || [];
    if (!entries.length) return [];

    // Cargar items de cada Stock Entry individualmente vía endpoint detail
    // (Stock Entry Detail child table API es inconsistente con filtros multi-parent).
    const itemsByParent: Record<string, any[]> = {};
    await Promise.all(entries.map(async (e: any) => {
      try {
        const doc = await this._fetch('/api/resource/Stock Entry/' + encodeURIComponent(e.name), { signal });
        const items = doc?.data?.items || [];
        itemsByParent[e.name] = items;
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.warn('No se pudieron cargar items de', e.name, err);
        itemsByParent[e.name] = [];
      }
    }));

    const allDetails = Object.entries(itemsByParent).flatMap(([parent, its]) =>
      its.map((d: any) => ({ ...d, parent }))
    );

    const itemsByParentFinal: Record<string, any[]> = {};
    allDetails.forEach(d => {
      if (!itemsByParentFinal[d.parent]) itemsByParentFinal[d.parent] = [];
      const precio = parseFloat(d.custom_precio_venta || 0); // precio por unidad base
      const qtyBase = parseFloat(d.qty || 0); // el doc ya guarda en unidad base
      itemsByParentFinal[d.parent].push({
        item_code: d.item_code,
        item_name: d.item_name,
        qty: qtyBase,
        uom: d.stock_uom || d.uom,
        custom_precio_venta: precio,
        monto: qtyBase * precio,
      });
    });

    return entries.map((e: any) => {
      const items = itemsByParentFinal[e.name] || [];
      const totalMonto = items.reduce((acc: number, it: any) => acc + it.monto, 0);
      return {
        name: e.name,
        posting_date: e.posting_date,
        remarks: e.remarks,
        from_warehouse: e.from_warehouse,
        to_warehouse: e.to_warehouse,
        docstatus: e.docstatus,
        items,
        totalMonto,
      };
    });
  }

  /**
   * Cancela un Stock Entry submitted. ERPNext crea SLE reverso automáticamente
   * regresando el stock a la BODEGA origen.
   * @param name - Nombre del Stock Entry.
   */
  async cancelarTransferencia(name: string) {
    const data = await this._fetch(
      '/api/method/frappe.client.cancel',
      { method: 'POST', body: JSON.stringify({ doctype: 'Stock Entry', name }) }
    );
    return data.message;
  }

  /**
   * Obtiene un Stock Entry completo con items para reimprimir hoja de entrega
   * o cargar en form de edición (borrador).
   */
  async getTransferenciaDoc(name: string) {
    const data = await this._fetch(
      '/api/resource/Stock Entry/' + encodeURIComponent(name)
    );
    return data?.data;
  }

  /**
   * Salida del inventario por merma o caducidad.
   * @param datos - Motivo especifico y tipo de merma registrada.
   */
  async salidaPorMerma(datos: any) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Merma: ${datos.tipo_merma || ""} - ${datos.motivo || ""}`,
      items: datos.items.map((item: any) => ({
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
   * @param datos - Formulario del ajuste con motivo.
   */
  async salidaPorAjuste(datos: any) {
    return this.crearYSubmitirStockEntry({
      doctype:          "Stock Entry",
      stock_entry_type: "Material Issue",
      company:          datos.company || COMPANY,
      posting_date:     datos.fecha,
      remarks:          `Ajuste negativo: ${datos.motivo || "Inventario fisico"}`,
      items: datos.items.map((item: any) => ({
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
