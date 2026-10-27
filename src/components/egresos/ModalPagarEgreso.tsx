// src/components/egresos/ModalPagarEgreso.tsx
// 27-oct: «Por pagar» → ¿con qué se pagó? Pago normal, o con el efectivo de un cobro de la hoja
// (Eva paga la pipa con lo que recibió de GUSTAVO). El disponible y el candado son del servidor:
// aquí solo se enseña y se apaga el cobro que no alcanza.
import { useEffect, useState } from 'react';
import { egresosService, type CobroParaEgreso } from '../../services/frappeEgresos';
import { pesos } from '../../utils/formato';
import { fechaCorta } from '../../utils/hora';
import type { EgresoItem } from './EgresosTabla';

interface Props {
  egreso: EgresoItem;
  onPagar: (cobro: string | null) => Promise<void>;
  onCerrar: () => void;
}

export default function ModalPagarEgreso({ egreso, onPagar, onCerrar }: Props) {
  const [cobros, setCobros] = useState<CobroParaEgreso[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const monto = Number(egreso.monto) || 0;

  useEffect(() => {
    egresosService.cobrosParaEgreso()
      .then(setCobros)
      .catch(e => { setCobros([]); setError(e?.message || 'No se pudieron leer los cobros'); });
  }, []);

  const pagar = async (cobro: string | null) => {
    setOcupado(true); setError('');
    try { await onPagar(cobro); }
    catch (e) { setError((e as Error)?.message || 'No se pudo marcar pagado'); setOcupado(false); }
  };

  return (
    <div className="egresos-modal" onMouseDown={e => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
      <div className="egresos-modal-card egresos-modal-card--chico" role="dialog" aria-label="¿Con qué se pagó?">
        <div className="egresos-modal-header">
          <h3>¿Con qué se pagó?</h3>
          <button className="egresos-modal-close" onClick={onCerrar} disabled={ocupado} title="Cerrar">✕</button>
        </div>
        <div className="egresos-modal-body">
          <p className="egresos-pagar__egreso">
            {egreso.name} · {egreso.subcategoria || egreso.concepto} · <strong>{pesos(monto)}</strong>
          </p>
          {error && <div className="egresos-error-bar"><span>⚠ {error}</span></div>}

          <button className="egresos-pagar__normal" disabled={ocupado} onClick={() => pagar(null)}>
            Pago normal
          </button>

          <h4 className="egresos-pagar__titulo">Con el efectivo de un cobro</h4>
          {cobros === null && <p className="text-muted">Cargando cobros…</p>}
          {cobros?.length === 0 && <p className="text-muted">No hay cobros con efectivo en los últimos días.</p>}
          <div className="egresos-pagar__cobros">
            {cobros?.map(c => {
              const alcanza = c.disponible >= monto;
              return (
                <label key={c.cobro}
                  className={'egresos-pagar__cobro' + (elegido === c.cobro ? ' egresos-pagar__cobro--elegido' : '')
                    + (alcanza ? '' : ' egresos-pagar__cobro--no-alcanza')}>
                  <input type="radio" name="cobro" value={c.cobro} disabled={!alcanza || ocupado}
                    checked={elegido === c.cobro} onChange={() => setElegido(c.cobro)} />
                  <span>
                    <strong>{c.cliente}</strong> · {c.cobro} · {fechaCorta(c.fecha)}
                    <small>recibido {pesos(c.recibido)} · {c.facturas.length} día{c.facturas.length === 1 ? '' : 's'}</small>
                  </span>
                  <span className="egresos-pagar__disp">
                    {alcanza ? `quedan ${pesos(c.disponible)}` : `solo quedan ${pesos(c.disponible)}`}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="egresos-pagar__pie">
          <button className="egresos-pagar__cancelar" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          <button className="egresos-pagar__confirmar" disabled={!elegido || ocupado} onClick={() => pagar(elegido)}>
            Pagar con este cobro
          </button>
        </div>
      </div>
    </div>
  );
}
