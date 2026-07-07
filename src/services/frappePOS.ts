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
import { TENANT } from '../config/tenant';
import type { OutboxVenta } from '../db/db';

/** Ruta base de los métodos whitelisted del POS */
const POS_METHOD = (fn: string) =>
  `/api/method/${TENANT.frappeApp}.api.pos_api.${fn}`;

/** Mapa de forma de pago (etiqueta UI → nombre exacto en ERPNext) */
const FORMAS_PAGO_MAP: Record<string, string> = {
  'Efectivo':      'Cash',
  'Tarjeta':       'Bank Draft',
  'Transferencia': 'Wire Transfer',
};

/** POS Profile de respaldo si el usuario no tiene uno asignado */
const DEFAULT_POS_PROFILE = TENANT.posProfileDefault;

interface PosProfileData { name: string; warehouse: string | null; }
interface PagoInput { metodo: string; monto: number; }
interface ItemInput {
  item_code: string;
  item_name?: string;
  qty: number;
  precio: number | string;
  stock_uom?: string;
}
interface CrearVentaArgs { items: ItemInput[]; customer?: string; pagos?: PagoInput[]; }

class FrappePOSService extends FrappeBase {
  _posProfileData: PosProfileData | null = null;

  /**
   * Fetch + caché del POS Profile del usuario activo.
   * El backend devuelve {name, warehouse}. Un solo request, cacheado;
   * getPOSProfile() y getWarehouse() lo consumen sin duplicar la llamada.
   * @private
   * @returns {Promise<{name: string, warehouse: string|null}>}
   */
  async _getProfileData(): Promise<PosProfileData> {
    if (this._posProfileData) return this._posProfileData;
    const json = await this._fetch(POS_METHOD('get_pos_profile_usuario'));
    this._posProfileData = json?.message || { name: DEFAULT_POS_PROFILE, warehouse: null };
    return this._posProfileData!;
  }

  /** Nombre del POS Profile del usuario activo (string). */
  async getPOSProfile(): Promise<string> {
    const { name } = await this._getProfileData();
    return name;
  }

  /** Warehouse del POS Profile del usuario activo (de dónde vende su sucursal). */
  async getWarehouse(): Promise<string | null> {
    const { warehouse } = await this._getProfileData();
    return warehouse;
  }

  /** Limpia el caché de sesión. Llamar desde logout() para evitar que un usuario
   *  herede el POS Profile de la sesión anterior. */
  clearCache() {
    this._posProfileData = null;
  }

  // ─────────────────────────────────────────────────
  // CATÁLOGO DE PRODUCTOS PARA VENTA
  // ─────────────────────────────────────────────────

  /**
   * Carga todos los productos terminados usando el endpoint dedicado del backend.
   * El filtrado por búsqueda y departamento se hace en el cliente.
   * @returns {Promise<Array>} Lista completa de productos con precio de venta.
   */
  async buscarProductos(): Promise<any[]> {
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
  async crearVenta({ items, customer = DEFAULT_CUSTOMER, pagos = [] }: CrearVentaArgs) {
    const today = new Date().toISOString().split('T')[0];
    const posProfile = await this.getPOSProfile();

    const payments = pagos
      .filter(p => p.monto > 0)
      .map(p => ({
        mode_of_payment: FORMAS_PAGO_MAP[p.metodo] || 'Cash',
        amount: p.monto,
      }));

    // Si no se especificó ningún pago, usar efectivo por el total
    if (payments.length === 0) {
      const total = items.reduce((s, i) => s + i.qty * (parseFloat(String(i.precio)) || 0), 0);
      payments.push({ mode_of_payment: 'Cash', amount: total });
    }

    const payload = {
      doctype:      'Sales Invoice',
      customer,
      posting_date: today,
      company:      COMPANY,
      is_pos:       1,
      pos_profile:  posProfile,
      items: items.map(i => ({
        item_code: i.item_code,
        item_name: i.item_name,
        qty:       i.qty,
        rate:      parseFloat(String(i.precio)) || 0,
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

  /**
   * Empuja una venta del outbox al endpoint idempotente del backend.
   * Reenviar el mismo uuid NO duplica: el server devuelve la factura original.
   * @param {Object} venta - Fila del outbox {uuid, items, cliente, pagos, total, created_at}.
   * @returns {Promise<Object|null>} {name, duplicada} o null si no hay red.
   */
  async crearVentaOffline(venta: OutboxVenta) {
    // OutboxVenta es un bag laxo ([k]: unknown); cast honesto en la frontera.
    const pagos = (venta.pagos as PagoInput[] | undefined) || [];
    const items = (venta.items as ItemInput[] | undefined) || [];
    const payments = pagos
      .filter(p => p.monto > 0)
      .map(p => ({
        mode_of_payment: FORMAS_PAGO_MAP[p.metodo] || 'Cash',
        amount: p.monto,
      }));
    if (payments.length === 0) {
      payments.push({ mode_of_payment: 'Cash', amount: Number(venta.total) || 0 });
    }

    const json = await this._fetch(POS_METHOD('registrar_venta_pos'), {
      method: 'POST',
      body: JSON.stringify({
        uuid:         venta.uuid,
        customer:     venta.cliente || DEFAULT_CUSTOMER,
        // La venta conserva SU fecha aunque se drene días después
        posting_date: (venta.created_at || '').split('T')[0] || undefined,
        items: items.map(i => ({
          item_code: i.item_code,
          qty:       i.qty,
          rate:      parseFloat(String(i.precio)) || 0,
          uom:       i.stock_uom || 'Nos',
        })),
        payments,
      }),
    });
    return json === null ? null : json?.message;
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
  async getCorteCaja(fechaInicio: string, fechaFin: string | null = null) {
    const fin = fechaFin || fechaInicio;
    const posProfile = await this.getPOSProfile();
    const params = new URLSearchParams({ fecha_inicio: fechaInicio, fecha_fin: fin, pos_profile: posProfile });
    const json = await this._fetch(`${POS_METHOD('get_corte_caja')}?${params}`);
    return json?.message;
  }

  /**
   * Genera un reporte de ventas por rango de fechas libre.
   * @param {string} fechaInicio - Fecha inicio ISO YYYY-MM-DD.
   * @param {string} fechaFin    - Fecha fin ISO YYYY-MM-DD.
   * @returns {Promise<Object>} Datos del reporte.
   */
  async getReporteVentas(fechaInicio: string, fechaFin: string) {
    const posProfile = await this.getPOSProfile();
    const params = new URLSearchParams({ fecha_inicio: fechaInicio, fecha_fin: fechaFin, pos_profile: posProfile });
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
  async getVentasDelDia(fechaInicio: string | null = null, fechaFin: string | null = null): Promise<any[]> {
    const hoy = new Date().toISOString().split('T')[0];
    const desde = fechaInicio || hoy;
    const hasta = fechaFin || desde;
    const posProfile = await this.getPOSProfile();
    const params = new URLSearchParams({ fecha_inicio: desde, fecha_fin: hasta, pos_profile: posProfile });
    const json = await this._fetch(`${POS_METHOD('get_ventas_historial')}?${params}`);
    return json?.message || [];
  }

  /**
   * Cancela una Sales Invoice existente (docstatus → 2).
   * @param {string} name - ID del documento (Ej: "ACC-SINV-2026-00001").
   * @returns {Promise<void>}
   */
  async cancelarVenta(name: string) {
    await this._fetch(`/api/resource/Sales Invoice/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body:   JSON.stringify({ docstatus: 2 }),
    });
  }
}

export const posService = new FrappePOSService();
export default FrappePOSService;
