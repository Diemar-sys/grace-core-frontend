// src/components/VistaBolillo.tsx
// Vista «Bolillo» de la Hoja del día (08-oct): la pestaña BOLILLO del Excel en el sistema.
// Solo el destino elegido en el selector (Diemar 08-oct): sus tandas (pedido en gris, lo que
// SALIÓ en la casilla) o, si es camioneta, la bolsa común y el TOTAL que se lleva. El ENVIADO de esos 4 panes
// lo calcula el servidor (Σ salió × charola); aquí solo se teclean cantidades.
// Spec: gestion_panaderia/docs/superpowers/specs/2026-10-08-bolillo-tandas-design.md
import { useEffect, useMemo, useRef, useState } from 'react';
import ModalError from './modals/ModalError';
import useBorradorLocal from '../hooks/useBorradorLocal';
import { hojaService, type BolilloDia, type ItemBolillo } from '../services/frappeHoja';
import {
  bolilloDe, cambiosBolillo, claveCamioneta, claveTanda, llevaCamioneta, salioDe, sinDestino, totalesCamionetas, totalesDestino,
  type BorradorBolillo, type TecleadoBolillo, type TotalBolillo,
} from '../utils/bolilloDia';
import { estadoEnviado } from '../utils/hojaDia';
import { numero } from '../utils/formato';

const NOMBRE: Record<string, string> = { '3001': 'BOLILLO', '3002': 'TELERA', '3003': 'MINI', '3004': 'BAGUET' };
const SIN_CAMBIOS = { tandas: [], camionetas: [] };

const colorDe = (pedido: number, salio: number) => {
  const c = estadoEnviado(pedido, salio);
  return c ? ` hoja-input--${c}` : '';
};

function Encabezado({ items, primera }: { items: ItemBolillo[]; primera: string }) {
  return (
    <thead>
      <tr>
        <th>{primera}</th>
        {items.map(it => (
          <th key={it.item_code} className="hoja-celda--num">
            {NOMBRE[it.item_code] ?? it.item_code}<small>{it.unidad === 'charolas' ? ' (ch)' : ' (pz)'}</small>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Totales({ items, totales, etiqueta }: { items: ItemBolillo[]; totales: Record<string, TotalBolillo>; etiqueta: string }) {
  return (
    <>
      <tr className="bolillo__fila-total">
        <td>PEDIDO</td>
        {items.map(it => <td key={it.item_code} className="hoja-celda--num">{numero(totales[it.item_code].pedido, 0)}</td>)}
      </tr>
      <tr className="bolillo__fila-total">
        <td>{etiqueta}</td>
        {items.map(it => {
          const t = totales[it.item_code];
          const estado = estadoEnviado(t.pedido, t.salio);
          return (
            <td key={it.item_code} className="hoja-celda--num">
              <span className={estado ? `bolillo__total bolillo__total--${estado}` : 'bolillo__total'}>
                {numero(t.salio, 0)}
              </span>
              {it.unidad === 'charolas' && t.salio > 0 && <small className="bolillo__piezas">= {numero(t.piezas, 0)} pz</small>}
            </td>
          );
        })}
      </tr>
    </>
  );
}

export default function VistaBolillo({ fecha, destino }: { fecha: string; destino: string }) {
  const [dia, setDia] = useState<BolilloDia | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // lo tecleado sin guardar, por fecha, en IndexedDB (como la Captura): recargar no lo tira
  const [borrador, setBorrador] = useState<BorradorBolillo>({});
  useBorradorLocal('bolillo-dia', Object.keys(borrador).length ? borrador : null, setBorrador);
  const tecleado: TecleadoBolillo = useMemo(() => borrador[fecha] ?? {}, [borrador, fecha]);
  // cambiar de fecha con una lectura en vuelo no pinta el día viejo (misma guarda que la Hoja)
  const folio = useRef(0);

  useEffect(() => {
    const f = ++folio.current;
    setDia(null);
    hojaService.vistaBolillo(fecha)
      .then(d => { if (folio.current === f) setDia(d); })
      .catch((e: any) => { if (folio.current === f) setError(e?.message || 'No se pudo leer el bolillo'); });
  }, [fecha]);

  const teclear = (k: string, v: string) => setBorrador(b => ({ ...b, [fecha]: { ...(b[fecha] ?? {}), [k]: v } }));
  const sel = useMemo(() => (dia && destino ? bolilloDe(dia, destino) : null), [dia, destino]);
  // «Guardar» manda solo lo del destino elegido; lo tecleado de otros espera a que lo elijan
  const cambios = useMemo(() => (dia && sel ? cambiosBolillo({
    items: dia.items, destinos: sel.destino ? [sel.destino] : [],
    camionetas: sel.camioneta ? { tandas: sel.camioneta.tandas, salen: sel.camioneta.salen } : null,
  }, tecleado) : SIN_CAMBIOS), [dia, sel, tecleado]);
  const pendientes = cambios.tandas.length + cambios.camionetas.length;

  const guardar = async () => {
    if (!pendientes) return;
    setOcupado(true);
    try {
      setDia(await hojaService.guardarBolillo(fecha, cambios.tandas, cambios.camionetas));
      // ya está en el servidor; lo tecleado de OTROS destinos se queda
      setBorrador(b => ({ ...b, [fecha]: sinDestino(b[fecha] ?? {}, destino) }));
    } catch (e: any) { setError(e?.message || 'No se guardó el bolillo'); }
    finally { setOcupado(false); }
  };

  const agregarTanda = async () => {
    setOcupado(true);
    try { setDia(await hojaService.agregarTanda(fecha, destino)); }
    catch (e: any) { setError(e?.message || 'No se agregó la tanda'); }
    finally { setOcupado(false); }
  };

  const modalError = <ModalError isOpen={Boolean(error)} message={error} onClose={() => setError('')} />;
  if (!dia) return <>{!error && <p className="bolillo__vacio">Cargando el bolillo…</p>}{modalError}</>;
  if (!dia.destinos.length && !dia.camionetas) {
    return (
      <p className="bolillo__vacio">
        El pedido de este día no trae la pestaña BOLILLO. Reimporta el Excel del día en «Pedido del día».
      </p>
    );
  }
  if (!destino) return <p className="bolillo__vacio">Elige un destino para capturar su bolillo.</p>;
  if (!sel) {
    return (
      <p className="bolillo__vacio">
        {destino} no lleva bolillo por tandas: su bolillo se captura en «Captura».
      </p>
    );
  }
  const items = dia.items;

  return (
    <section className="bolillo">
      <div className="bolillo__barra">
        <p>Lo pedido en gris; en la casilla, lo que <strong>salió</strong>. Bolillo y telera en charolas; mini y baguet en piezas.</p>
        <button type="button" className="hoja-btn hoja-btn--primario" onClick={guardar} disabled={!pendientes || ocupado}>
          Guardar{pendientes ? ` (${pendientes})` : ''}
        </button>
      </div>

      <div className="bolillo__tarjetas">
        {sel.destino && [sel.destino].map(d => (
          <article key={d.destino} className="bolillo__tarjeta">
            <header className="bolillo__cabecera">
              <h3>{d.destino}</h3>
              {d.cobrado && <span className="hoja-badge hoja-badge--verde">Cobrado</span>}
            </header>
            <table className="hoja-tabla bolillo__tabla" aria-label={`Bolillo ${d.destino}`}>
              <Encabezado items={items} primera="TANDA" />
              <tbody>
                {d.tandas.map(t => (
                  <tr key={t.tanda}>
                    <td className="bolillo__tanda">{t.tipo || '—'}<small>{t.horario}</small></td>
                    {items.map(it => {
                      const k = claveTanda(d.destino, t.tanda, it.item_code);
                      const pedido = t.celdas[it.item_code]?.pedido ?? 0;
                      return (
                        <td key={it.item_code} className="bolillo__celda">
                          <span className="bolillo__pedido">{pedido ? numero(pedido, 0) : ''}</span>
                          <input
                            type="number" min={0} step="any" inputMode="decimal"
                            aria-label={`${d.destino} tanda ${t.tanda} ${NOMBRE[it.item_code] ?? it.item_code}`}
                            className={`bolillo__input${colorDe(pedido, salioDe(tecleado, d.destino, t, it.item_code))}`}
                            value={k in tecleado ? tecleado[k] : String(t.celdas[it.item_code]?.salio ?? 0)}
                            disabled={d.cobrado || ocupado}
                            onChange={e => teclear(k, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <Totales items={items} totales={totalesDestino(d.destino, d.tandas, items, tecleado)} etiqueta="SALIÓ" />
              </tbody>
            </table>
            {!d.cobrado && (
              <button type="button" className="hoja-btn hoja-btn--secundario bolillo__mas" onClick={agregarTanda} disabled={ocupado}>
                + tanda
              </button>
            )}
          </article>
        ))}

        {sel.camioneta && (
          <article className="bolillo__tarjeta">
            <header className="bolillo__cabecera"><h3>CAMIONETAS</h3></header>
            <table className="hoja-tabla bolillo__tabla" aria-label="Bolillo camionetas">
              <Encabezado items={items} primera="TANDA" />
              <tbody>
                {sel.camioneta.tandas.map(t => (
                  <tr key={t.tanda} className="bolillo__fila-bolsa">
                    <td className="bolillo__tanda">{t.tipo || '—'}<small>{t.horario}</small></td>
                    {items.map(it => (
                      <td key={it.item_code} className="hoja-celda--num bolillo__pedido">
                        {numero(t.celdas[it.item_code]?.pedido ?? 0, 0)}
                      </td>
                    ))}
                  </tr>
                ))}
                {sel.camioneta.salen.map(c => (
                  <tr key={c.destino}>
                    <td className="bolillo__tanda">
                      {c.destino}{(c.cerrada || c.cobrada) && <small>{c.cobrada ? 'cobrada' : 'ya salió'}</small>}
                    </td>
                    {items.map(it => {
                      const k = claveCamioneta(c.destino, it.item_code);
                      return (
                        <td key={it.item_code} className="bolillo__celda">
                          <input
                            type="number" min={0} step="any" inputMode="decimal"
                            aria-label={`${c.destino} ${NOMBRE[it.item_code] ?? it.item_code}`}
                            className="bolillo__input"
                            value={k in tecleado ? tecleado[k] : String(llevaCamioneta({}, c, it.item_code))}
                            disabled={c.cerrada || c.cobrada || ocupado}
                            onChange={e => teclear(k, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* el total es de TODAS las camionetas contra la bolsa: así se ve si sobra o falta */}
                <Totales items={items} etiqueta="SE LLEVAN (TODAS)"
                  totales={totalesCamionetas(sel.camioneta.tandas, sel.camioneta.todas, items, tecleado)} />
              </tbody>
            </table>
          </article>
        )}
      </div>
      {modalError}
    </section>
  );
}
