// Aviso de mantenimiento para TODAS las pantallas (22-oct). Lo prende Diemar con
// `mantenimiento.sh aviso` (5 min antes) y sigue mientras dura el candado.
// Se puede cerrar A PROPÓSITO: un modal que no se quita no deja guardar, que es
// justo lo que se le pide a la gente. Cerrado, queda una franja arriba.
import { useEffect, useState } from 'react';
import type { EstadoMantenimiento } from '../hooks/useAvisoMantenimiento';
import { cuentaRegresiva } from '../utils/mantenimiento';
import { textoReloj } from '../utils/reloj';
import '../styles/AvisoMantenimiento.css';

export default function AvisoMantenimiento({ estado }: { estado: EstadoMantenimiento }) {
  const [ahora, setAhora] = useState(() => Date.now());
  // Lo cerrado se recuerda por aviso: uno nuevo, o pasar a «activo», vuelve a abrir el modal.
  const [cerrado, setCerrado] = useState<string | null>(null);

  const enAviso = estado.tipo === 'aviso';
  useEffect(() => {
    if (!enAviso) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enAviso]);

  if (estado.tipo === 'nada') return null;

  const clave = estado.tipo === 'aviso' ? `aviso-${estado.inicio}` : 'activo';
  const falta = estado.tipo === 'aviso' ? estado.hasta - ahora : 0;
  const cuando = falta > 0 ? `en ${cuentaRegresiva(falta)}` : 'en cualquier momento';

  const titulo = estado.tipo === 'aviso' ? `Mantenimiento ${cuando}` : 'Sistema en mantenimiento';
  const texto = estado.tipo === 'aviso'
    ? `A las ${textoReloj(new Date(estado.hasta)).hora} el sistema se apaga unos minutos para actualizarlo. Guarda ahora lo que estés capturando.`
    : 'No recargues ni cierres esta pestaña: lo que tecleaste sigue aquí. Cuando el sistema regrese este aviso se quita solo y puedes volver a darle Guardar.';
  const franja = estado.tipo === 'aviso'
    ? `Mantenimiento ${cuando} · guarda lo que estés capturando`
    : 'Sistema en mantenimiento · no recargues esta pestaña';

  if (cerrado === clave) {
    return <div className={`aviso-mant__franja aviso-mant__franja--${estado.tipo}`} role="status">{franja}</div>;
  }
  return (
    <div className="aviso-mant" role="alertdialog" aria-modal="true" aria-labelledby="aviso-mant-titulo">
      <div className="aviso-mant__tarjeta">
        <span className={`aviso-mant__insignia aviso-mant__insignia--${estado.tipo}`}>
          {estado.tipo === 'aviso' ? 'Aviso' : 'En mantenimiento'}
        </span>
        <h2 id="aviso-mant-titulo">{titulo}</h2>
        <p>{texto}</p>
        <button type="button" className="aviso-mant__btn" onClick={() => setCerrado(clave)} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  );
}
