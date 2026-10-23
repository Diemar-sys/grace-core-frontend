// Cuenta regresiva del aviso de mantenimiento junto al reloj de la barra (22-oct, Diemar:
// «al lado de la fecha y hora, del lado izquierdo»). Sale durante el aviso; en 0 se va y
// el modal de «en mantenimiento» (AvisoMantenimiento) tapa la pantalla.
import { useContext } from 'react';
import { Timer } from 'lucide-react';
import { MantenimientoContext, useAhoraCadaSegundo } from '../hooks/useAvisoMantenimiento';
import { cuentaRegresiva } from '../utils/mantenimiento';
import '../styles/AvisoMantenimiento.css';

export default function PildoraMantenimiento() {
  const estado = useContext(MantenimientoContext);
  const ahora = useAhoraCadaSegundo(estado.tipo === 'aviso');
  if (estado.tipo !== 'aviso' || estado.hasta - ahora <= 0) return null;
  const cuenta = cuentaRegresiva(estado.hasta - ahora);
  return (
    <div className="mant-pildora" role="status" aria-label={`Mantenimiento en ${cuenta}`}>
      <Timer size={18} aria-hidden="true" />
      <span className="mant-pildora__texto">Mantenimiento en</span>
      <span className="mant-pildora__cuenta">{cuenta}</span>
    </div>
  );
}
