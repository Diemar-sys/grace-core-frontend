/**
 * FrappeComprasService
 * Maneja Purchase Receipt en ERPNext para registro de compras a proveedores.
 */

import FrappeBase from './FrappeBase';
import { COMPANY, BODEGA_CENTRAL } from '../config/constants';
import { IMPUESTOS_LIST } from '../config/impuestos';
import { calcConversion } from '../components/compras/compraUtils';
import { getAppConfigSync } from './appConfig';

// Payload del formulario de compra, compartido por guardar/registrar/actualizar.
interface CompraInput {
  supplier: string;
  fecha?: string;
  billNo?: string;
  notaRemision?: string;
  tipoComprobante?: string;
  items: any[];
  notas?: string;
  ajuste?: number | string;
  descuento?: number | string;
  noCompra?: number | null;
  facturadoA?: string;
  taxOverrides?: Record<string, number>;
  subtotalOverrides?: { iva16?: number; ieps?: number; tasa0?: number };
}

class FrappeComprasService extends FrappeBase {
  _abortProveedor: AbortController | null = null;
  _abortItems: AbortController | null = null;

  /**
   * Obtiene la lista de impuestos aplicables predefinidos.
   */
  getImpuestos() { return IMPUESTOS_LIST; }

  async getItemsCatalogo(itemCodes: string[]): Promise<any[]> {
    const res = await this._fetch(
      `/api/method/gestion_panaderia.api.compras_api.get_items_catalogo?item_codes=${encodeURIComponent(JSON.stringify(itemCodes))}`
    );
    return res.message || [];
  }

  // ── Auto-incremento No. de Compra ────────────────────────────────────────

  /**
   * Obtiene el siguiente número de compra consecutivo. La serie es COMPARTIDA
   * entre Purchase Receipt (compras de inventario) y Egreso (gastos categoría
   * GASTO), así que se resuelve en el backend tomando el máximo de ambas tablas.
   */
  async getSiguienteNumero(): Promise<number> {
    const res = await this._fetch(
      "/api/method/gestion_panaderia.api.compras_api.get_siguiente_no_compra"
    );
    return res.message || 1;
  }

  /**
   * Busca proveedores activos en la base de datos de ERPNext.
   * Requiere mínimo 2 caracteres para evitar consultas demasiado amplias.
   * Cancela automáticamente el request anterior si se llama de nuevo antes de recibir respuesta.
   * @param search - Término de búsqueda parcial (filtrará por nombre).
   */
  async buscarProveedores(search = ""): Promise<any[]> {
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
      limit_page_length: '20',
    });
    try {
      const data = await this._fetch("/api/resource/Supplier?" + params, {
        signal: this._abortProveedor.signal,
      });
      return data?.data || [];
    } catch (err) {
      if ((err as any)?.name === "AbortError") return [];  // Request cancelado intencionalmente
      throw err;
    }
  }

  /**
   * Busca insumos/productos habilitados en el sistema ERPNext.
   * Requiere mínimo 3 caracteres para reducir la carga en la base de datos.
   * Cancela automáticamente el request anterior si se llama antes de recibir respuesta.
   * @param search - Término de búsqueda parcial (filtrará por nombre del ítem).
   */
  async buscarItems(search = ""): Promise<any[]> {
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
        "last_purchase_rate", "custom_impuesto", "custom_presentación",
        "custom_cantidad_por_presentación", "custom_precio_de_compra",
        "custom_precio_por_kg",
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: '20',
    });
    try {
      const data = await this._fetch("/api/resource/Item?" + params, {
        signal: this._abortItems.signal,
      });
      return data?.data || [];
    } catch (err) {
      if ((err as any)?.name === "AbortError") return [];  // Request cancelado intencionalmente
      throw err;
    }
  }

  /**
   * Calcula y agrupa los impuestos generados por los ítems comprados.
   * Prepara la estructura JSON esperada por ERPNext para la tabla de impuestos.
   * @param items - Lista de ítems de la compra.
   * @returns Arreglo de impuestos agrupados por tipo (IVA, IEPS, etc.)
   */
  _calcularImpuestos(items: any[], taxOverrides: Record<string, number> = {}, cuentas: any = null): any[] {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const cfg = cuentas || getAppConfigSync().cuentas;
    const grupos: Record<string, { label: string; rate: number; monto: number }> = {};
    items.forEach(item => {
      const rate = parseFloat(item.impuesto_rate || 0);
      const key = item.impuesto_key || "tasa0";
      const label = item.impuesto_label || "Tasa 0";
      // Sin redondeo por línea — suma con precisión completa, redondea solo al final.
      // ERPNext con Currency Precision = 6 hace lo mismo server-side.
      const base = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
      const monto = base * rate;
      if (!grupos[key]) grupos[key] = { label, rate, monto: 0 };
      grupos[key].monto += monto;
    });
    // IVA/IEPS sobre el valor COMPLETO del producto — el descuento NO baja la base
    // gravable ni la valuación (Opción B): va como deducción post-impuestos en _buildPayload.
    // Aplica overrides manuales (para cuadrar con CFDI del proveedor).
    Object.entries(taxOverrides).forEach(([key, amount]) => {
      if (grupos[key]) grupos[key].monto = amount;
    });
    return Object.values(grupos)
      .filter(g => g.monto > 0)
      .map(g => ({
        charge_type: "Actual",
        description: g.label,
        tax_amount: round2(g.monto),
        account_head: g.label.startsWith("IVA") ? cfg.iva_acreditable : cfg.ieps,
      }));
  }

  // ── Construye el payload base ────────────────────────────────────────────

  /**
   * Construye el cuerpo (payload) JSON para la creación o actualización de 'Purchase Receipt'.
   * Transforma los datos de la interfaz a la estructura que espera la API de ERPNext.
   */
  _buildPayload({ supplier, fecha, billNo = "", notaRemision = "", tipoComprobante = "Nota", items, notas = "", ajuste = 0, descuento = 0, noCompra = null, facturadoA = "SIN FACTURA", taxOverrides = {}, subtotalOverrides = {} }: CompraInput): any {
    const descuentoNum = parseFloat(String(descuento || 0));
    const resumenImpuestos = this._calcularImpuestos(items, taxOverrides, null);
    const ajusteNum = parseFloat(String(ajuste || 0));
    const cuentasCfg = getAppConfigSync().cuentas;

    if (ajusteNum !== 0) {
      resumenImpuestos.push({
        charge_type: "Actual",
        description: "Ajuste por Redondeo",
        tax_amount: ajusteNum,
        account_head: cuentasCfg.ajuste,
      });
    }

    // Descuento comercial (Opción B): deducción categoría "Total" → baja el total a
    // pagar (grand_total) pero NO toca el valuation_rate. El producto entra al inventario
    // a su costo completo. Se descuenta DESPUÉS de IVA/IEPS.
    if (descuentoNum > 0) {
      resumenImpuestos.push({
        charge_type: "Actual",
        add_deduct_tax: "Deduct",
        category: "Total",
        description: "Descuento comercial",
        tax_amount: descuentoNum,
        account_head: cuentasCfg.descuento_compra,
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
      custom_nota_remision: notaRemision || "",
      custom_tipo_comprobante: tipoComprobante || "Nota",
      custom_facturado_a: facturadoA || "SIN FACTURA",
      custom_subtotal_iva_16:  subtotalOverrides.iva16  ?? null,
      custom_subtotal_ieps_8:  subtotalOverrides.ieps   ?? null,
      custom_subtotal_iva_0:   subtotalOverrides.tasa0  ?? null,
      items: items.map(item => {
        // Conversión de UOM NATIVA: se compra en la PRESENTACIÓN (CAJA/BULTO/…) y
        // ERPNext calcula solo el stock en unidad base (stock_uom del item) y la
        // valuación por unidad base, usando conversion_factor. El factor es POR ITEM
        // (custom_cantidad_por_presentación), nunca depende del nombre de la presentación.
        // Sin presentación o factor 1 → se compra directo en la unidad base.
        // NO se manda stock_uom: ERPNext lo toma del maestro del item (evita la mentira
        // histórica de stock_uom = presentación con conversion_factor 1).
        const { factor, usarPresentacion } = calcConversion(item.kg_por_bulto, item.presentacion);
        return {
          item_code: item.item_code,
          item_name: item.item_name,
          qty: parseFloat(item.qty),
          rate: parseFloat(item.rate),
          uom: usarPresentacion ? item.presentacion : item.uom,
          conversion_factor: usarPresentacion ? factor : 1,
          warehouse: BODEGA_CENTRAL,
          description: "Impuesto: " + (item.impuesto_label || "Tasa 0"),
        };
      }),
      taxes: resumenImpuestos,
      // Neutraliza el descuento legacy (Opción A): al re-guardar un doc viejo, Frappe
      // conserva los campos padre que no se mandan → sin esto quedaría doble descuento.
      discount_amount: 0,
      additional_discount_percentage: 0,
      disable_rounded_total: 1,
      rounding_adjustment: 0,
    };
  }

  // ── Guardar borrador (docstatus: 0) ─────────────────────────────────────

  /**
   * Crea un 'Purchase Receipt' en estado Borrador (docstatus: 0)
   */
  async guardarBorrador({ supplier, fecha, billNo, notaRemision, tipoComprobante, items, notas, ajuste, descuento, facturadoA, taxOverrides = {}, subtotalOverrides = {} }: CompraInput) {
    if (!supplier) throw new Error("Selecciona un proveedor");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const noCompra = await this.getSiguienteNumero();
    const payload = this._buildPayload({ supplier, fecha, billNo, notaRemision, tipoComprobante, items, notas, ajuste, descuento, noCompra, facturadoA, taxOverrides, subtotalOverrides });
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
   */
  async registrarCompra({ supplier, fecha, billNo, notaRemision, tipoComprobante, items, notas, ajuste, descuento, facturadoA, taxOverrides = {}, subtotalOverrides = {} }: CompraInput) {
    if (!supplier) throw new Error("Selecciona un proveedor");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const noCompra = await this.getSiguienteNumero();
    const payload = this._buildPayload({ supplier, fecha, billNo, notaRemision, tipoComprobante, items, notas, ajuste, descuento, noCompra, facturadoA, taxOverrides, subtotalOverrides });
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
   * @param name - Identificador (name) del Purchase Receipt.
   */
  async getCompraBorrador(name: string) {
    const data = await this._fetch("/api/resource/Purchase Receipt/" + encodeURIComponent(name));
    return data.data;
  }

  // ── Actualizar borrador existente (sin submitear) ────────────────────────

  /**
   * Actualiza los datos de un 'Purchase Receipt' previamente guardado como Borrador.
   * Evita modificar compras que ya hayan sido sometidas.
   * @param name - Identificador de la compra.
   */
  async actualizarBorrador(name: string, { supplier, fecha, billNo, notaRemision, tipoComprobante, items, notas, ajuste, descuento, facturadoA, taxOverrides = {}, subtotalOverrides = {} }: CompraInput) {
    if (!supplier) throw new Error("Selecciona un proveedor");
    if (!items?.length) throw new Error("Agrega al menos un producto");
    const doc = await this.getCompraBorrador(name);
    const noCompra = doc.custom_no_de_compra || null;
    const payload = this._buildPayload({ supplier, fecha, billNo, notaRemision, tipoComprobante, items, notas, ajuste, descuento, noCompra, facturadoA, taxOverrides, subtotalOverrides });
    const updated = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "PUT", body: JSON.stringify(payload) }
    );
    return updated.data;
  }

  // ── Confirmar borrador existente ─────────────────────────────────────────

  /**
   * Pasa un Borrador existente (docstatus: 0) a estado Solicitado/Submiteado (docstatus: 1).
   * @param name - Identificador de la compra.
   */
  async confirmarBorrador(name: string) {
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
   * @param itemCode - Código del item en ERPNext.
   * @param nuevoPrecioCompra - Nuevo precio por empaque/bulto.
   * @param nuevoPrecioPorKg - Nuevo precio por KG (null si no aplica).
   */
  async actualizarPrecioCatalogo(itemCode: string, nuevoPrecioCompra: number, nuevoPrecioPorKg: number | null = null) {
    const payload: any = { custom_precio_de_compra: parseFloat(String(nuevoPrecioCompra)) };
    if (nuevoPrecioPorKg !== null && nuevoPrecioPorKg !== undefined) {
      payload.custom_precio_por_kg = parseFloat(String(nuevoPrecioPorKg));
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
   * @param name - Identificador de la compra.
   */
  async cancelarCompra(name: string) {
    const data = await this._fetch(
      "/api/method/frappe.client.cancel",
      {
        method: "POST",
        body: JSON.stringify({ doctype: "Purchase Receipt", name }),
      }
    );
    return data.message;
  }

  /** Cancela en cascada todas las compras de un grupo consolidado (revierte stock de cada una). */
  async cancelarConsolidado(names: string[]) {
    return this._fetch("/api/method/gestion_panaderia.api.compras_api.cancelar_consolidado", {
      method: "POST",
      body: JSON.stringify({ names: JSON.stringify(names) }),
    });
  }

  // ── Eliminar borrador existente ──────────────────────────────────────────

  /**
   * Elimina un Borrador permanentemente de la base de datos de Frappe.
   * @param name - Identificador de la compra a eliminar.
   */
  async eliminarBorrador(name: string) {
    const result = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "DELETE" }
    );
    return result;
  }

  // ── Editar responsable fiscal (facturado a) ─────────────────────────────

  /**
   * Cambia el campo custom_facturado_a de una compra. Funciona aun en compras
   * confirmadas (docstatus 1) porque el custom field tiene allow_on_submit=1.
   * @param name - Identificador del Purchase Receipt.
   * @param facturadoA - 'SIN FACTURA' | 'ALMA RODRIGUEZ' | 'LUIS TORRES'.
   */
  async updateFacturadoA(name: string, facturadoA: string) {
    const data = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "PUT", body: JSON.stringify({ custom_facturado_a: facturadoA }) }
    );
    return data.data;
  }

  /**
   * Marca/desmarca una compra como pagada. Funciona aun en compras confirmadas
   * (custom field con allow_on_submit=1).
   * @param name - Identificador del Purchase Receipt.
   * @param pagado - true/1 pagada, false/0 pendiente.
   */
  async updatePagado(name: string, pagado: boolean | number) {
    const data = await this._fetch(
      "/api/resource/Purchase Receipt/" + encodeURIComponent(name),
      { method: "PUT", body: JSON.stringify({ custom_pagado: pagado ? 1 : 0 }) }
    );
    return data.data;
  }

  // ── Reporte fiscal mensual ───────────────────────────────────────────────

  async getReporteFiscalMensual(año: number | string): Promise<any[]> {
    const desde = `${año}-01-01`;
    const hasta  = `${año}-12-31`;

    // Lista de receipts confirmados del año
    const lista = await this._fetch(`/api/resource/Purchase Receipt?${new URLSearchParams({
      fields: JSON.stringify(["name","posting_date","grand_total","custom_facturado_a"]),
      filters: JSON.stringify([["docstatus","=",1],["posting_date",">=",desde],["posting_date","<=",hasta]]),
      limit_page_length: '500',
    })}`);

    const entries = lista?.data || [];
    if (!entries.length) return [];

    // Documentos completos en paralelo — incluyen items[] y taxes[] embebidos
    // sin necesitar permisos directos en los child doctypes
    const docs = await Promise.all(
      entries.map((e: any) =>
        this._fetch(`/api/resource/Purchase Receipt/${encodeURIComponent(e.name)}`)
          .then((r: any) => ({ ...r.data, posting_date: e.posting_date, custom_facturado_a: e.custom_facturado_a }))
          .catch(() => null)
      )
    );

    // Clave de agrupación por responsable fiscal
    const facturadoKey = (v: any) => {
      const s = (v || 'SIN FACTURA').toUpperCase();
      if (s === 'ALMA RODRIGUEZ') return 'alma';
      if (s === 'LUIS TORRES')  return 'luis';
      return 'sinFactura';
    };

    const meses: Record<string, any> = {};
    for (const doc of docs) {
      if (!doc) continue;
      const mes = doc.posting_date.slice(0, 7);
      if (!meses[mes]) meses[mes] = { compras: 0, subtotalIva16: 0, subtotalIeps: 0, subtotalTasa0: 0, iva: 0, ieps: 0, total: 0,
        pagado: 0, pendiente: 0, porFacturado: {
          alma:       { pagado: 0, pendiente: 0 },
          luis:       { pagado: 0, pendiente: 0 },
          sinFactura: { pagado: 0, pendiente: 0 },
        } };
      const m = meses[mes];
      m.compras++;
      const gt = parseFloat(doc.grand_total || 0);
      m.total += gt;
      // pagado vs pendiente, global y por responsable fiscal (suman al total de cada quien)
      const fk = facturadoKey(doc.custom_facturado_a);
      if (doc.custom_pagado) { m.pagado += gt; m.porFacturado[fk].pagado += gt; }
      else                   { m.pendiente += gt; m.porFacturado[fk].pendiente += gt; }

      // IVA e IEPS desde tax entries — son los valores ajustados manualmente para cuadrar con CFDI
      let docIva = 0, docIeps = 0;
      for (const t of (doc.taxes || [])) {
        const head = t.account_head || '';
        const desc = t.description  || '';
        if (head.includes('IVA') || desc.includes('IVA')) docIva += parseFloat(t.tax_amount || 0);
        else if (head.includes('IEPS') || desc.includes('IEPS')) docIeps += parseFloat(t.tax_amount || 0);
      }
      m.iva  += docIva;
      m.ieps += docIeps;

      // Leer custom fields guardados al momento de registrar la compra
      // Fallback a reverse-calc para compras anteriores sin custom fields
      const docSubIva16 = doc.custom_subtotal_iva_16  != null
        ? parseFloat(doc.custom_subtotal_iva_16)
        : (docIva  > 0 ? docIva  / 0.16 : 0);
      const docSubIeps  = doc.custom_subtotal_ieps_8  != null
        ? parseFloat(doc.custom_subtotal_ieps_8)
        : (docIeps > 0 ? docIeps / 0.08 : 0);
      const docSubTasa0 = doc.custom_subtotal_iva_0   != null
        ? parseFloat(doc.custom_subtotal_iva_0)
        : Math.max(0, (doc.total || 0) - docSubIva16 - docSubIeps);
      m.subtotalIva16 += docSubIva16;
      m.subtotalIeps  += docSubIeps;
      m.subtotalTasa0 += docSubTasa0;
    }

    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, d]) => ({
        mes,
        ...d,
        subtotal: d.subtotalIva16 + d.subtotalIeps + d.subtotalTasa0,
      }));
  }

  // ── Lista de compras ─────────────────────────────────────────────────────

  /**
   * Obtiene la lista histórico de compras filtrada por fechas o proveedor.
   * @param filtros - Rango de fechas y/o proveedor específico.
   */
  async getCompras({ desde = null, hasta = null, supplier = null }: { desde?: string | null; hasta?: string | null; supplier?: string | null } = {}, signal?: AbortSignal): Promise<any[]> {
    const filters: any[] = [["docstatus", "in", [0, 1, 2]]];
    if (desde) filters.push(["posting_date", ">=", desde]);
    if (hasta) filters.push(["posting_date", "<=", hasta]);
    if (supplier) filters.push(["supplier", "=", supplier]);
    const params = new URLSearchParams({
      fields: JSON.stringify([
        "name", "supplier", "supplier_name", "docstatus",
        "posting_date", "total", "grand_total", "status",
        "custom_no_de_compra", "custom_nota_remision", "custom_tipo_comprobante", "custom_consolidado", "supplier_delivery_note", "rounding_adjustment", "custom_facturado_a", "custom_pagado",
      ]),
      filters: JSON.stringify(filters),
      order_by: "custom_no_de_compra desc",
      // ponytail: cap alto para que un rango de fechas no se trunque (128 en 2 meses ~ 64/mes).
      // Si algún día se consultan rangos enormes (>2000 compras), paginar server-side.
      limit_page_length: '2000',
    });
    const data = await this._fetch("/api/resource/Purchase Receipt?" + params, { signal });
    return data?.data || [];
  }

  /** Marca compras como consolidadas y les asigna el No. de Factura (capturado al agrupar). */
  async consolidarCompras(names: string[], folio = "") {
    return this._fetch("/api/method/gestion_panaderia.api.compras_api.consolidar_compras", {
      method: "POST",
      body: JSON.stringify({ names: JSON.stringify(names), folio }),
    });
  }

  /** Desbloquea una compra consolidada (solo Gerente, validado server-side). */
  async desconsolidarCompra(name: string) {
    return this._fetch("/api/method/gestion_panaderia.api.compras_api.desconsolidar_compra", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Recupera las compras anteriores (historial de facturas) para un ítem determinado.
   * Útil para observar y graficar la volatilidad en los precios de compra.
   * @param itemCode - Código de producto de Frappe.
   * @param meses - Rango de retroceso en meses para evaluar costos.
   */
  async getHistorialPrecios(itemCode: string, meses = 6): Promise<any[]> {
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
      limit_page_length: '200',
    });
    const data = await this._fetch("/api/resource/Purchase Receipt Item?" + params);
    return data.data || [];
  }
}

export const comprasService = new FrappeComprasService();
export default FrappeComprasService;
