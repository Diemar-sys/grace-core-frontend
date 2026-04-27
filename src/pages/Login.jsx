import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/frappeAuth';
import { rateLimiter, sanitizar, validar } from '../utils/security';
import { getRoleConfig } from '../config/roles';
import { TENANT } from '../config/tenant';
import '../styles/Login.css';

/**
 * Componente de la página de Login.
 * Maneja la autenticación del usuario mediante el servicio FrappeAuth.
 * @returns {JSX.Element} Vista de inicio de sesión.
 */
function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [bloqueadoSegundos, setBloqueadoSegundos] = useState(0);
  const [formData, setFormData] = useState({
    usuario: '',
    contrasena: '',
  });

  // ── Cuenta regresiva del bloqueo ─────────────────────────────────────────
  // Por qué: Muestra al empleado cuánto tiempo falta para volver a intentar,
  // en lugar de un mensaje estático poco claro.
  useEffect(() => {
    if (bloqueadoSegundos <= 0) return;
    const id = setInterval(() => {
      setBloqueadoSegundos(s => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [bloqueadoSegundos]);

  /**
   * Maneja el envío del formulario de inicio de sesión.
   * Valida credenciales contra ERPNext y redirige al Panel en caso exitoso.
   * @param {React.FormEvent} e - Evento del formulario.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── Verificar rate limit ANTES de mandar la petición ─────────────────
    // Por qué: Evitamos golpear el servidor si el usuario ya superó el límite.
    const limite = rateLimiter.verificar();
    if (!limite.permitido) {
      setBloqueadoSegundos(limite.segundosRestantes);
      setError(`Demasiados intentos. Espera ${limite.segundosRestantes} segundos.`);
      return;
    }

    // ── Sanitizar inputs antes del fetch ──────────────────────────────────
    // Por qué: Aunque Frappe valida en el backend, limpiar aquí evita
    // enviar basura a la red y previene XSS si el error se muestra en el DOM.
    const usuarioLimpio = sanitizar(formData.usuario);
    const contraLimpia  = sanitizar(formData.contrasena);

    // ── Validar formato básico ────────────────────────────────────────────
    // Por qué: Bloquea entradas absurdamente largas o con caracteres extraños
    // que podrían ser intentos de fuzzing antes de llegar al servidor.
    if (!validar.usuario(usuarioLimpio)) {
      setError('El usuario contiene caracteres no permitidos.');
      return;
    }
    if (!contraLimpia || contraLimpia.length < 4 || contraLimpia.length > 128) {
      setError('La contraseña no tiene el formato correcto.');
      return;
    }

    setIsLoading(true);
    try {
      await auth.login(usuarioLimpio, contraLimpia);
      rateLimiter.reiniciarExito();
      const user = auth.getUser();
      navigate(getRoleConfig(user?.role).inicio);
    } catch (err) {
      console.error('Error en login:', err);
      // ── Registrar fallo en el rate limiter ───────────────────────────────
      const resultado = rateLimiter.registrarFallo();
      if (resultado.bloqueado) {
        setBloqueadoSegundos(300);  // 5 minutos
        setError('Acceso bloqueado por múltiples intentos fallidos. Intenta en 5 minutos.');
      } else {
        setError(`Usuario o contraseña incorrectos. (${resultado.intentosRestantes} intentos restantes)`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Lado izquierdo - Formulario */}
      <div className="login-form-side">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <div className="login-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                <path d="M2 7h20" />
                <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
              </svg>
            </div>
            <h1 className="login-title">Bienvenido</h1>
            <p className="login-description">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {/* Muestra el error si existe */}
          {error && (
            <div className="error-message" style={{
              background: '#fee2e2',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="login-form">
            {/* Usuario */}
            <div className="form-group">
              <label htmlFor="usuario" className="form-label">
                Usuario
              </label>
              <div className="input-wrapper">
                <svg
                  className="input-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="usuario"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={formData.usuario}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="form-group">
              <label htmlFor="contrasena" className="form-label">
                Contraseña
              </label>
              <div className="input-wrapper">
                <svg
                  className="input-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="contrasena"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  value={formData.contrasena}
                  onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              className="login-button"
              disabled={isLoading || bloqueadoSegundos > 0}
            >
              {bloqueadoSegundos > 0
                ? `Bloqueado (${bloqueadoSegundos}s)`
                : isLoading
                  ? 'Iniciando sesión...'
                  : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Footer */}
          <div className="login-footer">
            <p>
              ¿Olvidaste tu contraseña?{' '}
              <button type="button" className="link-button">
                Recuperar acceso
              </button>
            </p>
            <p className="help-text">
              Si tienes problemas para ingresar, contacta a tu supervisor
            </p>
          </div>
        </div>
      </div>
      {/* Lado derecho - Branding */}
      <div className="login-branding-side">
        <div className="branding-overlay"></div>

        <div className="branding-content">
          {/* Logo Panadería Grace */}
          <div className="brand-logo">
            <img
              src="/logo_GRACE.png"
              alt="Grace Panadería & Repostería"
              className="logo-image"
            />
          </div>

          {/* Textos principales */}
          <div className="brand-text-header">
            <h1 className="brand-title">{TENANT.nombre}</h1>
            <h2 className="brand-subtitle">
              {/*LOGO DE ERPNEXT*/}
              <svg
                version="1.1"
                id="Layer_1"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                x="0px" y="0px"
                width="80px"
                height="80px"
                viewBox="0 0 512 512"
                enableBackground="new 0 0 512 512" xmlSpace="preserve">
                <g>
                  <path fill="#7574FF" d="M512,448c0,35.2-28.8,64-64,64H64c-35.2,0-64-28.8-64-64V64C0,28.8,28.8,0,64,0h384c35.2,0,64,28.8,64,64   V448z" />
                </g>
                <g>
                  <path fill="#FFFFFF" d="M150.483,371.684V141.15c0-15.167,9.534-25.133,23.833-25.133h162.5c13.866,0,20.8,6.933,20.8,18.633v2.6   c0,12.133-6.934,18.633-20.8,18.633h-141.7v78.434h109.634c14.3,0,20.8,6.066,20.8,17.767v1.3c0,12.133-6.934,18.633-20.8,18.633   H195.117v84.934h144.3c13.867,0,20.367,6.066,20.367,17.767v2.167c0,12.566-6.5,19.5-20.367,19.5h-165.1   C160.017,396.384,150.483,386.851,150.483,371.684z" />
                </g>
                <title>ERPNext</title>
              </svg>
              {/*LOGO DEL +*/}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="70"
                height="70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-plus-icon lucide-plus"
                style={{ marginLeft: '20px', verticalAlign: 'center' }}>
                <title>más</title>
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              {/*LOGO DEL React*/}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="80"
                height="80"
                viewBox="-11.5 -10.23174 23 20.46348"
                style={{ marginLeft: '10px' }}>
                <title>React</title>
                <circle cx="0" cy="0" r="2.05" fill="#61dafb" />
                <g stroke="#61dafb" strokeWidth="1" fill="none">
                  <ellipse rx="11" ry="4.2" />
                  <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                  <ellipse rx="11" ry="4.2" transform="rotate(120)" />
                </g>
              </svg>
            </h2>
            <p className="brand-description">
              Gestiona tus sucursales de forma sencilla y eficiente.
            </p>
          </div>

          {/* Features / Características */}
          <div className="brand-features">
            <div className="feature">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
              </div>
              <p className="feature-text">Control de Ventas</p>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m7.5 4.27 9 5.15" />
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              </div>
              <p className="feature-text">Catálogo</p>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" x2="12" y1="20" y2="10" />
                  <line x1="18" x2="18" y1="20" y2="4" />
                  <line x1="6" x2="6" y1="20" y2="16" />
                </svg>
              </div>
              <p className="feature-text">Reportes</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;
