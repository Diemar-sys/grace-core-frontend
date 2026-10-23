// src/components/Reloj.tsx
// Reloj de la barra de arriba (08-oct). Vive en Layout y en Panel (Panel no pasa por Layout).
// 22-oct: a su izquierda, la cuenta del aviso de mantenimiento (aquí y no en los dos lados).
import { useEffect, useState } from 'react';
import { textoReloj } from '../utils/reloj';
import PildoraMantenimiento from './PildoraMantenimiento';

export default function Reloj() {
  const [texto, setTexto] = useState(() => textoReloj());

  useEffect(() => {
    // Sin segundos: despierta UNA vez por minuto, justo al cambiar (México no tiene
    // husos de medio minuto, así que el minuto de Date.now() es el minuto local).
    let id: ReturnType<typeof setTimeout>;
    const alSiguienteMinuto = () => 60_000 - (Date.now() % 60_000);
    const tic = () => {
      setTexto(textoReloj());
      id = setTimeout(tic, alSiguienteMinuto());
    };
    id = setTimeout(tic, alSiguienteMinuto());
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <PildoraMantenimiento />
      <div className="panel-reloj" aria-label="Fecha y hora">
        <span className="panel-reloj__fecha">{texto.fecha}</span>
        <span className="panel-reloj__hora">{texto.hora}</span>
      </div>
    </>
  );
}
