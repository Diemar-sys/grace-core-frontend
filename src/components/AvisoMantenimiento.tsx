// Aviso de mantenimiento para TODAS las pantallas (22-oct). Lo prende Diemar con
// `mantenimiento.sh aviso` (5 min antes) y sigue mientras dura el candado.
// El AVISO se puede cerrar A PROPÓSITO: un modal que no se quita no deja guardar,
// que es justo lo que se le pide a la gente. Cerrado, la cuenta sigue en la píldora
// junto al reloj de la barra (`PildoraMantenimiento`).
// Ya EN mantenimiento NO se cierra (Diemar, 22-oct: «no se debe poder acceder»):
// tapa la pantalla sin recargarla, así lo tecleado sigue debajo en memoria, y se
// quita solo cuando la torre deja de contestar 503.
import { useState } from 'react';
import { useAhoraCadaSegundo, type EstadoMantenimiento } from '../hooks/useAvisoMantenimiento';
import { cuentaRegresiva } from '../utils/mantenimiento';
import { textoReloj } from '../utils/reloj';
import '../styles/AvisoMantenimiento.css';

export default function AvisoMantenimiento({ estado }: { estado: EstadoMantenimiento }) {
  // Lo cerrado se recuerda por aviso: uno nuevo, o pasar a «activo», vuelve a abrir el modal.
  const [cerrado, setCerrado] = useState<string | null>(null);

  const ahora = useAhoraCadaSegundo(estado.tipo === 'aviso');

  if (estado.tipo === 'nada') return null;

  const falta = estado.tipo === 'aviso' ? estado.hasta - ahora : 0;
  // En 0 la pantalla pasa SOLA a «en mantenimiento»: mantenimiento.sh prende el
  // candado en ese mismo segundo y no se espera la siguiente pregunta (≤30 s).
  // Si Diemar canceló, esa pregunta trae «nada» y el aviso se quita.
  const tipo = estado.tipo === 'aviso' && falta <= 0 ? 'activo' : estado.tipo;
  const clave = estado.tipo === 'aviso' ? `aviso-${estado.inicio}` : null;

  const titulo = tipo === 'aviso' ? `Mantenimiento en ${cuentaRegresiva(falta)}` : 'Sistema en mantenimiento';
  const texto = estado.tipo === 'aviso' && tipo === 'aviso'
    ? `A las ${textoReloj(new Date(estado.hasta)).hora} el sistema se apaga unos minutos para actualizarlo. Guarda ahora lo que estés capturando.`
    : 'No recargues ni cierres esta pestaña: lo que tecleaste sigue aquí. Cuando el sistema regrese este aviso se quita solo y puedes volver a darle Guardar.';

  if (tipo === 'aviso' && cerrado === clave) return null;
  return (
    <div className="aviso-mant" role="alertdialog" aria-modal="true" aria-labelledby="aviso-mant-titulo">
      <div className="aviso-mant__tarjeta">
        <span className={`aviso-mant__insignia aviso-mant__insignia--${tipo}`}>
          {tipo === 'aviso' ? 'Aviso' : 'En mantenimiento'}
        </span>
        <h2 id="aviso-mant-titulo">{titulo}</h2>
        <p>{texto}</p>
        {tipo === 'aviso' && (
          <button type="button" className="aviso-mant__btn" onClick={() => setCerrado(clave)} autoFocus>
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}
