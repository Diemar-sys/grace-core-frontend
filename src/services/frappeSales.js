/**
 * FrappeSalesService
 * Maneja Sales Invoice (con update_stock=1) en ERPNext para venta B2B.
 * Para clientes con sucursal extendida (Puerta Real) mueve stock a su warehouse.
 * Para clientes puros (DELI, ZAKIA) baja stock de Bodega Central directo.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL } from '../config/constants';
import { IMPUESTOS_LIST } from '../config/impuestos';
import { getTargetWarehouse } from '../config/clientesB2B';

const CUENTA_IVA_TRASLADADO = 'IVA POR TRASLADAR o COBRADO - PG';
const CUENTA_AJUSTE = 'AJUSTE POR REDONDEO - PG';

class FrappeSalesService extends FrappeBase {
  getImpuestos() { return IMPUESTOS_LIST; }

  /**
   * Siguiente número de venta consecutivo (custom_no_de_venta).
   * Mismo patrón que comprasService.getSiguienteNumero.
   */
  async getSiguienteNumero() {
    const params = new URLSearchParams({
      fields: JSON.stringify(['custom_no_de_venta']),
      filters: JSON.stringify([['docstatus', 'in', [0, 1]]]),
      order_by: 'custom_no_de_venta desc',
      limit_page_length: 1,
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params);
    const ultimo = data.data?.[0]?.custom_no_de_venta || 0;
    return ultimo + 1;
  }

  /**
   * Busca clientes B2B (excluye Público en General que es POS).
   */
  async buscarClientes(search = '') {
    if (search.length > 0 && search.length < 2) return [];
    if (this._abortCliente) this._abortCliente.abort();
    this._abortCliente = new AbortController();

    const filters = [
      ['disabled', '=', 0],
      ['name', '!=', 'Público en General'],
    ];
    if (search) filters.push(['customer_name', 'like', '%' + search + '%']);
    const params = new URLSearchParams({
      fields: JSON.stringify(['name', 'customer_name', 'customer_group']),
      filters: JSON.stringify(filters),
      limit_page_length: 20,
    });
    try {
      const data = await this._fetch('/api/resource/Customer?' + params, {
        signal: this._abortCliente.signal,
      });
      return data?.data || [];
    } catch (err) {
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
        'custom_impuesto', 'custom_cantidad_por_presentación',
        'custom_precio_de_venta', 'custom_precio_por_kg', 'standard_rate',
        'valuation_rate',
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: 20,
    });
    try {
      const data = await this._fetch('/api/resource/Item?' + params, {
        signal: this._abortItems.signal,
      });
      return data?.data || [];
    } catch (err) {
      if (err.name === 'AbortError') return [];
      throw err;
    }
  }

  /**
   * Calcula y agrupa impuestos para venta.
   * Solo IVA + Tasa 0 (B2B panadería no causa IEPS típicamente).
   */
  _calcularImpuestos(items, taxOverrides = {}) {
    const round2 = (n) => Math.round(n * 100) / 100;
    const grupos = {};
    items.forEach(item => {
      const rate = parseFloat(item.impuesto_rate || 0);
      const key = item.impuesto_key || 'tasa0';
      const label = item.impuesto_label || 'Tasa 0';
      const base = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
      const monto = base * rate;
      if (!grupos[key]) grupos[key] = { label, rate, monto: 0 };
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
        account_head: CUENTA_IVA_TRASLADADO,
      }));
  }

  _buildPayload({ customer, fecha, items, notas = '', ajuste = 0, noVenta = null, taxOverrides = {}, subtotalOverrides = {} }) {
    const resumenImpuestos = this._calcularImpuestos(items, taxOverrides);
    const ajusteNum = parseFloat(ajuste || 0);

    if (ajusteNum !== 0) {
      resumenImpuestos.push({
        charge_type: 'Actual',
        description: 'Ajuste por Redondeo',
        tax_amount: ajusteNum,
        account_head: CUENTA_AJUSTE,
      });
    }

    const targetWarehouse = getTargetWarehouse(customer);

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
      custom_target_warehouse: targetWarehouse || null,
      custom_subtotal_iva_16: subtotalOverrides.iva16 ?? null,
      custom_subtotal_iva_0:  subtotalOverrides.tasa0 ?? null,
      items: items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: parseFloat(item.qty),
        rate: parseFloat(item.rate),
        uom: item.uom,
        stock_uom: item.uom,
        warehouse: BODEGA_CENTRAL,
        target_warehouse: targetWarehouse || undefined,
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
   */
  async guardarBorrador({ customer, fecha, items, notas, ajuste, taxOverrides = {}, subtotalOverrides = {} }) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const noVenta = await this.getSiguienteNumero();
    const payload = this._buildPayload({ customer, fecha, items, notas, ajuste, noVenta, taxOverrides, subtotalOverrides });
    const created = await this._fetch('/api/resource/Sales Invoice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return created.data;
  }

  /**
   * Crea + submitea venta (docstatus 1). Genera movimiento stock.
   */
  async registrarVenta({ customer, fecha, items, notas, ajuste, taxOverrides = {}, subtotalOverrides = {} }) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const noVenta = await this.getSiguienteNumero();
    const payload = this._buildPayload({ customer, fecha, items, notas, ajuste, noVenta, taxOverrides, subtotalOverrides });
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

  async getVentaBorrador(name) {
    const data = await this._fetch('/api/resource/Sales Invoice/' + encodeURIComponent(name));
    return data.data;
  }

  async actualizarBorrador(name, { customer, fecha, items, notas, ajuste, taxOverrides = {}, subtotalOverrides = {} }) {
    if (!customer) throw new Error('Selecciona un cliente');
    if (!items?.length) throw new Error('Agrega al menos un producto');
    const doc = await this.getVentaBorrador(name);
    const noVenta = doc.custom_no_de_venta || null;
    const payload = this._buildPayload({ customer, fecha, items, notas, ajuste, noVenta, taxOverrides, subtotalOverrides });
    const updated = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'PUT', body: JSON.stringify(payload) }
    );
    return updated.data;
  }

  async confirmarBorrador(name) {
    const updated = await this._fetch(
      '/api/resource/Sales Invoice/' + encodeURIComponent(name),
      { method: 'PUT', body: JSON.stringify({ docstatus: 1 }) }
    );
    return updated.data;
  }

  async cancelarVenta(name) {
    const data = await this._fetch(
      '/api/method/frappe.client.cancel',
      { method: 'POST', body: JSON.stringify({ doctype: 'Sales Invoice', name }) }
    );
    return data.message;
  }

  async eliminarBorrador(name) {
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
  async getVentas({ desde = null, hasta = null, customer = null } = {}, signal) {
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
        'custom_no_de_venta', 'custom_target_warehouse',
      ]),
      filters: JSON.stringify(filters),
      order_by: 'custom_no_de_venta desc',
      limit_page_length: 100,
    });
    const data = await this._fetch('/api/resource/Sales Invoice?' + params, { signal });
    return data?.data || [];
  }
}

export const ventasService = new FrappeSalesService();
export default FrappeSalesService;
