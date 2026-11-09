// src/components/CargaDrive.tsx
// Tarjeta de Pedido: la carga AUTOMÁTICA de la hoja de hoy desde Drive (switch del
// Gerente). El botón «Traer de Drive» vive en Pedido. Toda la regla vive en el
// servidor (pedido_drive.py): aquí solo se pinta y se aprieta.
import { useEffect, useState } from 'react';
import { pedidoService, type EstadoDrive } from '../services/frappePedido';

export default function CargaDrive() {
  const [estado, setEstado] = useState<EstadoDrive | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    pedidoService.estadoDrive().then(setEstado).catch(() => setEstado(null));
  }, []);

  if (!estado?.configurado) return null;   // sin carpeta en el servidor no hay nada que ofrecer

  const cambiar = async () => {
    setOcupado(true);
    setError('');
    try {
      setEstado(await pedidoService.cambiarDrive(!estado.activo));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="ped-card">
      <div className="ped-card-head">
        <h3>Carga automática</h3>
        <span className={`ped-badge ${estado.activo ? 'ok' : 'warn'}`}>
          Automático {estado.activo ? 'encendido' : 'apagado'}
        </span>
      </div>

      {(estado.puede_cambiar || error) && (
        <div className="ped-acciones">
          {estado.puede_cambiar && (
            <button className="ped-btn secundario" disabled={ocupado} onClick={cambiar}>
              {estado.activo ? 'Apagar automático' : 'Encender automático'}
            </button>
          )}
          {error && <span className="ped-badge bad">{error}</span>}
        </div>
      )}

      <p className="ped-nota">
        {estado.activo
          ? <>De <strong>5:30 a 7:00</strong> el sistema busca la hoja con la FECHA de hoy y la carga
            y manda sola cuando lleva <strong>15 min sin cambios</strong>. A las <strong>7:00</strong> la
            carga como esté; si salió a medias: quitar el pedido guardado y «Traer de Drive» otra vez.</>
          : <>Apagado: el pedido se carga con «Traer de Drive».</>}
      </p>
      {estado.cambio_por && (
        <p className="ped-nota">Último cambio: {estado.cambio_por} · {estado.cambio_cuando}</p>
      )}
    </div>
  );
}
