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
    if (!response.ok) {
      if (response.status === 0) return null;
      const err = await response.json().catch(() => ({}));
      throw new Error(
        err._server_messages
          ? JSON.parse(JSON.parse(err._server_messages)[0]).message
          : err.message || `Error ${response.status}`
      );
    }
    return response.json();
  }
}

export default FrappeBase;
