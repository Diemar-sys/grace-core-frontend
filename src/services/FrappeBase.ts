/**
 * FrappeBase
 * Clase base para todos los servicios de ERPNext.
 * Centraliza headers, CSRF token y parsing de errores Frappe.
 */
class FrappeBase {
  baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': window.csrf_token || 'fetch',
    };
  }

  // Respuestas Frappe heterogéneas → any deliberado; cada servicio tipa su superficie.
  async _fetch(path: string, options: RequestInit = {}): Promise<any> {
    const fetchOptions: RequestInit = {
      credentials: 'include',
      headers: this.getHeaders(),
      cache: 'no-store',
      ...options,
    };
    // Sin conexión — retornar null de forma controlada
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, fetchOptions);
    } catch (e) {
      if (e instanceof TypeError) return null; // network error (offline, CORS, DNS, etc.)
      throw e; // rethrow other errors
    }

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
