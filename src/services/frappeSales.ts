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
 * Agrupa los impuestos de una venta por tasa y los redondea a 2 decimales.
 * El monto redondeado es EXACTAMENTE el que viaja a ERPNext como fila `Actual`,
 * así que cualquier total derivado debe partir de aquí y no del monto crudo.
 */
export function agruparImpuestosVenta(items: any[], taxOverrides: Record<string, number> = {}) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const grupos: Record<string, { key: string; label: string; rate: number; monto: number }> = {};
  (items || []).forEach(item => {
    const rate = parseFloat(item.impuesto_rate || 0);
    const key = item.impuesto_key || 'tasa0';
    const label = item.impuesto_label || 'Tasa 0';
    const base = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
    if (!grupos[key]) grupos[key] = { key, label, rate, monto: 0 };
    grupos[key].monto += base * rate;
  });
  Object.entries(taxOverrides).forEach(([key, amount]) => {
    if (grupos[key]) grupos[key].monto = amount;
  });
  return Object.values(grupos)
    .filter(g => g.monto > 0)
    .map(g => ({ ...g, montoRedondeado: round2(g.monto) }));
}

/**
 * Totales efectivos de una venta + ajuste SAT (espejo de compraUtils.calcularTotalesEfectivos).
 * Función PURA — es la única fuente del grand_total que termina en ERPNext.
 *
 * El ajuste SAT se deriva de los impuestos YA REDONDEADOS. Calcularlo sobre el
 * impuesto crudo dejaba un residuo de `round2(iva) - iva` en el grand_total: la
 * factura nacía con 6 decimales, el cliente pagaba 2, y quedaba saldo pendiente
 * de fracciones de centavo que ensuciaban cuentas por cobrar.
 */
export function calcularTotalesVenta(items: any[], taxOverrides: Record<string, number> = {}) {
  const subtotal = (items || []).reduce(
    (s: number, it: any) => s + parseFloat(it.qty || 0) * parseFloat(it.rate || 0), 0);
  const grupos = agruparImpuestosVenta(items, taxOverrides);
  const impuestos = grupos.reduce((s, g) => s + g.montoRedondeado, 0);
  const rawTotal = subtotal + impuestos;
  const ajusteSAT = Math.round((Math.round(rawTotal * 100) / 100 - rawTotal) * 1e6) / 1e6;
  return { subtotal, grupos, impuestos, rawTotal, ajusteSAT, total: rawTotal + ajusteSAT };
}

/**
 * Saldo REAL cobrable de una factura: lo que el cliente puede pagar en pesos.
 * Una factura que redondea a $0.00 está saldada aunque ERPNext le vea milésimas.
 *
 * Único criterio de "esto es cero" en toda la app: si el reporte y el modal de
 * cobro usan umbrales distintos, el reporte pinta deuda que el cobrador no puede
 * cobrar (pasó con DULCE CARAMELO: 3 facturas de ~0.002 c/u sumaban 0.006 →
 * el total mostraba $0.01 y Cobrar respondía "ya estaban saldadas").
 */
export function saldoCobrable(outstanding: any) {
  const v = Math.round((parseFloat(outstanding) || 0) * 100) / 100;
  return v >= 0.01 ? parseFloat(outstanding) : 0;
}

/**
 * Lo que abre el modal de cobro: las facturas con saldo cobrable (≥ medio centavo)
 * y su deuda. `null` si no queda nada que cobrar. Una sola regla para CxC y para el
 * estado de cuenta de la Hoja del día (23-sep).
 */
export function grupoCobro(customer: string, customer_name: string, facturas: any[]) {
  const reales = facturas.filter(f => saldoCobrable(f.outstanding_amount) > 0);
  if (!reales.length) return null;
  return {
    customer, customer_name,
    totalDeuda: reales.reduce((s, f) => s + parseFloat(f.outstanding_amount || 0), 0),
    facturas: reales,
  };
}

/**
 * Factor del impuesto que trae un renglón de factura (`item_tax_rate`, JSON
 * `{cuenta: tasa}`): Π(1 + tasa). En cascada, IVA sobre base+IEPS:
 * 1.08 × 1.16 = 1.2528, no 1.24.
 * Del RENGLÓN y no del catálogo: si el pan cambió de impuesto después, la
 * factura sigue diciendo lo que cobró. Tampoco de `item_wise_tax_detail`: con
 * cargos «Actual» (Hoja del día) ERPNext reparte el IEPS entre TODOS los
 * renglones, también los de tasa 0.
 */
export function factorImpuestoRenglon(itemTaxRate: unknown): number {
  let tasas: unknown = itemTaxRate;
  if (typeof itemTaxRate === 'string') {
    try { tasas = JSON.parse(itemTaxRate || '{}'); } catch { tasas = {}; }
  }
  if (!tasas || typeof tasas !== 'object') return 1;
  return Object.values(tasas as Record<string, unknown>)
    .reduce<number>((f, t) => f * (1 + (parseFloat(String(t)) || 0) / 100), 1);
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
   * Incluye canceladas (docstatus 2): si el max solo mirara vivas, cancelar
   * la venta más reciente liberaría su folio y el siguiente lo reutilizaría —
   * dos ventas distintas con el mismo número en la libreta de cobros.
   * TODO: mover a endpoint backend con lock, como get_siguiente_no_compra.
   */
  async getSiguienteNumero() {
    const params = new URLSearchParams({
      fields: JSON.stringify(['custom_no_de_venta']),
      filters: JSON.stringify([['docstatus', 'in', [0, 1, 2]]]),
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
        'custom_precio_de_compra',  // excepción DELI: la nata a precio de compra (24-sep)
        'valuation_rate', 'custom_vendible_b2b', 'custom_almacen_produccion',
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
    const map = cuentaPorImpuesto(cuentas);
    return agruparImpuestosVenta(items, taxOverrides).map(g => ({
      charge_type: 'Actual',
      description: g.label,
      tax_amount: g.montoRedondeado,
      account_head: (map as Record<string, any>)[g.key] || cuentas.iva_trasladado,
    }));
  }

  _buildPayload({ customer, fecha, items, notas = '', noVenta = null, taxOverrides = {}, subtotalOverrides = {}, cuentas = FALLBACK_CUENTAS }: VentaInput) {
    const resumenImpuestos = this._calcularImpuestos(items, taxOverrides, cuentas);
    // El ajuste se deriva SIEMPRE aquí, nunca del caller: debe calcularse sobre los
    // mismos impuestos redondeados que van en resumenImpuestos (ver calcularTotalesVenta).
    const { ajusteSAT } = calcularTotalesVenta(items, taxOverrides);

    if (ajusteSAT !== 0) {
      resumenImpuestos.push({
        charge_type: 'Actual',
        description: 'Ajuste por Redondeo',
        tax_amount: ajusteSAT,
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
        // El servidor lo fija igual (sales_invoice.almacen_de_salida); se manda
        // el mismo para que el borrador diga la verdad.
        warehouse: item.almacen || BODEGA_CENTRAL,
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
  async guardarBorrador({ customer, fecha, items, notas, taxOverrides = {}, subtotalOverrides = {} }: VentaInput) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const [noVenta, cuentas] = await Promise.all([
      this.getSiguienteNumero(),
      this.getCuentas(),
    ]);
    const payload = this._buildPayload({ customer, fecha, items, notas, noVenta, taxOverrides, subtotalOverrides, cuentas });
    const created = await this._fetch('/api/resource/Sales Invoice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return created.data;
  }

  /**
   * Crea + submitea venta (docstatus 1). Genera movimiento stock.
   */
  async registrarVenta({ customer, fecha, items, notas, taxOverrides = {}, subtotalOverrides = {} }: VentaInput) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const [noVenta, cuentas] = await Promise.all([
      this.getSiguienteNumero(),
      this.getCuentas(),
    ]);
    const payload = this._buildPayload({ customer, fecha, items, notas, noVenta, taxOverrides, subtotalOverrides, cuentas });
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

  async actualizarBorrador(name: string, { customer, fecha, items, notas, taxOverrides = {}, subtotalOverrides = {} }: VentaInput) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const [doc, cuentas] = await Promise.all([
      this.getVentaBorrador(name),
      this.getCuentas(),
    ]);
    const noVenta = doc.custom_no_de_venta || null;
    const payload = this._buildPayload({ customer, fecha, items, notas, noVenta, taxOverrides, subtotalOverrides, cuentas });
    const updated = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'PUT', body: JSON.stringify(payload) }
    );
    return updated.data;
  }

  async confirmarBorrador(name: string) {
    // Al confirmar, ERPNext le pone fecha de HOY a la preventa (no trae «fijar
    // fecha»), pero el vencimiento y el calendario de pagos se quedaban en la
    // fecha en que se guardó → «Due Date cannot be before Posting» (prod, #87,
    // 23-sep). Vacíos, ERPNext los recalcula a partir de la fecha nueva.
    const updated = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'PUT', body: JSON.stringify({ docstatus: 1, due_date: null, payment_schedule: [] }) }
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
      // ponytail: 2000 = mismo techo que getCompras; con 100, un rango de
      // fechas amplio truncaba lo viejo en silencio (bug ya mordido en julio).
      limit_page_length: '2000',
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params, { signal });
    return data?.data || [];
  }

  /**
   * Lista facturas pendientes de cobro (outstanding > 0) opcionalmente por cliente.
   * Excluye POS. Solo submitted.
   */
  async getFacturasPendientes(
    { customer = null, tipo }: { customer?: string | null; tipo?: 'pan' | 'abarrote' } = {},
    signal?: AbortSignal,
  ) {
    const filters: any[][] = [
      ['docstatus', '=', 1],
      ['is_pos', '=', 0],
      ['outstanding_amount', '>', 0],
    ];
    if (customer) filters.push(['customer', '=', customer]);
    // 23-sep: el modal de cobro respeta el filtro Tipo de la tabla. Misma regla
    // que reportes_api.cuentas_por_cobrar: pan = factura de la Hoja del día.
    if (tipo) filters.push(['custom_pedido_diario', 'is', tipo === 'pan' ? 'set' : 'not set']);
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
  /**
   * @param {'pan' | 'abarrote'} [tipo] - Omitido = toda la cartera. 'pan' = Hoja
   *   del día (custom_pedido_diario), 'abarrote' = el resto (Venta B2B). El
   *   backend (reportes_api.cuentas_por_cobrar) truena si el valor no es válido.
   */
  async getCuentasPorCobrar(signal?: AbortSignal, tipo?: 'pan' | 'abarrote') {
    // La suma la hace la base, no el navegador. Antes se pedian TODAS las
    // facturas de la historia (`limit_page_length: 0`) para pintar ~6 renglones:
    // con 70 facturas vuela, con 20,000 baja 20,000 registros para lo mismo.
    // El endpoint devuelve un renglon por cliente y no crece con la historia.
    const q = tipo ? '?tipo=' + tipo : '';
    const json = await this._fetch(
      '/api/method/gestion_panaderia.api.reportes_api.cuentas_por_cobrar' + q, { signal });
    return json?.message || [];
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
        // Lo que paga el cliente (23-sep): `rate` es la base SIN impuesto y en
        // pantalla hacía ver la MANTECADA de $14 en $12.07.
        precio: parseFloat(it.rate || 0) * factorImpuestoRenglon(it.item_tax_rate),
        importe: parseFloat(it.amount || 0) * factorImpuestoRenglon(it.item_tax_rate),
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

  /**
   * Historial de abonos (Payment Entry) de un cliente, más reciente primero.
   * Payment Entry no tiene `posting_time`, así que la hora sale de `creation`
   * (cuándo se capturó); `posting_date` es la fecha contable que eligió el usuario.
   * Devuelve las facturas cubiertas por cada abono para poder desglosarlo.
   */
  async getAbonos({ customer }: { customer: string }) {
    if (!customer) return [];
    const pagos = await this._fetch('/api/resource/Payment Entry?' + new URLSearchParams({
      filters: JSON.stringify([
        ['docstatus', '=', 1],
        ['payment_type', '=', 'Receive'],
        ['party_type', '=', 'Customer'],
        ['party', '=', customer],
      ]),
      fields: JSON.stringify(['name', 'posting_date', 'creation', 'paid_amount', 'mode_of_payment', 'reference_no']),
      order_by: 'creation desc',
      limit_page_length: '100',
    }));
    const lista = pagos?.data || [];
    if (!lista.length) return [];

    // Un solo round-trip para todas las referencias en vez de N.
    const refs = await this._fetch('/api/resource/Payment Entry Reference?' + new URLSearchParams({
      filters: JSON.stringify([['parent', 'in', lista.map((p: any) => p.name)]]),
      fields: JSON.stringify(['parent', 'reference_name', 'allocated_amount']),
      parent: 'Payment Entry',
      limit_page_length: '500',
    }));
    const filas = refs?.data || [];

    // Las referencias traen el name de ERPNext (ACC-SINV-...). Se cambia por el
    // numero de venta que usa la panaderia; el name interno no se muestra nunca.
    const nombres = [...new Set(filas.map((r: any) => r.reference_name))];
    const noVenta: Record<string, any> = {};
    if (nombres.length) {
      const inv = await this._fetch('/api/resource/Sales Invoice?' + new URLSearchParams({
        filters: JSON.stringify([['name', 'in', nombres]]),
        fields: JSON.stringify(['name', 'custom_no_de_venta']),
        limit_page_length: '500',
      }));
      for (const si of inv?.data || []) noVenta[si.name] = si.custom_no_de_venta;
    }

    const porPago: Record<string, any[]> = {};
    for (const r of filas) {
      (porPago[r.parent] ||= []).push({ ...r, no_venta: noVenta[r.reference_name] || null });
    }

    return lista.map((p: any) => ({ ...p, facturas: porPago[p.name] || [] }));
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
