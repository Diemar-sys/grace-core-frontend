import { resolveRole } from '../config/roles';

// URL vacía intencional: el proxy de Vite (vite.config.js) redirige /api/* → Frappe.
// En producción, el reverse proxy de nginx hace lo mismo, por lo que tampoco se necesita.
const FRAPPE_URL = '';

class FrappeAuthService {
  constructor() {
    this.baseUrl = FRAPPE_URL;
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

  async login(usuario, contrasena) {
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

    const [role, posProfile] = await Promise.all([
      this._fetchRole(),
      this._fetchPOSProfile(),
    ]);
    localStorage.setItem('frappe_user', JSON.stringify({
      email,
      fullName: data.full_name,
      role,
      posProfile,
    }));

    return data;
  }

  async _fetchRole() {
    try {
      const res = await fetch(
        '/api/method/gestion_panaderia.api.pos_api.get_user_app_role'
      );
      // Fail-closed: si el servidor no responde correctamente, usar el rol de menor privilegio
      if (!res.ok) return 'vendedor';
      const data = await res.json();
      return data.message === 'admin' ? 'admin' : 'vendedor';
    } catch {
      // Sin red o error inesperado → mínimo privilegio
      return 'vendedor';
    }
  }

  async _fetchPOSProfile() {
    try {
      const res = await fetch(
        '/api/method/gestion_panaderia.api.pos_api.get_pos_profile_usuario'
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.message || null;
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
    await fetch(`/api/method/logout`);
    localStorage.removeItem('frappe_user');
    // Limpiar caché de servicios para evitar que el siguiente usuario
    // herede datos de la sesión anterior (ej: POS Profile incorrecto).
    const { posService } = await import('./frappePOS');
    posService.clearCache();
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
      // Verificar campos mínimos y que el rol sea un valor conocido
      const ROLES_VALIDOS = ['admin', 'vendedor'];
      if (!user?.email || !ROLES_VALIDOS.includes(user?.role)) {
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
  async getList(doctype, filters = {}, fields = ['name']) {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      fields: JSON.stringify(fields)
    });

    const response = await fetch(`/api/resource/${doctype}?${params}`);
    return response.json();
  }
}
// Exporta una instancia única (Singleton) para manejar la sesión globalmente
export const auth = new FrappeAuthService();