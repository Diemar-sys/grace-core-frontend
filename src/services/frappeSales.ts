/**
 * FrappeSalesService
 * Maneja Sales Invoice (con update_stock=1) en ERPNext para venta B2B externa.
 * Stock baja de Bodega Central. Clientes B2B = PUERTA REAL, DULCE CARAMEL, DELI, ZAKIA.
 * A PUERTA REAL se le vende pan + abarrotes por aquí; solo su materia prima
 * va aparte por Stock Entry Material Transfer (módulo Envío a Sucursal).
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL, DEFAULT_CUSTOMER } from '../config/constants';
import { IMPUESTOS_LIST } from '../config/impuestos';
import { loadAppConfig, getAppConfigSync } from './appConfig';
import { getSucursalesInternas } from '../config/clientesB2B';

// Respuestas Frappe heterogéneas → any deliberado (mismo criterio que FrappeBase).
type Cuentas = any;

// Payload de venta/actualización compartido por guardar/registrar/actualizar.
interface VentaInput {
  customer: string;
  fecha?: string;
  items: any[];
  notas?: string;
  ajuste?: number | string;
  noVenta?: number | null;
  taxOverrides?: Record<string, number>;
  subtotalOverrides?: { iva16?: number; tasa0?: number };
  cuentas?: Cuentas;
}

interface PagoInput {
  customer: string;
  facturas: any[];
  monto: number;
  fecha?: string | null;
  cuentaCaja?: string | null;
}

// Fallback emergencia (también vive en appConfig.js como source of truth).
// Aquí solo si appConfig falla completo.
const FALLBACK_CUENTAS: Cuentas = getAppConfigSync().cuentas;

const cuentaPorImpuesto = (cfg: Cuentas) => ({
  iva16: cfg.iva_trasladado,
  ieps:  cfg.ieps,
});

/**
 * Agrega Sales Invoices en filas por cliente para el reporte de cuentas por cobrar.
 * pagado = grand_total - outstanding_amount. Ordena por deuda pendiente desc.
 */
export function agruparCuentasPorCobrar(rows: any[]) {
  const map: Record<string, any> = {};
  for (const si of rows || []) {
    const k = si.customer;
    if (!map[k]) map[k] = { customer: si.customer, customer_name: si.customer_name || si.customer, n: 0, total: 0, pagado: 0, pendiente: 0 };
    const gt = parseFloat(si.grand_total || 0);
    const out = parseFloat(si.outstanding_amount || 0);
    map[k].n++;
    map[k].total += gt;
    map[k].pendiente += out;
    map[k].pagado += gt - out;
  }
  return Object.values(map).sort((a: any, b: any) => b.pendiente - a.pendiente);
}

class FrappeSalesService extends FrappeBase {
  #cuentasCache: Cuentas | null = null;
  _abortCliente?: AbortController;
  _abortItems?: AbortController;

  getImpuestos() { return IMPUESTOS_LIST; }

  /**
   * Resuelve cuentas desde AppConfig (endpoint backend si disponible, sino fallback).
   * Cache propio del service: lectura síncrona después de primer await.
   */
  async getCuentas() {
    if (this.#cuentasCache) return this.#cuentasCache;
    const cfg = await loadAppConfig();
    this.#cuentasCache = cfg.cuentas;
    return cfg.cuentas;
  }

  clearCuentasCache() { this.#cuentasCache = null; }

  /**
   * Siguiente número de venta consecutivo (custom_no_de_venta).
   * Mismo patrón que comprasService.getSiguienteNumero.
   */
  async getSiguienteNumero() {
    const params = new URLSearchParams({
      fields: JSON.stringify(['custom_no_de_venta']),
      filters: JSON.stringify([['docstatus', 'in', [0, 1]]]),
      order_by: 'custom_no_de_venta desc',
      limit_page_length: '1',
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params);
    const ultimo = data.data?.[0]?.custom_no_de_venta || 0;
    return ultimo + 1;
  }

  /**
   * Busca clientes B2B externos (excluye Público en General POS + sucursales internas).
   */
  async buscarClientes(search = '') {
    if (search.length > 0 && search.length < 2) return [];
    if (this._abortCliente) this._abortCliente.abort();
    this._abortCliente = new AbortController();

    const excluidos = [DEFAULT_CUSTOMER, ...getSucursalesInternas()];
    const filters = [
      ['disabled', '=', 0],
      ['name', 'not in', excluidos],
    ];
    if (search) filters.push(['customer_name', 'like', '%' + search + '%']);
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'customer_name', 'customer_group']),
      filters: JSON.stringify(filters),
      limit_page_length: '20',
    });
    try {
      const data = await this._fetch('/api/resource/Customer?' + params, {
        signal: this._abortCliente.signal,
      });
      return data?.data || [];
    } catch (err: any) {
      if (err.name === 'AbortError') return [];
      throw err;
    }
  }

  /**
   * Busca items con precio venta (custom_precio_de_venta o standard_rate).
   */
  async buscarItems(search = '') {
    if (search.length > 0 && search.length < 3) return [];
    if (this._abortItems) this._abortItems.abort();
    this._abortItems = new AbortController();

    const filters = [['disabled', '=', 0], ['is_sales_item', '=', 1]];
    if (search) filters.push(['item_name', 'like', '%' + search + '%']);
    const params = new URLSearchParams({
      fields: JSON.stringify([
        'item_code', 'item_name', 'stock_uom', 'item_group',
        'custom_impuesto', 'custom_tipo_item', 'custom_departamento',
        'custom_cantidad_por_presentación', 'custom_presentación',
        'custom_precio_de_venta', 'custom_precio_por_kg', 'standard_rate',
        'valuation_rate', 'custom_vendible_b2b',
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: '20',
    });
    try {
      const data = await this._fetch('/api/resource/Item?' + params, {
        signal: this._abortItems.signal,
      });
      // Devuelve todo lo vendible (is_sales_item=1). La materia prima SÍ se
      // vende a clientes externos (DELI, ZAKIA). El filtro de MP es por
      // cliente (solo PUERTA REAL) y se aplica en NuevaVentaB2B, no aquí.
      return data?.data || [];
    } catch (err: any) {
      if (err.name === 'AbortError') return [];
      throw err;
    }
  }

  /**
   * Calcula y agrupa impuestos para venta.
   * Solo IVA + Tasa 0 (B2B panadería no causa IEPS típicamente).
   */
  _calcularImpuestos(items: any[], taxOverrides: Record<string, number> = {}, cuentas: Cuentas = FALLBACK_CUENTAS) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const grupos: Record<string, { key: string; label: string; rate: number; monto: number }> = {};
    const map = cuentaPorImpuesto(cuentas);
    items.forEach(item => {
      const rate = parseFloat(item.impuesto_rate || 0);
      const key = item.impuesto_key || 'tasa0';
      const label = item.impuesto_label || 'Tasa 0';
      const base = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
      const monto = base * rate;
      if (!grupos[key]) grupos[key] = { key, label, rate, monto: 0 };
      grupos[key].monto += monto;
    });
    Object.entries(taxOverrides).forEach(([key, amount]) => {
      if (grupos[key]) grupos[key].monto = amount;
    });
    return Object.values(grupos)
      .filter(g => g.monto > 0)
      .map(g => ({
        charge_type: 'Actual',
        description: g.label,
        tax_amount: round2(g.monto),
        account_head: (map as Record<string, any>)[g.key] || cuentas.iva_trasladado,
      }));
  }

  _buildPayload({ customer, fecha, items, notas = '', ajuste = 0, noVenta = null, taxOverrides = {}, subtotalOverrides = {}, cuentas = FALLBACK_CUENTAS }: VentaInput) {
    const resumenImpuestos = this._calcularImpuestos(items, taxOverrides, cuentas);
    const ajusteNum = parseFloat(String(ajuste || 0));

    if (ajusteNum !== 0) {
      resumenImpuestos.push({
        charge_type: 'Actual',
        description: 'Ajuste por Redondeo',
        tax_amount: ajusteNum,
        account_head: cuentas.ajuste,
      });
    }

    return {
      doctype: 'Sales Invoice',
      customer,
      company: COMPANY,
      posting_date: fecha || new Date().toISOString().split('T')[0],
      due_date: fecha || new Date().toISOString().split('T')[0],
      update_stock: 1,
      set_warehouse: BODEGA_CENTRAL,
      remarks: notas || '',
      custom_no_de_venta: noVenta || null,
      custom_subtotal_iva_16: subtotalOverrides.iva16 ?? null,
      custom_subtotal_iva_0:  subtotalOverrides.tasa0 ?? null,
      items: items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: parseFloat(item.qty),
        rate: parseFloat(item.rate),
        uom: item.uom,
        warehouse: BODEGA_CENTRAL,
        conversion_factor: 1,
        description: 'Impuesto: ' + (item.impuesto_label || 'Tasa 0'),
      })),
      taxes: resumenImpuestos,
      disable_rounded_total: 1,
      rounding_adjustment: 0,
    };
  }

  /**
   * Guarda venta como borrador (docstatus 0). Stock NO se mueve aún.
   * Stock siempre baja de BODEGA_CENTRAL (clientes B2B externos).
   */
  async guardarBorrador({ customer, fecha, items, notas, ajuste, taxOverrides = {}, subtotalOverrides = {} }: VentaInput) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const [noVenta, cuentas] = await Promise.all([
      this.getSiguienteNumero(),
      this.getCuentas(),
    ]);
    const payload = this._buildPayload({ customer, fecha, items, notas, ajuste, noVenta, taxOverrides, subtotalOverrides, cuentas });
    const created = await this._fetch('/api/resource/Sales Invoice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return created.data;
  }

  /**
   * Crea + submitea venta (docstatus 1). Genera movimiento stock.
   */
  async registrarVenta({ customer, fecha, items, notas, ajuste, taxOverrides = {}, subtotalOverrides = {} }: VentaInput) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const [noVenta, cuentas] = await Promise.all([
      this.getSiguienteNumero(),
      this.getCuentas(),
    ]);
    const payload = this._buildPayload({ customer, fecha, items, notas, ajuste, noVenta, taxOverrides, subtotalOverrides, cuentas });
    const created = await this._fetch('/api/resource/Sales Invoice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(created.data.name),
      { method: 'PUT', body: JSON.stringify({ docstatus: 1 }) }
    );
    return created.data;
  }

  async getVentaBorrador(name: string) {
    const data = await this._fetch('/api/resource/Sales Invoice/' + encodeURIComponent(name));
    return data.data;
  }

  async actualizarBorrador(name: string, { customer, fecha, items, notas, ajuste, taxOverrides = {}, subtotalOverrides = {} }: VentaInput) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const [doc, cuentas] = await Promise.all([
      this.getVentaBorrador(name),
      this.getCuentas(),
    ]);
    const noVenta = doc.custom_no_de_venta || null;
    const payload = this._buildPayload({ customer, fecha, items, notas, ajuste, noVenta, taxOverrides, subtotalOverrides, cuentas });
    const updated = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'PUT', body: JSON.stringify(payload) }
    );
    return updated.data;
  }

  async confirmarBorrador(name: string) {
    const updated = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'PUT', body: JSON.stringify({ docstatus: 1 }) }
    );
    return updated.data;
  }

  async cancelarVenta(name: string) {
    const data = await this._fetch(
      '/api/method/frappe.client.cancel',
      { method: 'POST', body: JSON.stringify({ doctype: 'Sales Invoice', name }) }
    );
    return data.message;
  }

  async eliminarBorrador(name: string) {
    const result = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'DELETE' }
    );
    return result;
  }

  /**
   * Lista ventas B2B con filtros.
   * Excluye Sales Invoice de POS (is_pos=1).
   */
  async getVentas({ desde = null, hasta = null, customer = null }: { desde?: string | null; hasta?: string | null; customer?: string | null } = {}, signal?: AbortSignal) {
    const filters = [
      ['docstatus', 'in', [0, 1, 2]],
      ['is_pos', '=', 0],
    ];
    if (desde) filters.push(['posting_date', '>=', desde]);
    if (hasta) filters.push(['posting_date', '<=', hasta]);
    if (customer) filters.push(['customer', '=', customer]);
    const params = new URLSearchParams({
      fields: JSON.stringify([
        'name', 'customer', 'customer_name', 'docstatus',
        'posting_date', 'total', 'grand_total', 'status', 'outstanding_amount',
        'custom_no_de_venta',
      ]),
      filters: JSON.stringify(filters),
      order_by: 'custom_no_de_venta desc',
      limit_page_length: '100',
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params, { signal });
    return data?.data || [];
  }

  /**
   * Lista facturas pendientes de cobro (outstanding > 0) opcionalmente por cliente.
   * Excluye POS. Solo submitted.
   */
  async getFacturasPendientes({ customer = null }: { customer?: string | null } = {}, signal?: AbortSignal) {
    const filters = [
      ['docstatus', '=', 1],
      ['is_pos', '=', 0],
      ['outstanding_amount', '>', 0],
    ];
    if (customer) filters.push(['customer', '=', customer]);
    const params = new URLSearchParams({
      fields: JSON.stringify([
        'name', 'customer', 'customer_name', 'posting_date',
        'custom_no_de_venta', 'grand_total', 'outstanding_amount',
      ]),
      filters: JSON.stringify(filters),
      order_by: 'posting_date asc, custom_no_de_venta asc',
      limit_page_length: '500',
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params, { signal });
    return data?.data || [];
  }

  /**
   * Agrupa deuda pendiente por cliente.
   * Retorna [{ customer, customer_name, totalDeuda, facturas: [{name, fecha, #, total, outstanding}] }]
   */
  async getDeudaPorCliente(signal?: AbortSignal) {
    const facturas = await this.getFacturasPendientes({}, signal);
    const grupos: Record<string, any> = {};
    facturas.forEach((f: any) => {
      const k = f.customer;
      if (!grupos[k]) {
        grupos[k] = {
          customer: f.customer,
          customer_name: f.customer_name || f.customer,
          totalDeuda: 0,
          facturas: [],
        };
      }
      grupos[k].totalDeuda += parseFloat(f.outstanding_amount || 0);
      grupos[k].facturas.push(f);
    });
    return Object.values(grupos).sort((a, b) => b.totalDeuda - a.totalDeuda);
  }

  /**
   * Cuentas por cobrar agregadas por cliente (reporte).
   * Sobre Sales Invoice submitted B2B (is_pos=0). pagado = grand_total - outstanding_amount.
   * Retorna [{ customer, customer_name, n, total, pagado, pendiente }] ordenado por deuda desc.
   */
  async getCuentasPorCobrar(signal?: AbortSignal) {
    const params = new URLSearchParams({
      fields: JSON.stringify(['customer', 'customer_name', 'grand_total', 'outstanding_amount']),
      filters: JSON.stringify([['docstatus', '=', 1], ['is_pos', '=', 0]]),
      limit_page_length: '0', // todas
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params, { signal });
    return agruparCuentasPorCobrar(data?.data || []);
  }

  /**
   * Items detallados de una factura específica (qty, rate, amount, uom).
   * Para vista expand en libreta de cobros.
   * @param {string} name - Sales Invoice name
   * @returns {Promise<Array<{item_code, item_name, qty, uom, rate, amount}>>}
   */
  async getFacturaItems(name: string, signal?: AbortSignal) {
    if (!name) return [];
    const data = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { signal },
    );
    const itemsRaw = data?.data?.items || [];
    if (!itemsRaw.length) return [];

    // El doc guarda qty y rate en unidad base → se leen directo. cantPres solo sirve
    // para mostrar el equivalente en presentación (base / cantPres).
    const codes = [...new Set(itemsRaw.map((i: any) => i.item_code).filter(Boolean))];
    let dict: Record<string, any> = {};
    if (codes.length) {
      try {
        const params = new URLSearchParams({
          fields: JSON.stringify([
            'item_code', 'stock_uom', 'custom_cantidad_por_presentación', 'custom_presentación',
          ]),
          filters: JSON.stringify([['name', 'in', codes]]),
          limit_page_length: '200',
        });
        const cat = await this._fetch('/api/resource/Item?' + params, { signal });
        (cat?.data || []).forEach((it: any) => { dict[it.item_code] = it; });
      } catch (e: any) {
        if (e.name !== 'AbortError') console.warn('Catálogo no disponible:', e);
      }
    }

    return itemsRaw.map((it: any) => {
      const m = dict[it.item_code] || {};
      const cantPres = parseFloat(m.custom_cantidad_por_presentación) || 1;
      return {
        item_code: it.item_code,
        item_name: it.item_name,
        qty: parseFloat(it.qty || 0),   // ya en unidad base
        uom: m.stock_uom || it.stock_uom || it.uom || '',
        rate: parseFloat(it.rate || 0), // ya por unidad base
        amount: parseFloat(it.amount || 0), // total preservado
        description: it.description || '',
        cantidad_por_presentacion: cantPres,
        presentacion: m.custom_presentación || '',
        qty_presentacion: cantPres > 0 ? (parseFloat(it.qty || 0) / cantPres) : parseFloat(it.qty || 0), // equiv. en presentación, ej. "2 Bulto"
      };
    });
  }

  /**
   * Registra pago consolidado.
   * @param {Object} params
   * @param {string} params.customer
   * @param {Array<{name, allocated}>} params.facturas - SI a saldar y monto a aplicar a cada una
   * @param {number} params.monto - Total pagado (debe ser ≤ suma allocated; ERPNext valida)
   * @param {string} [params.fecha] - Fecha del pago (default hoy)
   * @param {string} [params.cuentaCaja] - paid_to (default CUENTA_CAJA)
   */
  /**
   * Reporte de ventas B2B agrupadas por item_group (categoría).
   * Solo Sales Invoice submitted (docstatus=1) y B2B (is_pos=0) en rango.
   * Estructura: [{ item_group, qtyTotal, montoTotal, items: [{ item_code, item_name, qty, monto, uom, ventas }] }]
   * @param {{desde:string, hasta:string}} rango - Fechas ISO YYYY-MM-DD inclusivas.
   */
  async getVentasB2BPorCategoria({ desde, hasta }: { desde?: string; hasta?: string } = {}, signal?: AbortSignal) {
    if (!desde || !hasta) throw new Error('Rango de fechas requerido');

    // 1) Sales Invoice submitted B2B en rango.
    const invParams = new URLSearchParams({
      fields: JSON.stringify(['name']),
      filters: JSON.stringify([
        ['docstatus', '=', 1],
        ['is_pos', '=', 0],
        ['posting_date', '>=', desde],
        ['posting_date', '<=', hasta],
      ]),
      limit_page_length: '5000',
    });
    const invData = await this._fetch('/api/resource/Sales Invoice?' + invParams, { signal });
    const invoiceNames = (invData?.data || []).map((d: any) => d.name);
    if (!invoiceNames.length) return [];

    // 2) Fetch cada Sales Invoice completo (items embebidos).
    // Evita query directa a Sales Invoice Item que da 403 según permisos del rol.
    // Batch paralelo de 8 para no saturar el servidor.
    const BATCH = 8;
    const itemsRaw = [];
    for (let i = 0; i < invoiceNames.length; i += BATCH) {
      const batch = invoiceNames.slice(i, i + BATCH);
      const docs = await Promise.all(
        batch.map((name: any) =>
          this._fetch('/api/resource/Sales Invoice/' + encodeURIComponent(name), { signal })
            .catch(() => null)
        )
      );
      for (const doc of docs) {
        const inv = doc?.data;
        if (!inv) continue;
        for (const item of (inv.items || [])) {
          itemsRaw.push({
            item_code:  item.item_code,
            item_name:  item.item_name,
            item_group: item.item_group || '',
            qty:        item.qty,
            amount:     item.amount,
            stock_uom:  item.stock_uom,
            parent:     inv.name,
          });
        }
      }
    }
    if (!itemsRaw.length) return [];

    // 3) Convertir qty natural → display (qty × cantidad_por_presentación).
    const codes = [...new Set(itemsRaw.map((i: any) => i.item_code).filter(Boolean))];
    let dict: Record<string, any> = {};
    if (codes.length) {
      // Chunk codes también.
      const codeChunks = [];
      for (let i = 0; i < codes.length; i += 200) codeChunks.push(codes.slice(i, i + 200));
      for (const cc of codeChunks) {
        const params = new URLSearchParams({
          fields: JSON.stringify(['item_code', 'stock_uom', 'custom_cantidad_por_presentación']),
          filters: JSON.stringify([['name', 'in', cc]]),
          limit_page_length: '500',
        });
        const cat = await this._fetch('/api/resource/Item?' + params, { signal });
        (cat?.data || []).forEach((it: any) => { dict[it.item_code] = it; });
      }
    }

    // 4) Agrupar por item_group → por item_code.
    const grupos: Record<string, any> = {};
    for (const it of itemsRaw) {
      const grp = it.item_group || '(sin categoría)';
      if (!grupos[grp]) grupos[grp] = { item_group: grp, qtyTotal: 0, montoTotal: 0, _items: {} };
      const meta = dict[it.item_code] || {};
      const qtyDisp = parseFloat(it.qty || 0); // ya en unidad base
      const monto = parseFloat(it.amount || 0);

      const code = it.item_code || '(sin código)';
      if (!grupos[grp]._items[code]) {
        grupos[grp]._items[code] = {
          item_code: code,
          item_name: it.item_name || code,
          qty: 0,
          monto: 0,
          uom: meta.stock_uom || it.stock_uom || '',
          ventas: new Set(),
        };
      }
      grupos[grp]._items[code].qty += qtyDisp;
      grupos[grp]._items[code].monto += monto;
      grupos[grp]._items[code].ventas.add(it.parent);
      grupos[grp].qtyTotal += qtyDisp;
      grupos[grp].montoTotal += monto;
    }

    // 5) Aplanar items + sort.
    return Object.values(grupos)
      .map(g => ({
        item_group: g.item_group,
        qtyTotal: g.qtyTotal,
        montoTotal: g.montoTotal,
        items: Object.values(g._items)
          .map((i: any) => ({ ...i, ventas: i.ventas.size }))
          .sort((a, b) => b.monto - a.monto),
      }))
      .sort((a, b) => b.montoTotal - a.montoTotal);
  }

  async registrarPago({ customer, facturas, monto, fecha = null, cuentaCaja = null }: PagoInput) {
    if (!customer) throw new Error('Cliente requerido');
    if (!facturas?.length) throw new Error('Selecciona al menos una factura');
    if (!monto || monto <= 0) throw new Error('Monto inválido');

    // ponytail: NO redondear allocated a 2dp. Los outstanding B2B traen sub-centavo
    // (ej. 786.055904); round2 lo sube a 786.06 > outstanding → Frappe rechaza
    // "allocated > outstanding". Se manda el valor exacto que armó el modal.
    const references = facturas
      .filter(f => parseFloat(f.allocated) > 0)
      .map(f => ({
        reference_doctype: 'Sales Invoice',
        reference_name: f.name,
        allocated_amount: parseFloat(f.allocated),
      }));
    if (!references.length) throw new Error('Asigna monto a alguna factura');
    // paid = suma real de lo asignado (no el monto redondeado del usuario), para
    // que Frappe no vea descuadre paid_amount vs total asignado.
    const totalAlloc = references.reduce((s, r) => s + r.allocated_amount, 0);

    const cuentas = await this.getCuentas();
    const payload = {
      doctype: 'Payment Entry',
      payment_type: 'Receive',
      company: COMPANY,
      posting_date: fecha || new Date().toISOString().split('T')[0],
      party_type: 'Customer',
      party: customer,
      paid_from: cuentas.receivable,
      paid_to: cuentaCaja || cuentas.caja,
      paid_amount: totalAlloc,
      received_amount: totalAlloc,
      references,
      mode_of_payment: 'Cash',
    };
    const created = await this._fetch('/api/resource/Payment Entry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await this._fetch(
      '/api/resource/Payment Entry/' + encodeURIComponent(created.data.name),
      { method: 'PUT', body: JSON.stringify({ docstatus: 1 }) }
    );
    return created.data;
  }
}

export const ventasService = new FrappeSalesService();
export default FrappeSalesService;
