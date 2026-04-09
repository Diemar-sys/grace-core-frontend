/**
 * FrappeAuthService
 *
 * Servicio encargado de manejar el ciclo de vida de la sesión del usuario
 * (Login, Logout, Verificación) usando el sistema de autenticación nativo de Frappe
 * basado en Cookies (Session ID).
 */
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

    localStorage.setItem('frappe_user', JSON.stringify({
      email: data.message,
      fullName: data.full_name
    }));

    return data;
  }

  /**
   * Consulta al backend de Frappe si la cookie de sesión actual sigue siendo válida.
   * Ideal para validar accesos a rutas protegidas (Route Guards) en React.
   * @returns {Promise<Object|null>} Datos del usuario si la sesión es válida, null si expiró
   */
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
  }

  // ─────────────────────────────────────────────
  // LECTURA LOCAL (SÍNCRONA)
  // ─────────────────────────────────────────────

  /**
   * Obtiene los datos del usuario directamente del LocalStorage sin consultar al servidor.
   * Útil para renderizados visuales inmediatos.
   * @returns {Object|null} Objeto con email y fullName, o null si no hay datos
   */
  getUser() {
    const user = localStorage.getItem('frappe_user');
    return user ? JSON.parse(user) : null;
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