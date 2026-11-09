// 09-nov (Diemar): «¿Olvidaste tu contraseña?». Dos pantallas en una:
//  - /recuperar: teclea usuario o correo → el servidor manda el enlace al correo REAL.
//  - /update-password?key=…: el enlace del correo → contraseña nueva (Frappe valida la llave).
// 🔴 Sin sesión. Las reglas (quién recupera, no enumerar cuentas) viven en recuperar_api.py.
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { auth } from '../services/frappeAuth';
import '../styles/Login.css';

const MIN = 8;
const MAX = 128;

/** Qué le falta a la contraseña nueva, o null si está bien. Pura. */
export function problemaConClave(nueva: string, otraVez: string): string | null {
  if (nueva.length < MIN) return `La contraseña necesita al menos ${MIN} caracteres.`;
  if (nueva.length > MAX) return 'La contraseña es demasiado larga.';
  if (nueva !== otraVez) return 'Las dos contraseñas no coinciden.';
  return null;
}

export default function Recuperar() {
  const navigate = useNavigate();
  const key = new URLSearchParams(useLocation().search).get('key') || '';
  const [usuario, setUsuario] = useState('');
  const [nueva, setNueva] = useState('');
  const [otraVez, setOtraVez] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const pedir = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) return;
    setError(''); setOcupado(true);
    try { setAviso(await auth.pedirRecuperacion(usuario.trim())); }
    catch (err: any) { setError(err?.message || 'No se pudo pedir el enlace.'); }
    finally { setOcupado(false); }
  };

  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = problemaConClave(nueva, otraVez);
    if (problema) { setError(problema); return; }
    setError(''); setOcupado(true);
    try {
      await auth.cambiarConLlave(key, nueva);
      navigate('/login', { replace: true, state: { aviso: 'Listo: entra con tu contraseña nueva.' } });
    } catch (err: any) { setError(err?.message || 'No se pudo cambiar la contraseña.'); }
    finally { setOcupado(false); }
  };

  return (
    <div className="login-container">
      <div className="login-form-side">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">{key ? 'Contraseña nueva' : 'Recuperar acceso'}</h1>
            <p className="login-description">
              {key ? 'Escríbela dos veces. El enlace sirve una sola vez.'
                : 'Escribe tu usuario o tu correo. Te mandamos un enlace para poner una contraseña nueva.'}
            </p>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          {aviso && <div className="login-aviso" role="status">{aviso}</div>}

          {key ? (
            <form onSubmit={cambiar} className="login-form">
              <div className="form-group">
                <label htmlFor="rec-nueva" className="form-label">Contraseña nueva</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input id="rec-nueva" type="password" autoComplete="new-password" className="form-input"
                    value={nueva} onChange={e => setNueva(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="rec-otra" className="form-label">Otra vez</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input id="rec-otra" type="password" autoComplete="new-password" className="form-input"
                    value={otraVez} onChange={e => setOtraVez(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="login-button" disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          ) : !aviso && (
            <form onSubmit={pedir} className="login-form">
              <div className="form-group">
                <label htmlFor="rec-usuario" className="form-label">Usuario o correo</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={16} />
                  <input id="rec-usuario" type="text" autoComplete="username" className="form-input" maxLength={140}
                    value={usuario} onChange={e => setUsuario(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="login-button" disabled={ocupado || !usuario.trim()}>
                {ocupado ? 'Enviando…' : 'Mandar enlace'}
              </button>
            </form>
          )}

          <div className="login-footer">
            <p><Link to="/login" className="link-button">Volver a iniciar sesión</Link></p>
            <p className="help-text">¿No te llega el correo? Pídele a tu supervisor que te cambie la contraseña.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
