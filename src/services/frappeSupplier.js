/**
 * frappeSupplier.js
 * Todos los datos del proveedor en campos custom directos en Supplier.
 * Sin dependencia de Contact ni Address doctypes.
 */

class FrappeProveedoresService {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  #cache = {};

  async #cachedFetch(key, fetcher) {
    if (this.#cache[key]) return this.#cache[key];
    const data = await fetcher();
    this.#cache[key] = data;
    return data;
  }

  /**
   * Genera los headers HTTP básicos para peticiones JSON.
   * Incluye el token CSRF si está incrustado en la página por Frappe.
   * @returns {Object} Headers request.
   */
  getHeaders() {
    return {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": window.csrf_token || "fetch",
    };
  }

  /**
   * Wrapper centralizado para fetch nativo manejando el parseo de errores Frappe.
   * @private
   * @param {string} path - URL relativa del endpoint en Frappe.
   * @param {Object} [options={}] - RequestInit estándar para el fetch.
   * @returns {Promise<any>} Objeto JSON devuelto por la API.
   */
  async #fetch(path, options = {}) {
    const fetchOptions = {
      credentials: "include",
      headers: this.getHeaders(),
      cache: "no-store",
      ...options,
    };
    const response = await fetch(`${this.baseUrl}${path}`, fetchOptions);
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

  // ── Campos custom que se leen/escriben directamente en Supplier ──
  #CAMPOS = [
    "name",
    "supplier_name",
    "supplier_group",
    "disabled",
    "custom_no_de_proveedor",
    "custom_alias",
    "custom_razon_social",
    "custom_direccion",
    "custom_puesto_encargado",
    "custom_teléfono",
    "custom_correo",
    "custom_tipo",
    "custom_contacto_1_nombre",
    "custom_contacto_1_teléfono",
    "custom_contacto_1_puesto",
    "custom_contacto_2_nombre",
    "custom_contacto_2_teléfono",
    "custom_contacto_2_puesto",
  ];

  // ─────────────────────────────────────────────
  // LISTADOS
  // ─────────────────────────────────────────────

  /**
   * Obtiene la lista de todos los proveedores activos, ordenados por número de proveedor.
   * @param {Object} [filtros={}] - Posible filtro de "grupo" (Supplier Group).
   * @returns {Promise<Array<Object>>} Lista de objetos proveedor.
   */
  async getProveedores(filtros = {}) {
    const { grupo, search, page = 1, pageSize = 20 } = filtros;
    const params = new URLSearchParams({ page, page_size: pageSize, disabled: 0 });
    if (grupo) params.append('grupo', grupo);
    if (search) params.append('search', search);

    const res = await this.#fetch(
      `/api/method/gestion_panaderia.api.proveedores_api.get_proveedores?${params}`
    );
    return res.message || { items: [], total: 0, page: 1, page_size: 20, total_pages: 1 };
  }

  /**
   * Obtiene la lista histórico de proveedores deshabilitados o en pausa comercial.
   * @param {Object} [filtros={}] - Posible filtro de grupo.
   * @returns {Promise<Array<Object>>} Lista de proveedores inactivos.
   */
  async getProveedoresDeshabilitados(filtros = {}) {
    const { grupo, search, page = 1, pageSize = 20 } = filtros;
    const params = new URLSearchParams({ page, page_size: pageSize, disabled: 1 });
    if (grupo) params.append('grupo', grupo);
    if (search) params.append('search', search);

    const res = await this.#fetch(
      `/api/method/gestion_panaderia.api.proveedores_api.get_proveedores?${params}`
    );
    return res.message || { items: [], total: 0, page: 1, page_size: 20, total_pages: 1 };
  }

  // ─────────────────────────────────────────────
  // DETALLE COMPLETO
  // ─────────────────────────────────────────────

  /**
   * Consulta el registro completo de un proveedor desde ERPNext.
   * @param {string} supplierName - ID/Key único del proveedor en el docType.
   * @returns {Promise<Object>} Datos detallados incluyendo sus customs hooks.
   * @throws {Error} Si el proveedor no es encontrado.
   */
  async getProveedorCompleto(supplierName) {
    const res = await this.#fetch(
      `/api/resource/Supplier/${encodeURIComponent(supplierName)}`
    );
    const data = res.data;
    if (!data) throw new Error("Proveedor no encontrado");
    return data;
  }

  // ─────────────────────────────────────────────
  // AUTO-INCREMENTO
  // ─────────────────────────────────────────────

  /**
   * Genera secuencialmente el siguiente ID Custom para proveeduría (#).
   * Evita solapamiento de identificaciones.
   * @private
   * @returns {Promise<number>} Número secuencial disponible.
   */
  async #getSiguienteNumero() {
    const res = await this.#fetch(
      `/api/resource/Supplier?fields=${encodeURIComponent(JSON.stringify(["custom_no_de_proveedor"]))}&limit_page_length=500`
    );
    const lista = res.data || [];
    const max = lista.reduce((m, s) => Math.max(m, s.custom_no_de_proveedor || 0), 0);
    return max + 1;
  }

  // ─────────────────────────────────────────────
  // CREAR
  // ─────────────────────────────────────────────

  /**
   * Crea un nuevo Supplier e inyecta la numeración automática de control interno.
   * @param {Object} formData - Diccionario extraído del formulario "NuevoProveedor".
   * @returns {Promise<Object>} Documento final registrado en el backend.
   */
  async createProveedor(formData) {
    const numero = await this.#getSiguienteNumero();

    const res = await this.#fetch("/api/resource/Supplier", {
      method: "POST",
      body: JSON.stringify({
        doctype: "Supplier",
        supplier_name: formData.supplier_name?.trim(),
        supplier_group: formData.supplier_group || "All Supplier Groups",
        supplier_type: "Company",
        disabled: 0,
        custom_no_de_proveedor: numero,
        custom_alias: formData.custom_alias?.trim() || "",
        custom_razon_social: formData.custom_razon_social?.trim() || "",
        custom_direccion: formData.custom_direccion?.trim() || "",
        custom_puesto_encargado: formData.custom_puesto_encargado?.trim() || "",
        custom_teléfono: formData.custom_teléfono?.trim() || "",
        custom_correo: formData.custom_correo?.trim() || "",
        custom_tipo: formData.custom_tipo || "",
        custom_contacto_1_nombre: formData.custom_contacto_1_nombre?.trim() || "",
        custom_contacto_1_teléfono: formData.custom_contacto_1_teléfono?.trim() || "",
        custom_contacto_1_puesto: formData.custom_contacto_1_puesto?.trim() || "",
        custom_contacto_2_nombre: formData.custom_contacto_2_nombre?.trim() || "",
        custom_contacto_2_teléfono: formData.custom_contacto_2_teléfono?.trim() || "",
        custom_contacto_2_puesto: formData.custom_contacto_2_puesto?.trim() || "",
      }),
    });

    return res.data;
  }

  // ─────────────────────────────────────────────
  // ACTUALIZAR
  // ─────────────────────────────────────────────

  /**
   * Llama un PUT a la API de ERPNext para sobrescribir los campos del proveedor.
   * @param {string} supplierName - PK a identificar para modificar.
   * @param {Object} formData - Data mutada del frontend.
   * @returns {Promise<Object>} Registro actualizado.
   */
  async updateProveedor(supplierName, formData) {
    const res = await this.#fetch(
      `/api/resource/Supplier/${encodeURIComponent(supplierName)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          supplier_name: formData.supplier_name?.trim(),
          custom_no_de_proveedor: formData.custom_no_de_proveedor,
          supplier_group: formData.supplier_group || "All Supplier Groups",
          disabled: formData.disabled ? 1 : 0,
          custom_alias: formData.custom_alias?.trim() || "",
          custom_razon_social: formData.custom_razon_social?.trim() || "",
          custom_direccion: formData.custom_direccion?.trim() || "",
          custom_puesto_encargado: formData.custom_puesto_encargado?.trim() || "",
          custom_telefono: formData.custom_telefono?.trim() || "",
          custom_correo: formData.custom_correo?.trim() || "",
          custom_tipo: formData.custom_tipo || "",
          custom_contacto_1_nombre: formData.custom_contacto_1_nombre?.trim() || "",
          custom_contacto_1_teléfono: formData.custom_contacto_1_teléfono?.trim() || "",
          custom_contacto_1_puesto: formData.custom_contacto_1_puesto?.trim() || "",
          custom_contacto_2_nombre: formData.custom_contacto_2_nombre?.trim() || "",
          custom_contacto_2_teléfono: formData.custom_contacto_2_teléfono?.trim() || "",
          custom_contacto_2_puesto: formData.custom_contacto_2_puesto?.trim() || "",
        }),
      }
    );

    return res.data;
  }

  // ─────────────────────────────────────────────
  // CATÁLOGOS
  // ─────────────────────────────────────────────

  /**
   * Obtiene la estructura arborescente (lista simple en frontend) de los grupos de proveedores.
   * @returns {Promise<Array<Object>>} Lista de Supplier Group.
   */
  async getGruposProveedor() {
    return this.#cachedFetch('grupos_proveedor', async () => {
      const res = await this.#fetch(
        `/api/resource/Supplier Group?fields=["name"]&limit_page_length=100`
      );
      return res.data || [];
    });
  }
}

export const proveedores = new FrappeProveedoresService();
export default FrappeProveedoresService;