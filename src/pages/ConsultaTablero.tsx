// src/pages/ConsultaTablero.tsx
// Consultas → Tablero del reparto: cómo va el día contra el pedido guardado.
// Contesta las cuatro preguntas del que reparte —a quién le falta y hay pan, a
// quién le falta y no hay, a quién le mandé de más, y qué pan quedó sin dueño—
// leyendo los traspasos REALES del día, no un campo que enlace al pedido.
// Las tablas van en orden de clave, el mismo de la hoja del jefe.
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ModalError from '../components/modals/ModalError';
import { pedidoService } from '../services/frappePedido';
import type { FechaPedido, FilaTablero, Sobra, Tablero } from '../services/frappePedido';
import '../styles/global.css';
import '../styles/Pedido.css';

const DIA_MES: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
const fechaCorta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', DIA_MES);
const num = (n: number | null | undefined) => Number(n || 0).toLocaleString('es-MX');

/** Las llaves de `Tablero` que son cubetas de renglones, no metadatos. */
type CubetaKey = 'pendientes' | 'sin_pan' | 'de_mas' | 'sobras';

// Las cuatro cubetas, en el orden en que se atienden: primero lo que sí se puede
// resolver, al final lo que solo se puede reportar.
const CUBETAS: { key: CubetaKey; nombre: string; badge: string; nota: string }[] = [
  { key: 'pendientes', nombre: 'Falta y hay pan', badge: 'warn',
    nota: 'Se puede surtir ahora mismo desde el almacén.' },
  { key: 'sin_pan', nombre: 'Falta y no hay', badge: 'bad',
    nota: 'No alcanzó: o no se horneó, o ya se repartió todo.' },
  { key: 'de_mas', nombre: 'De más', badge: 'info',
    nota: 'Le llegó más de lo que pidió. Si no fue a propósito, es pan que le falta a otro.' },
  { key: 'sobras', nombre: 'Sobras en almacén', badge: 'info',
    nota: 'Pan que ya nadie espera. Es merma en camino si nadie lo mueve.' },
];

export default function ConsultaTablero() {
  const [fechas, setFechas] = useState<FechaPedido[]>([]);
  const [fecha, setFecha] = useState('');
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [cubeta, setCubeta] = useState<CubetaKey>('pendientes');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    pedidoService.fechas()
      .then((lista) => {
        setFechas(lista);
        setFecha((f) => f || lista[0]?.fecha || '');
        if (!lista.length) setCargando(false);
      })
      .catch((err: any) => { setError(err.message); setCargando(false); });
  }, []);

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    setCargando(true);
    pedidoService.tablero(fecha)
      .then((t) => { if (vigente) setTablero(t); })
      .catch((err: any) => { if (vigente) { setError(err.message); setTablero(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [fecha]);

  const conAlmacen = (tablero?.destinos ?? []).filter((d) => d.estado === 'almacen');
  const pedido = conAlmacen.reduce((a, d) => a + d.pedido, 0);
  const enviado = conAlmacen.reduce((a, d) => a + d.enviado, 0);
  const avance = pedido ? Math.round((enviado / pedido) * 100) : 0;
  const filas: (FilaTablero | Sobra)[] = tablero?.[cubeta] ?? [];

  return (
    <Layout>
      <div className="ped-card">
        <div className="ped-card-head">
          <h3>Elegir el día</h3>
          {tablero && (
            <span className={`ped-badge ${avance >= 100 ? 'ok' : avance ? 'warn' : 'bad'}`}>
              {num(enviado)} de {num(pedido)} piezas · {avance}%
            </span>
          )}
        </div>

        <div className="ped-grid">
          <div className="ped-field">
            <label htmlFor="tab-fecha">Pedido guardado</label>
            <select
              id="tab-fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={!fechas.length}
            >
              {!fechas.length && <option value="">No hay pedidos guardados</option>}
              {fechas.map((f) => (
                <option key={f.name} value={f.fecha}>
                  {fechaCorta(f.fecha)} · {f.dia} — {num(f.total_piezas)} pz
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {cargando && <div className="ped-card ped-cargando">Cargando el tablero…</div>}

      {!cargando && !fechas.length && (
        <div className="ped-card">
          <p className="ped-nota">
            Todavía no hay ningún pedido guardado. Se guardan en{' '}
            <strong>Operaciones → Pedido del día</strong>, importando la hoja de Drive.
          </p>
        </div>
      )}

      {!cargando && tablero && (
        <>
          <div className="ped-card">
            <div className="ped-card-head">
              <h3>Avance por destino</h3>
              <span className="ped-badge info">{tablero.destinos.length} destinos</span>
            </div>
            <div className="table-container">
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Destino</th>
                    <th>Almacén</th>
                    <th className="cell-right">Pidió</th>
                    <th className="cell-right">Le llegó</th>
                    <th className="cell-right">Falta</th>
                    <th className="cell-right">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {tablero.destinos.map((d) => {
                    const falta = Math.max(d.pedido - d.enviado, 0);
                    const pct = d.pedido ? Math.round((d.enviado / d.pedido) * 100) : 0;
                    return (
                      <tr key={d.destino}>
                        <td><strong>{d.destino}</strong></td>
                        <td>
                          {d.estado === 'almacen' ? d.almacen : (
                            <span className={`ped-badge ${d.estado === 'cliente' ? 'info' : 'bad'}`}>
                              {d.estado === 'cliente'
                                ? 'Es cliente: se le vende'
                                : 'Almacén sin definir'}
                            </span>
                          )}
                        </td>
                        <td className="cell-right">{num(d.pedido)}</td>
                        <td className="cell-right">{num(d.enviado)}</td>
                        <td className="cell-right">{falta ? num(falta) : '—'}</td>
                        <td className="cell-right">
                          {d.estado === 'almacen' ? (
                            <span className={`ped-badge ${pct >= 100 ? 'ok' : pct ? 'warn' : 'bad'}`}>
                              {pct}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ped-card">
            <div className="ped-switch">
              {CUBETAS.map((c) => (
                <button
                  key={c.key}
                  className={`ped-switch-op${cubeta === c.key ? ' is' : ''}`}
                  onClick={() => setCubeta(c.key)}
                >
                  {c.nombre} ({tablero[c.key].length})
                </button>
              ))}
            </div>

            <p className="ped-nota">{CUBETAS.find((c) => c.key === cubeta)?.nota}</p>

            {!filas.length ? (
              <p className="ped-nota"><strong>Nada aquí.</strong> Esta cubeta está vacía.</p>
            ) : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    {cubeta === 'sobras' ? (
                      <tr>
                        <th>Clave</th>
                        <th>Producto</th>
                        <th>Almacén</th>
                        <th className="cell-right">Se pidió</th>
                        <th className="cell-right">Quedó</th>
                      </tr>
                    ) : (
                      <tr>
                        <th>Clave</th>
                        <th>Producto</th>
                        <th>Destino</th>
                        <th className="cell-right">Pidió</th>
                        <th className="cell-right">Le llegó</th>
                        <th className="cell-right">Diferencia</th>
                        <th className="cell-right">Hay en almacén</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {/* `almacen` solo existe en las sobras: es el discriminante real
                        de la cubeta, y así el compilador verifica cada columna. */}
                    {filas.map((f) => ('almacen' in f ? (
                      <tr key={`${f.clave}-${f.almacen}`}>
                        <td>{f.clave}</td>
                        <td>{f.producto}</td>
                        <td>{f.almacen}</td>
                        <td className="cell-right">{num(f.pedido)}</td>
                        <td className="cell-right"><strong>{num(f.disponible)}</strong></td>
                      </tr>
                    ) : (
                      <tr key={`${f.destino}-${f.clave}`}>
                        <td>{f.clave}</td>
                        <td>{f.producto}</td>
                        <td>{f.destino}</td>
                        <td className="cell-right">{num(f.pedido)}</td>
                        <td className="cell-right">{num(f.enviado)}</td>
                        <td className="cell-right">
                          <strong>{f.diferencia > 0 ? `+${num(f.diferencia)}` : num(f.diferencia)}</strong>
                        </td>
                        <td className="cell-right">{num(f.disponible)}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ModalError
        isOpen={!!error}
        title="No se pudo armar el tablero"
        message={error}
        onClose={() => setError('')}
      />
    </Layout>
  );
}
