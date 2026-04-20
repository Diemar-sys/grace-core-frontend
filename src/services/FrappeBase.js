/**
 * FrappeBase
 * Clase base para todos los servicios de ERPNext.
 * Centraliza headers, CSRF token y parsing de errores Frappe.
 */
class FrappeBase {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  getHeaders() {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': window.csrf_token || 'fetch',
    };
  }

  async _fetch(path, options = {}) {
    const fetchOptions = {
      credentials: 'include',
      headers: this.getHeaders(),
      cache: 'no-store',
      ...options,
    };
    const response = await fetch(`${this.baseUrl}${path}`, fetchOptions);

    // Sin conexión — retornar null de forma controlada
    if (response.status === 0) return null;

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));

      // Parsear mensajes de error de Frappe sin que el throw sea engullido
      if (err._server_messages) {
        let userMessage = 'Error interno del servidor Frappe';
        try {
          const messages = JSON.parse(err._server_messages);
          const firstMessage = JSON.parse(messages[0]);
          userMessage = firstMessage.message;
        } catch {
          // parsing fallido — usar mensaje genérico
        }
        throw new Error(userMessage);
      }

      // Error HTTP genérico (4xx / 5xx sin body Frappe)
      throw new Error(
        err.exc_type || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }
}

export default FrappeBase;
