// /pedido-vivo — Pedido en vivo (27-nov, adiós Drive). La pestaña PRODUCCIÓN con una columna por destino.
// Cada celda se guarda sola al salir de ella (o con Enter, que baja a la siguiente). Precio, totales y quién edita
// qué columna los manda el SERVIDOR; aquí solo se pintan. Fase 2: las celdas de los demás llegarán en vivo.
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import Layout from '../../../app/Layout';
import { hoyISO } from '../../../compartido/utils/hora';
import { pesos } from '../../../compartido/utils/formato';
import { pedidoVivoService, type Rejilla } from './frappePedidoVivo';
import { agruparPorSeccion, piezasDeTexto } from './rejilla';
import '../../../compartido/styles/global.css';
import './PedidoVivo.css';

const llave = (destino: string, item: string) => `${destino}|${item}`;
const idCelda = (col: number, fila: number) => `pv-${col}-${fila}`;

function manana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return hoyISO(d);
}

export default function PedidoVivo() {
  const [fecha, setFecha] = useState(manana);
  const [rejilla, setRejilla] = useState<Rejilla | null>(null);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState<Record<string, string>>({});      // lo tecleado sin guardar
  const [estado, setEstado] = useState<Record<string, 'guardando' | 'error'>>({});

  const cargar = useCallback(async () => {
    setError('');
    try {
      setRejilla(await pedidoVivoService.abrir(fecha));
      setTexto({}); setEstado({});
    } catch (e) { setRejilla(null); setError((e as Error).message); }
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);

  const secciones = useMemo(() => agruparPorSeccion(rejilla?.panes ?? []), [rejilla]);
  const editables = useMemo(() => new Set(rejilla?.editables ?? []), [rejilla]);
  // índice de fila por pan, en un Map: buscarlo con indexOf dentro del render sería O(n²)
  const filaDe = useMemo(() => new Map(secciones.flatMap(s => s.panes).map((p, i) => [p.item_code, i])), [secciones]);

  const guardar = async (destino: string, item: string) => {
    const k = llave(destino, item);
    if (!rejilla || texto[k] === undefined) return;
    const piezas = piezasDeTexto(texto[k]);
    const antes = rejilla.piezas[destino]?.[item] ?? 0;
    if (piezas === null) { setEstado(s => ({ ...s, [k]: 'error' })); return; }
    if (piezas === antes) { setTexto(({ [k]: _, ...resto }) => resto); return; }
    setEstado(s => ({ ...s, [k]: 'guardando' }));
    try {
      const r = await pedidoVivoService.guardarCelda(rejilla.fecha, destino, item, piezas);
      setRejilla(g => g && {
        ...g, pedido: r.pedido,
        piezas: { ...g.piezas, [destino]: { ...g.piezas[destino], [item]: r.piezas } },
        totales: { ...g.totales, [destino]: r.total },
      });
      setTexto(({ [k]: _, ...resto }) => resto);
      setEstado(({ [k]: _, ...resto }) => resto);
    } catch (e) {
      setEstado(s => ({ ...s, [k]: 'error' }));
      setError((e as Error).message);
    }
  };

  const bajar = (e: KeyboardEvent<HTMLInputElement>, col: number, fila: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    (document.getElementById(idCelda(col, fila + 1)) as HTMLInputElement | null)?.focus();
    (e.target as HTMLInputElement).blur();
  };

  const total = rejilla ? rejilla.destinos.reduce((s, d) => s + (rejilla.totales[d] || 0), 0) : 0;

  return (
    <Layout>
      <div className="pv">
        <div className="pv-cabecera">
          <h1>Pedido en vivo</h1>
          <label>Fecha <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
          {rejilla && (
            <span className={'pv-pildora' + (rejilla.cerrado ? ' cerrado' : '')}>
              {rejilla.cerrado ? 'Cerrado (6:45)' : rejilla.pedido ? 'Abierto' : 'Sin capturar'}
            </span>
          )}
          {rejilla && <span className="pv-total">Total {pesos(total)}</span>}
        </div>
        {error && <div className="pv-error" onClick={() => setError('')}>{error}</div>}

        {rejilla && (
          <div className="pv-marco">
            <table className="pv-tabla">
              <thead>
                <tr className="pv-grupos">
                  <th className="pv-fija" colSpan={2} />
                  {Object.entries(rejilla.grupos).map(([g, ds]) => <th key={g} colSpan={ds.length}>{g}</th>)}
                </tr>
                <tr className="pv-destinos">
                  <th className="pv-fija pv-clave">Clave</th>
                  <th className="pv-fija pv-producto">Producto</th>
                  {rejilla.destinos.map(d => (
                    <th key={d} className={editables.has(d) ? 'pv-mia' : ''}>{d}</th>
                  ))}
                </tr>
              </thead>
              {secciones.map(s => (
                <tbody key={s.nombre}>
                  <tr className="pv-seccion"><td colSpan={rejilla.destinos.length + 2}>{s.nombre}</td></tr>
                  {s.panes.map(p => {
                    const fila = filaDe.get(p.item_code) ?? 0;
                    return (
                      <tr key={p.item_code}>
                        <td className="pv-fija pv-clave">{p.item_code}</td>
                        <td className="pv-fija pv-producto">{p.producto}</td>
                        {rejilla.destinos.map((d, col) => {
                          const k = llave(d, p.item_code);
                          const valor = texto[k] ?? String(rejilla.piezas[d]?.[p.item_code] || '');
                          if (!editables.has(d) || rejilla.cerrado) {
                            return <td key={d} className="pv-ajena">{valor}</td>;
                          }
                          return (
                            <td key={d} className={'pv-celda ' + (estado[k] ?? '')}>
                              <input
                                id={idCelda(col, fila)} inputMode="numeric" value={valor}
                                aria-label={`${p.producto} ${d}`}
                                onChange={e => setTexto(t => ({ ...t, [k]: e.target.value }))}
                                onBlur={() => guardar(d, p.item_code)}
                                onKeyDown={e => bajar(e, col, fila)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
              <tfoot>
                <tr className="pv-totales">
                  <td className="pv-fija" colSpan={2}>Total $</td>
                  {rejilla.destinos.map(d => <td key={d}>{rejilla.totales[d] ? pesos(rejilla.totales[d]) : ''}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
