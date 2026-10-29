// src/pages/MiCuenta.tsx
// 16-oct (Diemar): la ÚNICA pantalla del nivel Cliente (Alejandro, Puerta Real +
// Panquelería). Ve lo suyo y nada más: lo que pidió, lo que se le envió, lo que se le
// facturó y lo que debe. Solo lectura; los $ son los que se le cobran (nunca costos).
// Quién es lo dice la sesión en el servidor: aquí no se elige cliente.
// Tablero (Diemar, misma tarde): lado carbón con su nombre y menú, tarjetas de cifras,
// barras de pedido contra lo que se mandó y dona de lo pagado. Gráficas en SVG/CSS, sin librería.
// 20-oct (Diemar): LO ÚNICO que escribe: en «Ver pan» de HOY anota, pan por pan, cuánto le
// LLEGÓ (acumulado del día; el pan llega en varias entregas) hasta el cierre (19:00 de la
// torre). Lo que no anote se toma como lo que se mandó. Solo auditoría: se cobra lo mandado.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Receipt, ShoppingBasket, Truck } from 'lucide-react';
import Layout from '../components/Layout';
import { auth } from '../services/frappeAuth';
import { fechaCorta, fechaLarga, hoyISO, rangoFechas } from '../utils/hora';
import { numero, pesos } from '../utils/formato';
import { coincidePan, normalizarBusqueda } from '../utils/buscarPan';
import { estadoEnviado } from '../utils/hojaDia';
import { clienteService, type DetallePedido, type MiCuenta as Cuenta, type RenglonPedido } from '../services/frappeCliente';
import '../styles/global.css';
import '../styles/MiCuenta.css';

const inicioDeMes = (hoy: string) => `${hoy.slice(0, 8)}01`;

/** Totales del periodo, una pasada por las facturas. */
export function totalesFacturas(facturas: Cuenta['facturas']) {
  return facturas.reduce((t, f) => ({ total: t.total + f.total, pagado: t.pagado + f.pagado, debe: t.debe + f.debe }),
    { total: 0, pagado: 0, debe: 0 });
}

/** % pagado de lo facturado (0–100, entero). Sin facturas: 0. */
export const pctPagado = (t: { total: number; pagado: number }) =>
  t.total > 0 ? Math.round(Math.min(t.pagado / t.total, 1) * 100) : 0;

/** Lo facturado por día, partido en pagado y lo que se debe. Map, una pasada, O(n). */
export function facturadoPorDia(facturas: Cuenta['facturas']) {
  const dias = new Map<string, { fecha: string; pagado: number; debe: number }>();
  for (const f of facturas) {
    const d = dias.get(f.fecha) ?? { fecha: f.fecha, pagado: 0, debe: 0 };
    d.pagado += f.pagado; d.debe += f.debe;
    dias.set(f.fecha, d);
  }
  return [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Tope «redondo» del eje (1, 2 o 5 × 10ⁿ) para que las rayas caigan en números legibles. */
export function techo(max: number) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 5, 10].find(k => k * p >= max) ?? 10) * p;
}

/** Cuánto de lo pedido llegó, por día (0–100; lo de más se topa a 100). Sin pedido: null. */
export const surtido = (piezas: number, enviado: number) =>
  piezas > 0 ? Math.round(Math.min(enviado / piezas, 1) * 100) : null;

/** Lo tecleado que cambia lo guardado, listo para mandar. Vacío o no entero ≥ 0 = no va. O(n). */
export function llegadasCambiadas(renglones: RenglonPedido[], tecleado: Record<string, string>) {
  const cambios: { item_code: string; llego: number }[] = [];
  for (const r of renglones) {
    const t = tecleado[r.item_code];
    if (t === undefined || t.trim() === '') continue;
    const n = Number(t);
    if (Number.isInteger(n) && n >= 0 && n !== r.llego) cambios.push({ item_code: r.item_code, llego: n });
  }
  return cambios;
}

/** Cada minuto se relee el día abierto: Héctor va subiendo lo que se mandó. */
const RELEER_MS = 60_000;

const pesosCorto = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Color de «Te llegó» contra lo mandado (29-oct, como la Hoja): solo falta o de más; vacío, sin color. */
export function claseLlego(enviado: number, llego: string): 'falta' | 'demas' | 'nada' {
  if (llego.trim() === '') return 'nada';
  const n = Number(llego);
  if (!Number.isFinite(n) || n === enviado) return 'nada';
  return n < enviado ? 'falta' : 'demas';
}

const SECCIONES = [
  { id: 'resumen', titulo: 'Resumen', Icono: LayoutDashboard },
  { id: 'facturas', titulo: 'Facturas', Icono: Receipt },
  { id: 'pedidos', titulo: 'Pedidos', Icono: ShoppingBasket },
  { id: 'envios', titulo: 'Envíos', Icono: Truck },
] as const;
type Seccion = typeof SECCIONES[number]['id'];

function iniciales(nombre: string) {
  const p = nombre.split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

/** Dona pagado/pendiente: un círculo SVG con el trazo del % (r = 15.9155 → perímetro 100). */
function Dona({ pct }: { pct: number }) {
  return (
    <svg viewBox="0 0 36 36" className="mc-dona" role="img" aria-label={`Pagado ${pct}%`}>
      <circle cx="18" cy="18" r="15.9155" className="mc-dona-fondo" />
      <circle cx="18" cy="18" r="15.9155" className="mc-dona-pagado" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="25" />
      <text x="18" y="18.5" textAnchor="middle" className="mc-dona-txt">{pct}%</text>
      <text x="18" y="23.5" textAnchor="middle" className="mc-dona-sub">pagado</text>
    </svg>
  );
}

export default function MiCuenta() {
  const hoy = hoyISO();
  const [desde, setDesde] = useState(inicioDeMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [error, setError] = useState('');
  const [dia, setDia] = useState('');
  const [detalle, setDetalle] = useState<DetallePedido | null>(null);
  const [tecleado, setTecleado] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  // 29-oct: buscador del pan del día; solo filtra lo que se pinta
  const [busqueda, setBusqueda] = useState('');
  const buscado = normalizarBusqueda(busqueda);
  const usuario = auth.getUser();

  const cargar = useCallback(async () => {
    setError('');
    try { setCuenta(await clienteService.miCuenta(desde, hasta)); }
    catch (e: any) { setError(e?.message || 'No se pudo cargar tu cuenta'); }
  }, [desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirDia = async (fecha: string) => {
    setTecleado({});
    if (dia === fecha) { setDia(''); setDetalle(null); return; }
    setDia(fecha); setDetalle(null);
    try { setDetalle(await clienteService.miPedido(fecha)); }
    catch (e: any) { setError(e?.message || 'No se pudo cargar el pedido'); }
  };

  // Releer solo mientras se pueda anotar; lo tecleado vive aparte y no se pisa.
  const abierta = !!detalle?.abierta;
  useEffect(() => {
    if (!dia || !abierta) return;
    const id = setInterval(() => {
      if (document.hidden) return; // 29-oct: pestaña escondida o celular bloqueado: no pregunta
      clienteService.miPedido(dia).then(setDetalle).catch(() => { /* ponytail: el siguiente minuto reintenta */ });
    }, RELEER_MS);
    return () => clearInterval(id);
  }, [dia, abierta]);

  const cambios = detalle ? llegadasCambiadas(detalle.renglones, tecleado) : [];
  const guardarLlegada = async () => {
    if (!cambios.length) return;
    setGuardando(true); setError('');
    try { setDetalle(await clienteService.confirmarLlegada(dia, cambios)); setTecleado({}); }
    catch (e: any) { setError(e?.message || 'No se pudo guardar lo que llegó'); }
    finally { setGuardando(false); }
  };

  const t = totalesFacturas(cuenta?.facturas ?? []);
  const llego = (cuenta?.pedidos ?? []).reduce((s, p) => s + p.enviado, 0);
  const nombre = cuenta?.cliente || usuario?.fullName || 'Mi cuenta';

  return (
    <Layout>
      <div className="mc">
        <div className="mc-panel">
          <aside className="mc-lado">
            <span className="mc-avatar">{iniciales(nombre)}</span>
            <strong className="mc-nombre">{nombre}</strong>
            <span className="mc-correo">{usuario?.email}</span>
            <nav className="mc-menu" aria-label="Secciones">
              {SECCIONES.map(({ id, titulo, Icono }) => (
                <button key={id} type="button" className={`mc-menu-btn${seccion === id ? ' mc-menu-btn--activo' : ''}`}
                  aria-current={seccion === id ? 'page' : undefined} onClick={() => setSeccion(id)}>
                  <Icono size={18} /> {titulo}
                </button>
              ))}
            </nav>
          </aside>

          <main className="mc-main">
            <header className="mc-cabecera">
              <h2>{seccion === 'resumen' ? 'Mi cuenta' : SECCIONES.find(x => x.id === seccion)?.titulo}</h2>
              <div className="mc-filtros">
                <label>Desde <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} /></label>
                <label>Hasta <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} /></label>
              </div>
            </header>

            {error && <p className="mc-error" role="alert">{error}</p>}

            {cuenta && seccion === 'resumen' && (() => {
              const dias = facturadoPorDia(cuenta.facturas);
              const tope = techo(dias.reduce((m, d) => Math.max(m, d.pagado + d.debe), 0));
              const pidio = cuenta.pedidos.reduce((x, p) => x + p.piezas, 0);
              const sur = surtido(pidio, llego);
              const maxTramo = Math.max(...cuenta.antiguedad.map(a => a.monto), 0) || 1;
              return (
                <>
                  <section className="mc-cifras">
                    <div className="mc-cifra mc-cifra--marca"><span>Debes hoy</span><strong aria-label="Saldo">{pesos(cuenta.saldo)}</strong><small>toda tu cuenta</small></div>
                    <div className="mc-cifra"><span>Facturado</span><strong>{pesos(t.total)}</strong><small>{rangoFechas(desde, hasta)}</small></div>
                    <div className="mc-cifra"><span>Pagado</span><strong>{pesos(t.pagado)}</strong><small>de lo facturado en el periodo</small></div>
                    <div className="mc-cifra"><span>Surtido</span><strong aria-label="Surtido">{sur === null ? '—' : `${sur}%`}</strong>
                      <small>{numero(llego, 0)} de {numero(pidio, 0)} piezas pedidas</small></div>
                  </section>

                  <section className="mc-fila">
                    <div className="mc-tarjeta">
                      <div className="mc-tarjeta-cabeza">
                        <h3>Lo facturado por día</h3>
                        <span className="mc-leyenda"><i className="mc-punto mc-punto--pagado" />Pagado <i className="mc-punto mc-punto--debe" />Pendiente</span>
                      </div>
                      {dias.length === 0 ? <p className="mc-nota">Sin facturas en el periodo.</p> : (
                        <div className="mc-grafica" role="img" aria-label="Facturado por día">
                          <div className="mc-eje">
                            {[1, 0.75, 0.5, 0.25, 0].map(k => <span key={k}>{pesosCorto(tope * k)}</span>)}
                          </div>
                          <div className="mc-columnas">
                            {dias.map(d => (
                              <div key={d.fecha} className="mc-columna" title={`${fechaLarga(d.fecha)}: ${pesos(d.pagado + d.debe)} (debe ${pesos(d.debe)})`}>
                                <div className="mc-columna-pila">
                                  <span className="mc-seg mc-seg--debe" style={{ height: `${(d.debe / tope) * 100}%` }} />
                                  <span className="mc-seg mc-seg--pagado" style={{ height: `${(d.pagado / tope) * 100}%` }} />
                                </div>
                                <span className="mc-columna-fecha">{fechaCorta(d.fecha)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mc-tarjeta mc-pagado">
                      <h3>Pagado del periodo</h3>
                      <Dona pct={pctPagado(t)} />
                      <ul className="mc-lista">
                        <li><span><i className="mc-punto mc-punto--pagado" />Pagado</span><strong>{pesos(t.pagado)}</strong></li>
                        <li><span><i className="mc-punto mc-punto--debe" />Pendiente</span><strong className={t.debe > 0 ? 'mc-debe' : undefined}>{pesos(t.debe)}</strong></li>
                      </ul>
                      <button type="button" className="mc-btn mc-btn--marca" onClick={() => setSeccion('facturas')}>Ver facturas</button>
                    </div>
                  </section>

                  <section className="mc-fila">
                    <div className="mc-tarjeta">
                      <div className="mc-tarjeta-cabeza">
                        <h3>¿Se te mandó lo que pediste?</h3>
                        <button type="button" className="mc-btn" onClick={() => setSeccion('pedidos')}>Ver pedidos</button>
                      </div>
                      {cuenta.pedidos.length === 0 ? <p className="mc-nota">Sin pedidos en el periodo.</p> : (
                        <ul className="mc-surtido" aria-label="Surtido por día">
                          {[...cuenta.pedidos].reverse().map(p => {
                            const pct = surtido(p.piezas, p.enviado);
                            return (
                              <li key={p.fecha}>
                                <span className="mc-surtido-dia">{fechaCorta(p.fecha)}</span>
                                <span className="mc-pista"><span className="mc-avance" style={{ width: `${pct ?? 0}%` }} /></span>
                                <strong>{pct === null ? '—' : `${pct}%`}</strong>
                                <small>{numero(p.enviado, 0)} / {numero(p.piezas, 0)} pz</small>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="mc-tarjeta">
                      <h3>¿Desde cuándo debes?</h3>
                      <p className="mc-nota">Tu saldo según los días que lleva cada factura.</p>
                      <ul className="mc-tramos" aria-label="Antigüedad del saldo">
                        {cuenta.antiguedad.map((a, i) => (
                          <li key={a.tramo}>
                            <span className="mc-tramo-nombre">{a.tramo}</span>
                            <span className="mc-pista"><span className={`mc-tramo mc-tramo--${i}`} style={{ width: `${(a.monto / maxTramo) * 100}%` }} /></span>
                            <strong>{pesos(a.monto)}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </>
              );
            })()}

            {cuenta && seccion === 'facturas' && (
              <section className="mc-tarjeta">
                {cuenta.facturas.length === 0 ? <p className="mc-nota">Sin facturas en el periodo.</p> : (
                  <div className="mc-scroll"><table className="mc-tabla" aria-label="Facturas">
                    <thead><tr><th>Fecha</th><th>Factura</th><th>Qué</th><th className="mc-num">Total</th><th className="mc-num">Pagado</th><th className="mc-num">Debe</th></tr></thead>
                    <tbody>{cuenta.facturas.map(f => (
                      <tr key={f.factura}>
                        <td>{fechaLarga(f.fecha)}</td><td>{f.factura}</td><td>{f.tipo === 'pan' ? 'Pan' : 'Abarrotes'}</td>
                        <td className="mc-num">{pesos(f.total)}</td><td className="mc-num">{pesos(f.pagado)}</td>
                        <td className={`mc-num${f.debe > 0 ? ' mc-debe' : ''}`}>{pesos(f.debe)}</td>
                      </tr>))}
                    </tbody>
                  </table></div>
                )}
              </section>
            )}

            {cuenta && seccion === 'pedidos' && (
              <section className="mc-tarjeta">
                {cuenta.pedidos.length === 0 ? <p className="mc-nota">Sin pedidos en el periodo.</p> : (
                  <div className="mc-scroll"><table className="mc-tabla" aria-label="Pedidos">
                    <thead><tr><th>Día</th><th className="mc-num">Pediste (pz)</th><th className="mc-num">Se mandó (pz)</th><th /></tr></thead>
                    {/* 29-oct: el más reciente arriba (el servidor los manda de viejo a nuevo) */}
                    <tbody>{[...cuenta.pedidos].reverse().map(p => (
                      <Fragment key={p.fecha}>
                        <tr>
                          <td>{fechaLarga(p.fecha)}</td><td className="mc-num">{numero(p.piezas, 0)}</td><td className="mc-num">{numero(p.enviado, 0)}</td>
                          <td><button className="mc-btn" onClick={() => abrirDia(p.fecha)}>{dia === p.fecha ? 'Cerrar' : 'Ver pan'}</button></td>
                        </tr>
                        {/* 19-oct: el pan se abre debajo de SU día; al final de la tabla no se veía */}
                        {dia === p.fecha && (
                          <tr className="mc-fila-detalle"><td colSpan={4}><div className="mc-detalle">
                            {!detalle ? <p className="mc-nota">Cargando…</p> : (<>
                              {detalle.abierta && (
                                <p className="mc-nota">Anota cuánto te ha llegado de cada pan en todo el día (no solo esta entrega), hasta las {detalle.cierre}:00. Lo que no anotes se toma como lo que se mandó.</p>
                              )}
                              <div className="mc-detalle-cabeza">
                                <strong>Pan del {fechaLarga(p.fecha)}</strong>
                                <input type="search" className="buscador-pan" placeholder="Buscar pan" aria-label="Buscar pan"
                                  value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                              </div>
                              <table className="mc-tabla mc-tabla--pan" aria-label={`Pedido del ${dia}`}>
                                <thead><tr><th>Pan</th><th className="mc-num">Pediste</th><th className="mc-num">Se mandó</th><th className="mc-num">Te llegó</th><th className="mc-num">Precio</th></tr></thead>
                                <tbody>{detalle.renglones.filter(r => coincidePan(buscado, r.producto, r.item_code)).map(r => (
                                  <tr key={r.item_code}>
                                    <td>{r.producto}</td><td className="mc-num">{numero(r.piezas, 0)}</td>
                                    {/* 29-oct: mismos colores que la Hoja: se mandó contra lo pedido (ámbar falta,
                                        verde cuadra, azul de más) y te llegó contra lo mandado (ámbar / azul) */}
                                    <td className="mc-num"><span className={`mc-cifra-pan mc-dif--${estadoEnviado(r.piezas, r.enviado) ?? 'nada'}`}>{numero(r.enviado, 0)}</span></td>
                                    <td className="mc-num">
                                      {detalle.abierta ? (
                                        <input type="number" min={0} step={1} inputMode="numeric"
                                          className={`mc-llego mc-dif--${claseLlego(r.enviado, tecleado[r.item_code] ?? (r.llego === null ? '' : String(r.llego)))}`}
                                          aria-label={`Te llegó ${r.producto}`} disabled={guardando}
                                          value={tecleado[r.item_code] ?? (r.llego === null ? '' : String(r.llego))}
                                          onChange={e => { const v = e.target.value; setTecleado(t => ({ ...t, [r.item_code]: v })); }} />
                                      ) : r.llego === null ? '—' : (
                                        <span className={`mc-cifra-pan mc-dif--${r.llego_supuesto ? 'supuesto' : claseLlego(r.enviado, String(r.llego))}`}
                                          title={r.llego_supuesto ? 'No lo anotaste: se tomó lo que se mandó' : undefined}>
                                          {numero(r.llego, 0)}{r.llego_supuesto && ' *'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="mc-num mc-precio">{pesos(r.precio)}</td>
                                  </tr>))}
                                </tbody>
                              </table>
                              {detalle.abierta && (
                                <button type="button" className="mc-btn mc-btn--marca" disabled={guardando || !cambios.length} onClick={guardarLlegada}>
                                  {guardando ? 'Guardando…' : 'Guardar lo que llegó'}
                                </button>
                              )}
                              {!detalle.abierta && detalle.renglones.some(r => r.llego_supuesto) && (
                                <p className="mc-nota">* No lo anotaste a tiempo: se tomó lo que se mandó.</p>
                              )}
                            </>)}
                          </div></td></tr>
                        )}
                      </Fragment>))}
                    </tbody>
                  </table></div>
                )}
              </section>
            )}

            {cuenta && seccion === 'envios' && (
              <section className="mc-tarjeta">
                {cuenta.envios.length === 0 ? <p className="mc-nota">Sin envíos en el periodo.</p> : (
                  <div className="mc-scroll"><table className="mc-tabla" aria-label="Envíos">
                    <thead><tr><th>Fecha</th><th>Envío</th><th>Producto</th><th className="mc-num">Cantidad</th><th>A</th></tr></thead>
                    <tbody>{cuenta.envios.map((e, i) => (
                      <tr key={`${e.envio}-${i}`}>
                        <td>{fechaLarga(e.fecha)}</td><td>{e.envio}</td><td>{e.producto}</td>
                        <td className="mc-num">{numero(e.cantidad, Number.isInteger(e.cantidad) ? 0 : 2)} {e.unidad}</td><td>{e.almacen}</td>
                      </tr>))}
                    </tbody>
                  </table></div>
                )}
                {cuenta.envios_truncados && <p className="mc-nota">Son muchos renglones: acorta las fechas para verlos todos.</p>}
              </section>
            )}

            <p className="mc-nota mc-pie">Hasta 92 días por consulta. Lo que ves es lo que se te cobra.</p>
          </main>
        </div>
      </div>
    </Layout>
  );
}
