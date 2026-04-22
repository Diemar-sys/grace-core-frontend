/**
 * FrappePOSService
 *
 * Gestiona el flujo de Punto de Venta:
 * - Búsqueda de Productos Terminados disponibles.
 * - Creación y envío de Sales Invoice en ERPNext.
 * - Consulta del historial de ventas del día.
 * - Cancelación de ventas.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, DEFAULT_CUSTOMER } from '../config/constants';

/** Ruta base de los métodos whitelisted del POS */
const POS_METHOD = (fn) =>
  `/api/method/gestion_panaderia.api.pos_api.${fn}`;

/** Mapa de forma de pago (etiqueta UI → nombre exacto en ERPNext) */
const FORMAS_PAGO_MAP = {
  'Efectivo':      'Cash',
  'Tarjeta':       'Bank Draft',
  'Transferencia': 'Wire Transfer',
};

/** Nombre del POS Profile configurado en ERPNext */
const POS_PROFILE = 'Grace POS';

class FrappePOSService extends FrappeBase {

  // ─────────────────────────────────────────────────
  // CATÁLOGO DE PRODUCTOS PARA VENTA
  // ─────────────────────────────────────────────────

  /**
   * Carga todos los productos terminados usando el endpoint dedicado del backend.
   * El filtrado por búsqueda y departamento se hace en el cliente.
   * @returns {Promise<Array>} Lista completa de productos con precio de venta.
   */
  async buscarProductos() {
    const json = await this._fetch(POS_METHOD('get_productos_venta'));
    return json?.message || [];
  }

  // ─────────────────────────────────────────────
  // REGISTRO DE VENTA
  // ─────────────────────────────────────────────

  /**
   * Crea y envía (docstatus=1) una Sales Invoice en ERPNext.
   * @param {Object} args
   * @param {Array}  args.items  - Artículos del ticket [{item_code, item_name, qty, precio, stock_uom}].
   * @param {string} [args.customer] - Nombre del cliente.
   * @param {Array}  args.pagos  - [{metodo: 'Efectivo'|'Tarjeta'|'Transferencia', monto: number}]
   * @returns {Promise<Object>} Documento Sales Invoice creado.
   */
  async crearVenta({ items, customer = DEFAULT_CUSTOMER, pagos = [] }) {
    const today = new Date().toISOString().split('T')[0];

    const payments = pagos
      .filter(p => p.monto > 0)
      .map(p => ({
        mode_of_payment: FORMAS_PAGO_MAP[p.metodo] || 'Cash',
        amount: p.monto,
      }));

    // Si no se especificó ningún pago, usar efectivo por el total
    if (payments.length === 0) {
      const total = items.reduce((s, i) => s + i.qty * parseFloat(i.precio || 0), 0);
      payments.push({ mode_of_payment: 'Cash', amount: total });
    }

    const payload = {
      doctype:      'Sales Invoice',
      customer,
      posting_date: today,
      company:      COMPANY,
      is_pos:       1,
      pos_profile:  POS_PROFILE,
      items: items.map(i => ({
        item_code: i.item_code,
        item_name: i.item_name,
        qty:       i.qty,
        rate:      parseFloat(i.precio) || 0,
        uom:       i.stock_uom || 'Nos',
      })),
      payments,
    };

    // 1) Crear en borrador
    const data = await this._fetch('/api/resource/Sales Invoice', {
      method: 'POST',
      body:   JSON.stringify(payload),
    });

    // 2) Enviar (docstatus 0 → 1)
    const name = data.data.name;
    await this._fetch(`/api/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body:   JSON.stringify({ docstatus: 1 }),
    });

    return data.data;
  }

  // ─────────────────────────────────────────────────
  // CORTE DE CAJA Y REPORTES (endpoints Python)
  // ─────────────────────────────────────────────────

  /**
   * Obtiene el corte de caja de un rango de fechas.
   * @param {string} fechaInicio - Fecha ISO YYYY-MM-DD.
   * @param {string} [fechaFin]  - Fecha fin ISO. Default: igual a fechaInicio.
   * @returns {Promise<Object>} Datos del corte de caja.
   */
  async getCorteCaja(fechaInicio, fechaFin = null) {
    const fin = fechaFin || fechaInicio;
    const params = new URLSearchParams({ fecha_inicio: fechaInicio, fecha_fin: fin });
    const json = await this._fetch(`${POS_METHOD('get_corte_caja')}?${params}`);
    return json?.message;
  }

  /**
   * Genera un reporte de ventas por rango de fechas libre.
   * @param {string} fechaInicio - Fecha inicio ISO YYYY-MM-DD.
   * @param {string} fechaFin    - Fecha fin ISO YYYY-MM-DD.
   * @returns {Promise<Object>} Datos del reporte.
   */
  async getReporteVentas(fechaInicio, fechaFin) {
    const params = new URLSearchParams({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
    const json = await this._fetch(`${POS_METHOD('get_reporte_ventas')}?${params}`);
    return json?.message;
  }

  // ─────────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────────

  /**
   * Obtiene las ventas registradas en una fecha dada (hoy por defecto).
   * @param {string|null} [fecha] - Fecha ISO YYYY-MM-DD.
   * @returns {Promise<Array>} Lista de Sales Invoices.
   */
  async getVentasDelDia(fechaInicio = null, fechaFin = null) {
    const hoy = new Date().toISOString().split('T')[0];
    const desde = fechaInicio || hoy;
    const hasta = fechaFin || desde;
    const params = new URLSearchParams({
      fields: JSON.stringify([
        'name', 'customer', 'grand_total', 'creation', 'docstatus', 'status',
      ]),
      filters: JSON.stringify([
        ['posting_date', 'between', [desde, hasta]],
        ['company',   '=', COMPANY],
      ]),
      order_by:         'creation desc',
      limit_page_length: 500,
    });
    const data = await this._fetch(`/api/resource/Sales Invoice?${params}`);
    return data.data || [];
  }

  /**
   * Cancela una Sales Invoice existente (docstatus → 2).
   * @param {string} name - ID del documento (Ej: "ACC-SINV-2026-00001").
   * @returns {Promise<void>}
   */
  async cancelarVenta(name) {
    await this._fetch(`/api/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body:   JSON.stringify({ docstatus: 2 }),
    });
  }
}

export const posService = new FrappePOSService();
export default FrappePOSService;
