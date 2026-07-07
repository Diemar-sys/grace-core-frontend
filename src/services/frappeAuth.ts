import FrappeBase from './FrappeBase';
import { loadAppConfig, clearAppConfigCache } from './appConfig';
import { loadSucursalesConfig, clearSucursalesConfigCache } from './sucursalesConfig';
import { NIVELES_VALIDOS } from '../config/roles';

// URL vacía intencional: el proxy de Vite (vite.config.js) redirige /api/* → Frappe.
// En producción, el reverse proxy de nginx hace lo mismo, por lo que tampoco se necesita.
const FRAPPE_URL = '';

class FrappeAuthService extends FrappeBase {
  constructor() {
    super(FRAPPE_URL);
  }

  // ─────────────────────────────────────────────
  // CONTROL DE SESIÓN
  // ─────────────────────────────────────────────

  /**
   * Envía las credenciales al servidor para iniciar sesión.
   * Si es exitoso, Frappe establece una cookie 'sid' automáticamente
   * y nosotros guardamos una copia de los datos básicos en LocalStorage para la UI.
   * @param {string} usuario - Correo electrónico o nombre de usuario en ERPNext
   * @param {string} contrasena - Contraseña del usuario
   * @returns {Object} Respuesta completa del servidor
   */

  async login(usuario: string, contrasena: string) {
    const response = await fetch(`/api/method/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        usr: usuario,
        pwd: contrasena
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error de autenticación');
    }

    const data = await response.json();

    const emailRes = await fetch('/api/method/frappe.auth.get_logged_user');
    const emailData = await emailRes.json();
    const email = emailData.message;

    const [role, posProfile, puedeCuentas] = await Promise.all([
      this._fetchRole(),
      this._fetchPOSProfile(),
      this._fetchPuedeCuentas(),
    ]);
    localStorage.setItem('frappe_user', JSON.stringify({
      email,
      fullName: data.full_name,
      role,
      posProfile,
      puedeCuentas,
    }));

    // Pre-cargar configs dinámicos para que reads síncronos (buildTaxes,
    // clientesB2B helpers) tengan cache poblada. Fallback transparente si
    // endpoint backend no existe.
    await Promise.all([
      loadAppConfig(),
      loadSucursalesConfig(),
    ]);

    return data;
  }

  async _fetchRole() {
    try {
      const res = await fetch(
        '/api/method/gestion_panaderia.api.pos_api.get_user_app_role'
      );
      // Fail-closed: si el servidor no responde correctamente, usar el nivel de menor privilegio
      if (!res.ok) return 'Vendedor';
      const data = await res.json();
      return NIVELES_VALIDOS.includes(data.message) ? data.message : 'Vendedor';
    } catch {
      // Sin red o error inesperado → mínimo privilegio
      return 'Vendedor';
    }
  }

  async _fetchPuedeCuentas() {
    try {
      const res = await fetch(
        '/api/method/gestion_panaderia.api.cuentas_api.puede_administrar_cuentas'
      );
      if (!res.ok) return false;  // fail-closed
      const data = await res.json();
      return data.message === true;
    } catch {
      return false;
    }
  }

  async _fetchPOSProfile() {
    try {
      const res = await fetch(
        '/api/method/gestion_panaderia.api.pos_api.get_pos_profile_usuario'
      );
      if (!res.ok) return null;
      const data = await res.json();
      // El endpoint ahora devuelve {name, warehouse}; el badge solo usa el nombre.
      return data?.message?.name || null;
    } catch {
      return null;
    }
  }

  async getLoggedUser() {
    const response = await fetch(`/api/method/frappe.auth.get_logged_user`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return null;
    return response.json();
  }

  /**
   * Cierra la sesión activa en Frappe (invalida la cookie) 
   * y remueve los datos del usuario cacheados localmente.
   * @returns {Promise<void>}
   */
  async logout() {
    // Estado local PRIMERO (síncrono, antes del await): cierra la sesión sí o sí,
    // sin depender de la red → rompe la carrera con el redirect de Login.
    localStorage.removeItem('frappe_user');
    // Avisar al server (invalida cookie sid). Best-effort: offline NO debe frenar.
    try {
      await fetch(`/api/method/logout`);
    } catch {
      // offline / server caído: la sesión local ya quedó cerrada arriba.
    }
    // Limpiar caché de servicios para evitar que el siguiente usuario
    // herede datos de la sesión anterior (ej: POS Profile, almacenes, etc.).
    const [{ posService }, { inventory }, { stockService }] = await Promise.all([
      import('./frappePOS'),
      import('./frappeInventory'),
      import('./frappeStock'),
    ]);
    posService.clearCache();
    inventory.clearCache();
    stockService.clearCache();
    clearAppConfigCache();
    clearSucursalesConfigCache();
    // Limpiar IndexedDB: catálogo y stock son caché por sesión.
    // El outbox NO se toca: puede tener ventas sin sincronizar (son del negocio,
    // no del usuario) — borrarlas sería pérdida contable.
    try {
      const { db } = await import('../db/db');
      await Promise.all([db.catalogo.clear(), db.stock.clear()]);
    } catch {
      // best-effort: un fallo de IndexedDB no debe frenar el logout
    }
  }

  // ─────────────────────────────────────────────
  // LECTURA LOCAL (SÍNCRONA)
  // ─────────────────────────────────────────────

  /**
   * Obtiene los datos del usuario directamente del LocalStorage sin consultar al servidor.
   * Útil para renderizados visuales inmediatos.
   *
   * Valida la estructura del objeto para evitar que una manipulación de localStorage
   * (ej. desde DevTools) eleve el rol de un usuario en la interfaz.
   *
   * @returns {Object|null} Objeto con email, fullName y role, o null si no hay sesión válida.
   */
  getUser() {
    try {
      const raw = localStorage.getItem('frappe_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      // Verificar campos mínimos y que el nivel sea un valor conocido
      if (!user?.email || !NIVELES_VALIDOS.includes(user?.role)) {
        // Objeto malformado o rol inesperado — limpiar y forzar re-login
        localStorage.removeItem('frappe_user');
        return null;
      }
      return user;
    } catch {
      localStorage.removeItem('frappe_user');
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // UTILERÍAS GENÉRICAS
  // ─────────────────────────────────────────────

  /**
   * Método comodín para consultar rápidamente cualquier catálogo de Frappe.
   * Construye dinámicamente los parámetros de búsqueda en la URL.
   * @param {string} doctype - Nombre de la tabla en Frappe (ej. 'Supplier')
   * @param {Object} [filters={}] - Objeto con filtros (ej. { "disabled": 0 })
   * @param {Array<string>} [fields=['name']] - Arreglo de columnas a retornar
   * @returns {Promise<Object>} Respuesta JSON con el arreglo de datos en la propiedad .data
   */
  async getList(doctype: string, filters: Record<string, any> = {}, fields: string[] = ['name']) {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      fields: JSON.stringify(fields),
    });
    // Usar _fetch() (heredado de FrappeBase) para tener manejo de errores
    // consistente: CSRF, parsing de errores Frappe y throw en 4xx/5xx.
    return this._fetch(`/api/resource/${doctype}?${params}`);
  }
}
// Exporta una instancia única (Singleton) para manejar la sesión globalmente
export const auth = new FrappeAuthService();