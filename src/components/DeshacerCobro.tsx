// 09-nov (Diemar): «Deshacer cobro» — antes era script (DELI, P.REAL, ZAKIA). SOLO Administrator
// (el servidor decide `puede_deshacer` y vuelve a revisar). Cancela el cobro COMPLETO: todas sus
// facturas regresan a deber y Eva lo vuelve a registrar bien. Candados en hoja_api.deshacer_cobro.
import { useEffect, useState } from 'react';
import { hojaService, type CobroDeFactura } from '../services/frappeHoja';
import { pesos } from '../utils/formato';

const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

export default function DeshacerCobro({ factura, onListo, onCerrar }: { factura: string; onListo: () => void; onCerrar: () => void }) {
  const [cobros, setCobros] = useState<CobroDeFactura[] | null>(null);
  const [elegido, setElegido] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    hojaService.cobrosDeFactura(factura)
      .then(c => { setCobros(c); setElegido(c[0]?.cobro ?? ''); })
      .catch((e: any) => setError(e?.message || 'No se pudieron leer los cobros'));
  }, [factura]);

  const cobro = cobros?.find(c => c.cobro === elegido);
  const bloqueo = cobro && (cobro.facturas.some(f => f.liquidado) ? 'Luis ya registró LIQUIDADO de alguna de estas facturas: quítalo primero.'
    : cobro.egresos.length ? `Con este cobro se pagaron ${cobro.egresos.join(', ')}: quítalos primero.` : '');

  const deshacer = async () => {
    if (!cobro) return;
    if (motivo.trim().length < 5) { setError('Escribe por qué se deshace.'); return; }
    setOcupado(true); setError('');
    try { await hojaService.deshacerCobro(cobro.cobro, motivo); onListo(); }
    catch (e: any) { setError(e?.message || 'No se deshizo el cobro'); }
    finally { setOcupado(false); }
  };

  // Modal propio con las clases de ConfirmModal: ese esconde los botones cuando hay error (aquí
  // un motivo corto se corrige y se reintenta) y mete la descripción en un <p> (aquí va una lista).
  return (
    <div className="edit-overlay" onClick={e => e.target === e.currentTarget && !ocupado && onCerrar()}>
      <div className="del-modal hoja-deshacer" role="dialog" aria-label="Deshacer cobro">
        <h3>Deshacer cobro</h3>
        {!cobros ? <p>Cargando…</p> : !cobro ? <p>Esta factura no tiene cobros vivos.</p> : (<>
          {cobros.length > 1 && (
            <select aria-label="Cobro" value={elegido} onChange={e => setElegido(e.target.value)}>
              {cobros.map(c => <option key={c.cobro} value={c.cobro}>{c.cobro} · {pesos(c.monto)}</option>)}
            </select>
          )}
          <p>
            Se cancela <strong>{cobro.cobro}</strong> ({pesos(cobro.monto)}, {fechaCorta(cobro.fecha)}, registró {cobro.registro.split('@')[0]}).
            Estos días vuelven a deber:
          </p>
          <ul>
            {cobro.facturas.map(f => (
              <li key={f.factura}>{fechaCorta(f.fecha)} · {f.destino} · {f.factura} · {pesos(f.monto)}{f.liquidado && ' · LIQUIDADO'}</li>
            ))}
          </ul>
          {bloqueo ? <p className="hoja-deshacer__bloqueo" role="alert">{bloqueo}</p> : (
            <label>Motivo (queda escrito en el cobro)
              <input type="text" maxLength={280} value={motivo} disabled={ocupado} placeholder="p. ej. ZAKIA no pagó el 01-nov"
                onChange={e => { setMotivo(e.target.value); setError(''); }} />
            </label>
          )}
        </>)}
        {error && <div className="del-modal-error" role="alert"><p>{error}</p></div>}
        <div className="del-modal-actions">
          <button type="button" className="del-btn-cancel" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          <button type="button" className="del-btn-confirm" onClick={deshacer} disabled={ocupado || !cobro || Boolean(bloqueo)}>
            {ocupado ? 'Deshaciendo…' : 'Deshacer cobro'}
          </button>
        </div>
      </div>
    </div>
  );
}
