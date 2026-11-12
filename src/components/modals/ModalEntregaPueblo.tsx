// 12-nov (Diemar): entrega de un pueblo (MILA, LAGUNI, VEGIL) de UN día. Se teclea lo que entregó en
// efectivo y en qué se fue lo demás (agua, luz, renta, sueldo, pérdida…). El servidor registra un cobro
// por entregó + gastos y cada gasto como egreso pagado con ese cobro (hoja_api.registrar_entrega): el día
// queda en 0 si todo se justificó, o con la diferencia sin justificar. Si entregó de MÁS, el sobrante se
// abona a otros días que deban (del más viejo al más nuevo). Aquí solo se suma para enseñarlo.
import { useState } from 'react';
import { hojaService } from '../../services/frappeHoja';
import { CONCEPTOS_ENTREGA, resumenEntrega, type ConceptoEntrega, type TecleoEntrega } from '../../utils/entregaPueblo';
import { pesos } from '../../utils/formato';

const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');
const ETIQUETA: Record<ConceptoEntrega, string> = { AGUA: 'Agua', LUZ: 'Luz', RENTA: 'Renta', SUELDO: 'Sueldo', 'PÉRDIDA': 'Pérdida', OTRO: 'Otro' };

interface Props { destino: string; fecha: string; factura: string; debe: number; onListo: () => void; onCerrar: () => void }

export default function ModalEntregaPueblo({ destino, fecha, factura, debe, onListo, onCerrar }: Props) {
  const [tecleo, setTecleo] = useState<TecleoEntrega>({ entrego: '', montos: {}, nota: '' });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const r = resumenEntrega(debe, tecleo);
  const vacio = tecleo.entrego.trim() === '' && Object.values(tecleo.montos).every(m => !m?.trim());

  const guardar = async () => {
    if (r.error) { setError(r.error); return; }
    setOcupado(true); setError('');
    try { await hojaService.registrarEntrega(factura, r.efectivo, r.gastos); onListo(); }
    catch (e: any) { setError(e?.message || 'No se guardó la entrega'); }
    finally { setOcupado(false); }
  };

  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && !ocupado && onCerrar()}>
      <div className="del-modal hoja-deshacer" role="dialog" aria-label="Registrar entrega">
        <h3>Entrega de {destino} · {fechaCorta(fecha)}</h3>
        <p>De este día falta <strong>{pesos(debe)}</strong>. Escribe lo que entregó y en qué se fue lo demás.</p>
        <label>Entregó en efectivo
          <input type="number" min={0} step="0.01" inputMode="decimal" autoFocus value={tecleo.entrego} disabled={ocupado}
            onChange={e => { setTecleo(t => ({ ...t, entrego: e.target.value })); setError(''); }} />
        </label>
        {CONCEPTOS_ENTREGA.map(c => (
          <label key={c}>{ETIQUETA[c]}
            <input type="number" min={0} step="0.01" inputMode="decimal" value={tecleo.montos[c] ?? ''} disabled={ocupado}
              onChange={e => { setTecleo(t => ({ ...t, montos: { ...t.montos, [c]: e.target.value } })); setError(''); }} />
          </label>
        ))}
        {Boolean(tecleo.montos.OTRO?.trim()) && (
          <label>¿En qué se fue «Otro»?
            <input type="text" maxLength={140} value={tecleo.nota} disabled={ocupado}
              onChange={e => { setTecleo(t => ({ ...t, nota: e.target.value })); setError(''); }} />
          </label>
        )}
        {!vacio && !r.error && (
          <p role="status">
            Entregó {pesos(r.efectivo)} · gastos {pesos(r.gastosTotal)} ·{' '}
            <span className={`hoja-badge ${r.sinJustificar > 0 ? 'hoja-badge--ambar' : 'hoja-badge--verde'}`}>
              {r.sinJustificar > 0 ? `SIN JUSTIFICAR ${pesos(r.sinJustificar)}` : 'QUEDA EN 0'}
            </span>
            {/* 12-nov: entregó de más → se balancea con otros días; si no hay dónde, el servidor lo dice */}
            {r.sobrante > 0 && (<>{' '}<span className="hoja-badge hoja-badge--azul">SOBRAN {pesos(r.sobrante)}</span>
              {' '}se abonan a los días más viejos que deban.</>)}
          </p>
        )}
        {(error || (!vacio && r.error)) && <div className="del-modal-error" role="alert"><p>{error || r.error}</p></div>}
        <div className="del-modal-actions">
          <button type="button" className="del-btn-cancel" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          <button type="button" className="del-btn-confirm" onClick={guardar} disabled={ocupado || vacio || Boolean(r.error)}>
            {ocupado ? 'Guardando…' : 'Guardar entrega'}
          </button>
        </div>
      </div>
    </div>
  );
}
