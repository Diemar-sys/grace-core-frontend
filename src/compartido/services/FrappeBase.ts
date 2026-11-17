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

  /** La cabecera va solo si HAY token, igual que el SDK oficial
   *  (`frappe-react-sdk` la omite cuando `window.csrf_token` está vacío).
   *
   *  Antes se mandaba `'fetch'` como relleno. Era inofensivo pero mentía: aquí
   *  el index.html lo sirve Caddy, no Frappe, así que `window.csrf_token` nunca
   *  se inyecta, y en prod NINGUNA sesión trae `csrf_token` (son sesiones de
   *  API por `sid`, no de escritorio) — Frappe sale temprano de su validación y
   *  la cabecera se ignoraba. Mandar un valor falso donde no hace falta esconde
   *  la pregunta de si el token existe.
   *
   *  No lleva `as any`: `csrf_token?: string` ya está declarado en el Window de
   *  `vite-env.d.ts`, que es la forma correcta de tipar un global. */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (window.csrf_token) {
      headers['X-Frappe-CSRF-Token'] = window.csrf_token;
    }
    return headers;
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

      // El status viaja en el Error: quien atrape (p.ej. el drain del outbox)
      // necesita distinguir un 5xx transitorio (deploy, nginx reiniciando) de
      // un 4xx de datos malos. Sin esto son indistinguibles y una venta buena
      // se marcaba "error" permanente por un 502 de dos minutos.
      const throwWithStatus = (msg: string): never => {
        const e = new Error(msg) as Error & { status?: number };
        e.status = response.status;
        throw e;
      };

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
        throwWithStatus(userMessage);
      }

      // Error HTTP genérico (4xx / 5xx sin body Frappe)
      throwWithStatus(
        err.exc_type || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }
}

export default FrappeBase;
