// src/components/VistaBolillo.tsx
// Vista «Bolillo» de la Hoja del día (08-oct): la pestaña BOLILLO del Excel en el sistema.
// Solo el destino elegido en el selector (Diemar 08-oct). 09-oct, como su hoja en papel: dos
// tablas, PEDIDO (fijo, del Excel) y ENVIADO (lo único que se teclea), sin hora ni tipo de
// tanda, sin «+ tanda», y TOTALES en piezas. Camioneta: la bolsa común y lo que se lleva. El ENVIADO de esos 4 panes
// lo calcula el servidor (Σ salió × charola); aquí solo se teclean cantidades.
// Spec: gestion_panaderia/docs/superpowers/specs/2026-10-08-bolillo-tandas-design.md
import { useEffect, useMemo, useRef, useState } from 'react';
import ModalError from './modals/ModalError';
import useBorradorLocal from '../hooks/useBorradorLocal';
import { hojaService, type BolilloDia, type ItemBolillo, type Tanda } from '../services/frappeHoja';
import {
  bolilloDe, cambiosBolillo, claveCamioneta, claveTanda, llevaCamioneta, salioDe, sinDestino, totalesCamionetas, totalesDestino,
  type BorradorBolillo, type TecleadoBolillo, type TotalBolillo,
} from '../utils/bolilloDia';
import { estadoEnviado } from '../utils/hojaDia';
import { numero } from '../utils/formato';

const NOMBRE: Record<string, string> = { '3001': 'BOLILLO', '3002': 'TELERA', '3003': 'MINI', '3004': 'BAGUET' };
// 09-oct: como la hoja en papel de Diemar
const TITULO: Record<string, string> = { '3001': 'Bolillo', '3002': 'Telera', '3003': 'Mini Bolillo', '3004': 'Baguets' };
const SIN_CAMBIOS = { tandas: [], camionetas: [] };

const colorDe = (pedido: number, salio: number) => {
  const c = estadoEnviado(pedido, salio);
  return c ? ` hoja-input--${c}` : '';
};

function Encabezado({ items }: { items: ItemBolillo[] }) {
  return (
    <thead>
      <tr>{items.map(it => <th key={it.item_code} className="hoja-celda--num">{TITULO[it.item_code] ?? it.item_code}</th>)}</tr>
    </thead>
  );
}

/** TOTALES en piezas (charolas × 16/12; mini y baguet ya son piezas). En ENVIADO, con el color contra el pedido. */
function Totales({ items, totales, enviado }: { items: ItemBolillo[]; totales: Record<string, TotalBolillo>; enviado?: boolean }) {
  return (
    <tfoot>
      <tr className="bolillo__fila-total">
        {items.map(it => {
          const t = totales[it.item_code];
          const n = enviado ? t.piezas : t.pedidoPiezas;
          const estado = enviado ? estadoEnviado(t.pedidoPiezas, t.piezas) : null;
          return (
            <td key={it.item_code} className="hoja-celda--num">
              <span className={estado ? `bolillo__total bolillo__total--${estado}` : 'bolillo__total'}>{numero(n, 0)}</span>
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}

/** PEDIDO del Excel, fijo: una fila por tanda, sin hora ni tipo; vacío donde no se pidió. */
function TablaPedido({ nombre, tandas, items, totales }: { nombre: string; tandas: Tanda[]; items: ItemBolillo[]; totales: Record<string, TotalBolillo> }) {
  return (
    <table className="hoja-tabla bolillo__tabla bolillo__tabla--pedido" aria-label={`Pedido ${nombre}`}>
      <caption>PEDIDO</caption>
      <Encabezado items={items} />
      <tbody>
        {tandas.map(t => (
          <tr key={t.tanda}>
            {items.map(it => {
              const n = t.celdas[it.item_code]?.pedido ?? 0;
              return <td key={it.item_code} className="hoja-celda--num">{n ? numero(n, 0) : ''}</td>;
            })}
          </tr>
        ))}
      </tbody>
      <Totales items={items} totales={totales} />
    </table>
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
        <p>Se teclea solo lo <strong>ENVIADO</strong>. Tandas: bolillo y telera en charolas; mini y baguet en piezas. TOTALES en piezas.</p>
        <button type="button" className="hoja-btn hoja-btn--primario" onClick={guardar} disabled={!pendientes || ocupado}>
          Guardar{pendientes ? ` (${pendientes})` : ''}
        </button>
      </div>

      {sel.destino && (() => {
        const d = sel.destino;
        const totales = totalesDestino(d.destino, d.tandas, items, tecleado);
        return (
          <article className="bolillo__tarjeta">
            <header className="bolillo__cabecera">
              <h3>{d.destino}</h3>
              {d.cobrado && <span className="hoja-badge hoja-badge--verde">Cobrado</span>}
            </header>
            <div className="bolillo__par">
              <TablaPedido nombre={d.destino} tandas={d.tandas} items={items} totales={totales} />
              <table className="hoja-tabla bolillo__tabla bolillo__tabla--enviado" aria-label={`Enviado ${d.destino}`}>
                <caption>ENVIADO</caption>
                <Encabezado items={items} />
                <tbody>
                  {d.tandas.map(t => (
                    <tr key={t.tanda}>
                      {items.map(it => {
                        const k = claveTanda(d.destino, t.tanda, it.item_code);
                        const pedido = t.celdas[it.item_code]?.pedido ?? 0;
                        return (
                          <td key={it.item_code} className="bolillo__celda">
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
                </tbody>
                <Totales items={items} totales={totales} enviado />
              </table>
            </div>
          </article>
        );
      })()}

      {sel.camioneta && (() => {
        const cam = sel.camioneta;
        // el total es de TODAS las camionetas contra la bolsa: así se ve si sobra o falta
        const totales = totalesCamionetas(cam.tandas, cam.todas, items, tecleado);
        return (
          <article className="bolillo__tarjeta">
            <header className="bolillo__cabecera"><h3>CAMIONETAS</h3></header>
            <div className="bolillo__par">
              <TablaPedido nombre="camionetas" tandas={cam.tandas} items={items} totales={totales} />
              {cam.salen.map(c => (
                <table key={c.destino} className="hoja-tabla bolillo__tabla bolillo__tabla--enviado" aria-label={`Enviado ${c.destino}`}>
                  <caption>ENVIADO · {c.destino}{(c.cerrada || c.cobrada) && <small> ({c.cobrada ? 'cobrada' : 'ya salió'})</small>}</caption>
                  <Encabezado items={items} />
                  <tbody>
                    <tr>
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
                  </tbody>
                  <Totales items={items} totales={totales} enviado />
                </table>
              ))}
            </div>
            <p className="bolillo__nota">TOTALES de ENVIADO: todas las camionetas juntas contra la bolsa.</p>
          </article>
        );
      })()}
      {modalError}
    </section>
  );
}
