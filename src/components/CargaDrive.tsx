// src/components/CargaDrive.tsx
// Tarjeta de Pedido: carga automática de la hoja de HOY desde Drive (switch del
// Gerente) y el botón «Traer de Drive y mandar». Toda la regla vive en el
// servidor (pedido_drive.py): aquí solo se pinta y se aprieta.
import { useEffect, useState } from 'react';
import { pedidoService, type EstadoDrive } from '../services/frappePedido';

interface Props {
  /** Se cargó el pedido de hoy: la pantalla vuelve a preguntar si hay guardado. */
  onCargado: () => void;
}

export default function CargaDrive({ onCargado }: Props) {
  const [estado, setEstado] = useState<EstadoDrive | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    pedidoService.estadoDrive().then(setEstado).catch(() => setEstado(null));
  }, []);

  if (!estado?.configurado) return null;   // sin carpeta en el servidor no hay nada que ofrecer

  const correr = async (accion: () => Promise<string>) => {
    setOcupado(true);
    setAviso('');
    setError('');
    try {
      setAviso(await accion());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  };

  const traer = () => correr(async () => {
    const r = await pedidoService.traerDeDrive();
    onCargado();
    const envio = r.telegram_fallo.length ? ` · ⚠️ NO salió a: ${r.telegram_fallo.join(', ')}` : ' y mandado';
    const problemas = r.problemas ? ` · ⚠️ ${r.problemas} renglón(es) con problema` : '';
    return `Cargado «${r.archivo}» (${r.renglones} renglones)${envio}${problemas}`;
  });

  const cambiar = () => correr(async () => {
    const nuevo = await pedidoService.cambiarDrive(!estado.activo);
    setEstado(nuevo);
    return nuevo.activo ? 'Carga automática encendida' : 'Carga automática apagada';
  });

  return (
    <div className="ped-card">
      <div className="ped-card-head">
        <h3>Desde Drive</h3>
        <span className={`ped-badge ${estado.activo ? 'ok' : 'warn'}`}>
          Automático {estado.activo ? 'encendido' : 'apagado'}
        </span>
      </div>

      <div className="ped-acciones">
        <button className="ped-btn primario" disabled={ocupado} onClick={traer}>
          {ocupado ? 'Trabajando…' : 'Traer de Drive y mandar'}
        </button>
        {estado.puede_cambiar && (
          <button className="ped-btn secundario" disabled={ocupado} onClick={cambiar}>
            {estado.activo ? 'Apagar automático' : 'Encender automático'}
          </button>
        )}
        {aviso && <span className="ped-badge ok">{aviso}</span>}
        {error && <span className="ped-badge bad">{error}</span>}
      </div>

      <p className="ped-nota">
        {estado.activo
          ? <>De <strong>5:30 a 7:00</strong> el sistema busca la hoja con la FECHA de hoy y la carga
            sola cuando lleva <strong>15 min sin cambios</strong>. A las <strong>7:00</strong> la carga
            como esté; si salió a medias: quitar el pedido guardado y «Traer de Drive» otra vez.</>
          : <>Apagado: el pedido se sube a mano o con el botón.</>}
      </p>
      {estado.cambio_por && (
        <p className="ped-nota">Último cambio: {estado.cambio_por} · {estado.cambio_cuando}</p>
      )}
    </div>
  );
}
