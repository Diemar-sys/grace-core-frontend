// Aviso que BLOQUEA la pantalla cuando la sesión cambió en otra pestaña (23-sep).
// No se cierra con Escape ni con clic afuera: la única salida es recargar, para
// que nadie siga capturando con una sesión que ya no es la suya.
import type { CambioSesion } from '../hooks/useSesionCompartida';
import '../styles/AvisoSesion.css';

export default function AvisoSesion({ cambio, recargar = () => window.location.reload() }:
  { cambio: CambioSesion | null; recargar?: () => void }) {
  if (!cambio) return null;
  const salio = cambio.tipo === 'salio';
  return (
    <div className="aviso-sesion" role="alertdialog" aria-modal="true" aria-labelledby="aviso-sesion-titulo">
      <div className="aviso-sesion__tarjeta">
        <h2 id="aviso-sesion-titulo">{salio ? 'Se cerró la sesión' : 'Cambió el usuario'}</h2>
        <p>
          {salio
            ? 'Cerraste sesión en otra pestaña. Para seguir, vuelve a entrar.'
            : `En otra pestaña entró ${cambio.correo}. Esta pestaña ya no es tu sesión: recarga para seguir como ese usuario.`}
        </p>
        <button type="button" className="aviso-sesion__btn" onClick={recargar} autoFocus>
          {salio ? 'Iniciar sesión' : 'Recargar'}
        </button>
      </div>
    </div>
  );
}
