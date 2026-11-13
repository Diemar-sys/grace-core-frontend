// 13-nov (Diemar; el modelo del 12-nov estaba mal): entrega de un pueblo (MILA, LAGUNI, VEGIL) de UN día.
// Se teclea el EFECTIVO que regresó y, si de ahí pagó algo (agua, luz, sueldo…), en qué. La DIFERENCIA es
// efectivo − pan y los gastos no la mueven; lo ENTREGADO es efectivo − gastos. El servidor registra un
// cobro por todo el efectivo y cada gasto como egreso pagado con ese cobro (hoja_api.registrar_entrega).
// Lo que regrese de más se queda en SU día: ya no se abona a otros. Aquí solo se suma para enseñarlo.
import { useState } from 'react';
import { hojaService } from '../../services/frappeHoja';
import { CONCEPTOS_ENTREGA, claseDiferencia, conSigno, resumenEntrega, type ConceptoEntrega, type TecleoEntrega } from '../../utils/entregaPueblo';
import { pesos } from '../../utils/formato';

const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');
const ETIQUETA: Record<ConceptoEntrega, string> = { AGUA: 'Agua', LUZ: 'Luz', RENTA: 'Renta', SUELDO: 'Sueldo', 'PÉRDIDA': 'Pérdida', OTRO: 'Otro' };

interface Props { destino: string; fecha: string; factura: string; debe: number; onListo: () => void; onCerrar: () => void }

export default function ModalEntregaPueblo({ destino, fecha, factura, debe, onListo, onCerrar }: Props) {
  const [tecleo, setTecleo] = useState<TecleoEntrega>({ efectivo: '', montos: {}, nota: '' });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const r = resumenEntrega(debe, tecleo);
  const vacio = tecleo.efectivo.trim() === '' && Object.values(tecleo.montos).every(m => !m?.trim());

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
        <p>Pan de este día: <strong>{pesos(debe)}</strong>. Escribe el efectivo que regresó y, si de ahí pagó algo, en qué.</p>
        <label>Efectivo que regresó
          <input type="number" min={0} step="0.01" inputMode="decimal" autoFocus value={tecleo.efectivo} disabled={ocupado}
            onChange={e => { setTecleo(t => ({ ...t, efectivo: e.target.value })); setError(''); }} />
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
            DIFERENCIA <span className={claseDiferencia(r.diferencia)}>{conSigno(r.diferencia)}</span>
            {' '}· gastos {pesos(r.gastosTotal)} · <strong>ENTREGADO {pesos(r.entregado)}</strong>
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
