/**
 * security.js
 * ─────────────────────────────────────────────────────────────
 * Utilidades de seguridad para el frontend de Panaderías Grace.
 *
 * Contiene:
 *  1. Rate Limiter de Login  → bloquea intentos de fuerza bruta en el navegador.
 *  2. Sanitizador de inputs  → elimina caracteres de inyección XSS / SQL.
 *  3. Validadores de campos  → chequeos básicos de formato antes del fetch.
 * ─────────────────────────────────────────────────────────────
 */

// ─── 1. RATE LIMITER ────────────────────────────────────────────────────────
/**
 * Controla cuántos intentos de login consecutivos puede hacer un usuario
 * desde el mismo navegador antes de ser bloqueado temporalmente.
 *
 * Por qué aquí:
 *   - Frappe tiene rate limiting en el servidor, pero un atacante puede
 *     abrir sesiones distintas. Este límite actúa en el cliente como
 *     primera línea de defensa y mejora la experiencia del usuario
 *     mostrando mensajes claros antes de llegar al servidor.
 *
 * Funcionamiento:
 *   - Guarda en sessionStorage el número de intentos y el timestamp del bloqueo.
 *   - Si se superan MAX_INTENTOS, bloquea durante BLOQUEO_MS milisegundos.
 *   - Se reinicia automáticamente al expirar el tiempo de bloqueo.
 */
const MAX_INTENTOS   = 5;           // intentos antes de bloqueo
const BLOQUEO_MS     = 5 * 60 * 1000;  // 5 minutos en milisegundos
const STORAGE_KEY    = 'grace_login_attempts';

export const rateLimiter = {
  /**
   * Verifica si el usuario puede intentar un nuevo login.
   * @returns {{ permitido: boolean, segundosRestantes: number, intentos: number }}
   */
  verificar() {
    const datos = this._leer();

    // Si hay un bloqueo activo, calcular tiempo restante
    if (datos.bloqueadoHasta) {
      const restante = datos.bloqueadoHasta - Date.now();
      if (restante > 0) {
        return {
          permitido: false,
          segundosRestantes: Math.ceil(restante / 1000),
          intentos: datos.intentos,
        };
      }
      // El bloqueo expiró → reiniciar
      this._reiniciar();
    }

    return { permitido: true, segundosRestantes: 0, intentos: datos.intentos };
  },

  /**
   * Registra un intento fallido y bloquea si se alcanzó el límite.
   * @returns {{ bloqueado: boolean, intentosRestantes: number }}
   */
  registrarFallo() {
    const datos = this._leer();
    datos.intentos += 1;

    if (datos.intentos >= MAX_INTENTOS) {
      datos.bloqueadoHasta = Date.now() + BLOQUEO_MS;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
      return { bloqueado: true, intentosRestantes: 0 };
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
    return { bloqueado: false, intentosRestantes: MAX_INTENTOS - datos.intentos };
  },

  /** Limpia el contador tras un login exitoso. */
  reiniciarExito() {
    this._reiniciar();
  },

  _leer() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || { intentos: 0, bloqueadoHasta: null };
    } catch {
      return { intentos: 0, bloqueadoHasta: null };
    }
  },

  _reiniciar() {
    sessionStorage.removeItem(STORAGE_KEY);
  },
};


// ─── 2. SANITIZADOR DE INPUTS ────────────────────────────────────────────────
/**
 * Elimina caracteres y patrones que se usan en ataques de:
 *   - XSS  (inyección de etiquetas HTML / JavaScript)
 *   - SQLi (inyección de comandos SQL directos)
 *
 * Por qué aquí:
 *   - React escapa automáticamente el JSX normal, pero los datos
 *     también se mandan a ERPNext por la API. Limpiarlos antes del
 *     fetch evita que lleguen al backend con contenido malicioso,
 *     independientemente de lo que haga el servidor.
 *
 * @param {string} valor - El texto ingresado por el usuario.
 * @returns {string}     - El texto limpio.
 */
export function sanitizar(valor) {
  if (typeof valor !== 'string') return valor;

  return valor
    // Elimina etiquetas HTML / scripts (<script>, <img onerror=...>, etc.)
    .replace(/<[^>]*>?/gm, '')
    // Elimina comillas simples encadenadas a palabras SQL peligrosas
    .replace(/('|--|;|\/\*|\*\/|xp_|UNION\s|SELECT\s|DROP\s|INSERT\s|DELETE\s|UPDATE\s)/gi, '')
    // Elimina null bytes (usados para bypassear filtros)
    .replace(/\0/g, '')
    .trim();
}

/**
 * Sanitiza todos los campos string de un objeto de formulario de una vez.
 * Útil para limpiar formData completo antes de mandarlo a la API.
 *
 * @param {Object} obj - Objeto con los campos del formulario.
 * @returns {Object}   - Copia del objeto con todos los strings sanitizados.
 */
export function sanitizarObjeto(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? sanitizar(v) : v])
  );
}


// ─── 3. VALIDADORES DE CAMPOS ────────────────────────────────────────────────
/**
 * Valida formatos básicos de los campos más comunes en los formularios.
 * Se usan antes de enviar datos para detectar entradas anómalas o
 * demasiado largas (que podrían ser intentos de buffer overflow o fuzzing).
 *
 * Por qué aquí:
 *   - La validación de longitud máxima evita que alguien pegue miles de
 *     caracteres para saturar la red o el backend.
 *   - La validación de formato (correo, números) asegura que los datos
 *     tienen sentido antes de gastar un request de red.
 */
export const validar = {
  /** Correo electrónico válido y longitud razonable */
  correo: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 120,

  /** Teléfono: solo dígitos, espacios, guiones y paréntesis. Min 7, Max 15 dígitos */
  telefono: (v) => typeof v === 'string' && /^[\d\s\-\(\)]{7,20}$/.test(v),

  /** Texto general: no vacío, máximo 200 caracteres */
  texto: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200,

  /** Número positivo (precio, cantidad) */
  numero: (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,

  /** Nombre de usuario: alfanumérico, puntos y arroba. Sin espacios raros. */
  usuario: (v) => typeof v === 'string' && /^[\w.\-@]{3,80}$/.test(v),
};
