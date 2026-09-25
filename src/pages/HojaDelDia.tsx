// src/pages/HojaDelDia.tsx
// La hoja del jefe en el sistema: qué se llevó cada destino y cuánto se le cobra.
// Una factura por destino al día al «Confirmar y cobrar» (Diemar 22-sep, opción A).
// El precio lo pone el servidor; aquí solo se teclean cantidades.
// Trae TODOS los panes de la pestaña del Excel, pedidos o no (23-sep): por eso no
// hay «agregar pan». El destino se elige en un dropdown y la hoja usa todo el ancho.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/modals/ConfirmModal';
import ModalError from '../components/modals/ModalError';
import EstadoCuentaHoja from '../components/EstadoCuentaHoja';
import { hoyISO } from '../components/modals/ModalEntradaPan';
import { hojaService, type DestinoDia, type Hoja } from '../services/frappeHoja';
import useBorradorLocal from '../hooks/useBorradorLocal';
import {
  bloquesDeHoja, cambiosEnviado, cambiosMerma, cantidad, columnasDeHoja, conTecleado, rondaPorGuardar, sinTecleado, totalCapturado,
  type BorradorHoja, type CampoHoja,
} from '../utils/hojaDia';
import { COMISION_FIJA } from '../utils/liquidacion';
import { numero, pesos } from '../utils/formato';
import '../styles/global.css';
import '../styles/HojaDelDia.css';

const ESTADO: Record<DestinoDia['estado'], string> = {
  sin_capturar: 'Sin capturar', sin_confirmar: 'Sin confirmar', en_ruta: 'En ruta', regreso: 'Regresó',
  confirmado: 'Cobrado',
};

const ESTADO_CLASE: Record<DestinoDia['estado'], string> = {
  sin_capturar: 'hoja-badge--gris', sin_confirmar: 'hoja-badge--ambar', en_ruta: 'hoja-badge--azul',
  regreso: 'hoja-badge--ambar', confirmado: 'hoja-badge--verde',
};

export default function HojaDelDia() {
  const [fecha, setFecha] = useState(hoyISO());
  const [destinos, setDestinos] = useState<DestinoDia[]>([]);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [elegido, setElegido] = useState('');
  // dos vistas en la misma pantalla (Diemar 23-sep): capturar el día, o el estado de cuenta
  // `/hoja?vista=estado` (tarjeta de Reportes) abre directo en el estado de cuenta
  const [vista, setVista] = useState<'captura' | 'estado'>(
    () => (new URLSearchParams(window.location.search).get('vista') === 'estado' ? 'estado' : 'captura'));
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Lo tecleado sin guardar vive en IndexedDB (25-sep): cambiar de destino o recargar no lo
  // tira. «Guardar» queda para el final de la ronda; confirmar guarda antes de todos modos.
  const [borrador, setBorrador] = useState<BorradorHoja>({});
  useBorradorLocal('hoja-dia', Object.keys(borrador).length ? borrador : null, setBorrador);
  const olvidar = (destino: string, campos: CampoHoja[]) => setBorrador(b => sinTecleado(b, fecha, destino, campos));
  // qué confirma el modal: el cobro, o (camioneta) el envío
  const [accion, setAccion] = useState<null | 'cobrar' | 'envio'>(null);

  // Guarda de carrera (C2, 22-sep): cambiar de destino/fecha con una
  // petición en vuelo podía pintar la hoja VIEJA encima de la selección
  // NUEVA si la respuesta lenta llegaba después. Cada petición que puede
  // tocar `hoja` saca un folio incremental; si al resolver ya no es el
  // folio vigente, la respuesta se descarta en silencio (alguien más
  // reciente ya ganó).
  const peticionRef = useRef(0);

  const cargarDestinos = useCallback(async () => {
    try { setDestinos(await hojaService.destinos(fecha)); }
    catch (e: any) { setError(e?.message || 'No se pudo leer la hoja del día'); setDestinos([]); }
  }, [fecha]);

  useEffect(() => { peticionRef.current++; setHoja(null); setElegido(''); cargarDestinos(); }, [cargarDestinos]);

  const abrir = async (destino: string) => {
    setElegido(destino);
    if (!destino) return;
    const folio = ++peticionRef.current;
    try {
      const h = await hojaService.hoja(fecha, destino);
      if (peticionRef.current !== folio) return; // ya se abrió otro destino/fecha
      setHoja(h);
      // lo que ya no se teclea no se trae del borrador: enseñaría un número que no es el guardado
      const fijos: CampoHoja[] = [];
      if (h.factura || (h.camioneta && h.etapa)) fijos.push('enviado');
      if (h.factura || h.etapa !== 'liquidado') fijos.push('merma');
      olvidar(destino, fijos);
    } catch (e: any) {
      if (peticionRef.current !== folio) return;
      setError(e?.message || 'No se pudo abrir la hoja');
    }
  };

  const tecleado = hoja ? borrador[fecha]?.[hoja.destino] : undefined;
  const captura = useMemo(() => tecleado?.enviado ?? {}, [tecleado]);
  const capturaMerma = tecleado?.merma ?? {};

  // Lo que falta guardar: solo los renglones cuyo tecleado cambió.
  const cambiosPendientes = (h: Hoja) => cambiosEnviado(h.renglones, captura);

  // Guarda en el servidor y, si nadie más ganó la carrera mientras tanto,
  // pinta la hoja que regresa. La usan tanto el botón «Guardar» como
  // «Confirmar y cobrar» (C1): cobrar SIEMPRE pasa por aquí primero.
  const guardarEnServidor = async (destino: string, renglones: { item_code: string; enviado: number }[]) => {
    const folio = ++peticionRef.current;
    const actualizada = await hojaService.guardar(fecha, destino, renglones);
    olvidar(destino, ['enviado']); // ya está en el servidor, aunque la pantalla haya cambiado de destino
    if (peticionRef.current === folio) setHoja(actualizada);
    return actualizada;
  };

  const cobrado = Boolean(hoja?.factura);
  // Camioneta en tres pasos (23-sep): '' captura enviado · 'enviado' en ruta ·
  // 'liquidado' ya entregó su regreso y Héctor pone la merma antes de cobrar
  const etapa = hoja?.camioneta ? hoja.etapa ?? '' : '';
  const enviadoFijo = cobrado || etapa !== '';
  const mermaAbierta = !cobrado && etapa === 'liquidado';
  const mermaPendiente = hoja ? cambiosMerma(hoja.renglones, capturaMerma) : [];
  const estadoElegido = destinos.find(d => d.destino === hoja?.destino)?.estado;
  const bloques = useMemo(() => (hoja ? bloquesDeHoja(hoja.renglones) : []), [hoja]);
  const columnas = useMemo(() => columnasDeHoja(bloques, Boolean(hoja?.camioneta)), [bloques, hoja?.camioneta]);
  // camioneta: dos hojas de 2 columnas (Diemar 23-sep); los demás: una de 4
  const hojasDeColumnas = hoja?.camioneta ? [columnas.slice(0, 2), columnas.slice(2)] : [columnas];
  const total = useMemo(() => (hoja ? totalCapturado(hoja.renglones, captura) : 0), [hoja, captura]);

  // Agrupar destinos por `grupo` en una sola pasada (HashMap: O(n), sin
  // ciclos anidados) — la lista es corta pero la regla es pareja siempre.
  const grupos = useMemo(() => {
    const m = new Map<string, DestinoDia[]>();
    for (const d of destinos) {
      const lista = m.get(d.grupo);
      if (lista) lista.push(d); else m.set(d.grupo, [d]);
    }
    return m;
  }, [destinos]);

  // «Guardar todo» (25-sep): los destinos se surten a la vez; la ronda se guarda de un golpe
  const ronda = useMemo(() => rondaPorGuardar(borrador[fecha], destinos), [borrador, fecha, destinos]);
  const porGuardar = Object.keys(ronda.capturas).length;

  const guardarTodo = async () => {
    if (!porGuardar) return;
    setOcupado(true);
    try {
      const hechos = await hojaService.guardarTodo(fecha, ronda.capturas);
      // lo de los destinos que ya salieron o se cobraron no se puede guardar: se tira también
      setBorrador(b => [...hechos, ...ronda.fijos].reduce((acc, d) => sinTecleado(acc, fecha, d, ['enviado']), b));
      if (hoja && hechos.includes(hoja.destino)) {
        const folio = ++peticionRef.current;
        const fresca = await hojaService.hoja(fecha, hoja.destino);
        if (peticionRef.current === folio) setHoja(fresca);
      }
      await cargarDestinos();
    } catch (e: any) { setError(e?.message || 'No se guardó'); }
    finally { setOcupado(false); }
  };

  const guardar = async () => {
    if (!hoja) return;
    const renglones = cambiosPendientes(hoja);
    if (!renglones.length) return;
    setOcupado(true);
    try {
      await guardarEnServidor(hoja.destino, renglones);
      await cargarDestinos();
    } catch (e: any) { setError(e?.message || 'No se guardó'); }
    finally { setOcupado(false); }
  };

  // C1 (22-sep, controller): el modal de «Confirmar y cobrar» enseña
  // totalCapturado (lo tecleado, todavía sin guardar); `confirmar` en el
  // servidor cobra lo último GUARDADO. Si hay cambios sin guardar,
  // cobrar podía facturar un monto distinto al que el modal mostró.
  // Por eso cobrar SIEMPRE guarda primero (mismo payload que el botón
  // «Guardar») y solo si eso sale bien pide `confirmar`; si el guardado
  // truena, no se cobra y se enseña el error.
  const cobrar = async () => {
    if (!hoja) return;
    const destino = hoja.destino;
    setOcupado(true);
    try {
      const renglones = cambiosPendientes(hoja);
      if (renglones.length) await guardarEnServidor(destino, renglones);
      await hojaService.confirmar(fecha, destino);
      olvidar(destino, ['enviado', 'merma']);
      const folio = ++peticionRef.current;
      const fresca = await hojaService.hoja(fecha, destino);
      if (peticionRef.current === folio) setHoja(fresca);
      await cargarDestinos();
    } catch (e: any) { setError(e?.message || 'No se cobró'); }
    finally { setOcupado(false); setAccion(null); }
  };

  // Un paso de camioneta: pide, y si nadie ganó la carrera mientras tanto pinta la
  // hoja que regresa (misma guarda de folio que `abrir`).
  const ejecutar = async (paso: (h: Hoja) => Promise<Hoja>, siFalla: string) => {
    if (!hoja) return;
    setOcupado(true);
    try {
      const folio = ++peticionRef.current;
      const nueva = await paso(hoja);
      olvidar(hoja.destino, ['enviado', 'merma']);
      if (peticionRef.current === folio) setHoja(nueva);
      await cargarDestinos();
    } catch (e: any) { setError(e?.message || siFalla); }
    finally { setOcupado(false); setAccion(null); }
  };

  // Confirmar el envío guarda antes lo tecleado, igual que cobrar (C1).
  const confirmarEnvio = () => ejecutar(async h => {
    const renglones = cambiosPendientes(h);
    if (renglones.length) await hojaService.guardar(fecha, h.destino, renglones);
    return hojaService.confirmarEnvio(fecha, h.destino);
  }, 'No se confirmó el envío');
  const reabrirEnvio = () => ejecutar(h => hojaService.reabrirEnvio(fecha, h.destino), 'No se reabrió el envío');
  const guardarMerma = () => ejecutar(h => hojaService.guardarMerma(fecha, h.destino, mermaPendiente), 'No se guardó la merma');

  return (
    <Layout>
      <div className="hoja-dia">
        {/* cabecera como Compras (24-sep): rombo + título + subtítulo en una línea, pestañas a la derecha */}
        <header className="hoja-dia__cabecera">
          <div className="hoja-dia__titulo">
            <h1>Hoja del día</h1>
            <span className="hoja-dia__sub">Cobrar lo que se llevó cada destino</span>
          </div>
          <div className="hoja-tabs" role="tablist" aria-label="Vista">
            <button type="button" role="tab" aria-selected={vista === 'captura'}
              className={`hoja-tab${vista === 'captura' ? ' hoja-tab--activa' : ''}`} onClick={() => setVista('captura')}>
              Captura del día
            </button>
            <button type="button" role="tab" aria-selected={vista === 'estado'}
              className={`hoja-tab${vista === 'estado' ? ' hoja-tab--activa' : ''}`} onClick={() => setVista('estado')}>
              Estado de cuenta
            </button>
          </div>
        </header>

        {vista === 'captura' && (
        <div className="hoja-dia__filtros hoja-toolbar">
          <label className="hoja-dia__campo hoja-dia__campo--destino">
            Destino
            <select value={elegido} disabled={ocupado || !destinos.length} onChange={e => abrir(e.target.value)}>
              <option value="">{destinos.length ? 'Elige cliente, camioneta, sucursal o pueblo' : 'Sin destinos para esta fecha'}</option>
              {[...grupos.entries()].map(([grupo, lista]) => (
                <optgroup key={grupo} label={grupo}>
                  {lista.map(d => (
                    <option key={d.destino} value={d.destino}>
                      {`${d.destino} · ${ESTADO[d.estado]} · ${pesos(d.camioneta ? d.se_debe : d.total)}${borrador[fecha]?.[d.destino] ? ' · sin guardar' : ''}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="hoja-dia__campo">
            Fecha
            <input type="date" value={fecha} disabled={ocupado} onChange={e => setFecha(e.target.value)} />
          </label>
          {porGuardar > 0 && (
            <button type="button" className="hoja-btn hoja-btn--primario hoja-btn--todo" onClick={guardarTodo} disabled={ocupado}>
              Guardar todo ({porGuardar})
            </button>
          )}
        </div>
        )}

        {vista === 'estado' && <EstadoCuentaHoja />}

        {vista === 'captura' && hoja && (
          <section className="hoja-dia__detalle">
            <div className="hoja-dia__detalle-cabecera">
              <h2>{hoja.destino}</h2>
              {estadoElegido && <span className={`hoja-badge ${ESTADO_CLASE[estadoElegido]}`}>{ESTADO[estadoElegido]}</span>}
              {cobrado && hoja.factura && (
                <p className="hoja-dia__cobrado">
                  Cobrado · {hoja.factura.name} · saldo {pesos(hoja.factura.outstanding_amount)}
                </p>
              )}
            </div>

            {/* 4 columnas con el acomodo del Excel (COLUMNAS_HOJA, 23-sep) */}
            {hojasDeColumnas.map((cols, h) => (
              <div key={h} className={`hoja-bloques${hoja.camioneta ? ' hoja-bloques--camioneta' : ''}`}>
                {cols.map((col, i) => (
                  <div key={i} className="hoja-columna">
                    {col.map(b => (
                      <div key={b.categoria} className="hoja-bloque">
                        <h3>{b.categoria}</h3>
                        <table className="hoja-tabla">
                          <thead>
                            <tr>
                              <th>CLAVE</th><th>PRODUCTO</th><th>$</th><th>PEDIDO</th><th>ENVIADO</th>
                              {hoja.camioneta && (<><th>REGRESO</th><th>MERMA</th><th>VENDIDO</th></>)}
                              <th>IMPORTE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.renglones.map(r => {
                              const enviadoActual = r.item_code in captura ? cantidad(captura[r.item_code]) : r.enviado;
                              const mermaActual = r.item_code in capturaMerma ? cantidad(capturaMerma[r.item_code]) : r.merma;
                              // se cobra lo VENDIDO (23-sep: en camioneta IMPORTE enseñaba enviado × $), y se
                              // ve al teclear la merma. Cliente/sucursal no tienen regreso ni merma: vendido = enviado
                              const vendido = enviadoActual - r.regreso - mermaActual;
                              return (
                                <tr key={r.item_code} className={!r.pedido && !enviadoActual ? 'hoja-fila--sin-pedido' : undefined}>
                                  <td className="hoja-celda--clave">{r.item_code}</td>
                                  <td>{r.producto}</td>
                                  <td className="hoja-celda--num">{pesos(r.precio)}</td>
                                  <td className="hoja-celda--num">{numero(r.pedido, 0)}</td>
                                  <td>
                                    <input
                                      type="number"
                                      min={0}
                                      className={enviadoActual > 0 ? 'hoja-input--lleno' : undefined}
                                      aria-label={`Enviado ${r.producto}`}
                                      value={captura[r.item_code] ?? String(r.enviado)}
                                      disabled={enviadoFijo || ocupado}
                                      onChange={e => setBorrador(b => conTecleado(b, fecha, hoja.destino, 'enviado', r.item_code, e.target.value))}
                                    />
                                  </td>
                                  {hoja.camioneta && (
                                    <>
                                      <td className="hoja-celda--num">{numero(r.regreso, 0)}</td>
                                      <td>
                                        {mermaAbierta && r.enviado > 0 ? (
                                          <input
                                            type="number"
                                            min={0}
                                            aria-label={`Merma ${r.producto}`}
                                            value={capturaMerma[r.item_code] ?? String(r.merma)}
                                            onChange={e => setBorrador(b => conTecleado(b, fecha, hoja.destino, 'merma', r.item_code, e.target.value))}
                                          />
                                        ) : numero(r.merma, 0)}
                                      </td>
                                      <td className="hoja-celda--num">{numero(vendido, 0)}</td>
                                    </>
                                  )}
                                  <td className={`hoja-celda--num hoja-celda--importe${vendido * r.precio > 0 ? ' hoja-celda--cobra' : ''}`}>{pesos(vendido * r.precio)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {hoja.camioneta && (
              <div className="hoja-resumen-camioneta">
                <div><span>Venta</span><strong>{pesos(hoja.total)}</strong></div>
                {/* Comisión partida en dos renglones (Diemar 22-sep, addendum
                    fix round 1): solo de DESPLIEGUE — la autoridad sigue
                    siendo `hoja.comision` del servidor; aquí nada más se
                    reparte lo que ya vino (10% variable + cuota fija). Sin
                    venta no hay comisión que repartir: no se pintan las dos
                    líneas. */}
                {hoja.comision > 0 && (
                  <>
                    {/* con la excepción la comisión viene topada a lo vendido: el 10% sale del sueldo completo */}
                    <div><span>Comisión 10%</span><strong>{pesos(hoja.comision + (hoja.a_favor ?? 0) - COMISION_FIJA)}</strong></div>
                    <div><span>Cuota fija</span><strong>{pesos(COMISION_FIJA)}</strong></div>
                  </>
                )}
                <div><span>Se debe</span><strong>{pesos(hoja.se_debe)}</strong></div>
                {(hoja.a_favor ?? 0) > 0 && (
                  <p className="hoja-dia__aviso hoja-dia__aviso--a-favor" role="note">
                    La comisión ({pesos(hoja.comision + hoja.a_favor)}) rebasa la venta ({pesos(hoja.total)}):
                    la panadería le debe {pesos(hoja.a_favor)} a {hoja.destino}. Págalo por nómina.
                  </p>
                )}
              </div>
            )}

            <div className="hoja-dia__total">
              <span>{hoja.camioneta ? 'Total enviado' : 'Total'}</span>
              <strong>{pesos(total)}</strong>
            </div>

            {!cobrado && !enviadoFijo && (
              <div className="hoja-dia__acciones">
                <button type="button" className="hoja-btn hoja-btn--secundario" onClick={guardar} disabled={ocupado}>
                  Guardar
                </button>
                <button type="button" className="hoja-btn hoja-btn--primario" onClick={() => setAccion(hoja.camioneta ? 'envio' : 'cobrar')} disabled={ocupado}>
                  {hoja.camioneta ? 'Confirmar envío' : 'Confirmar y cobrar'}
                </button>
              </div>
            )}

            {!cobrado && etapa === 'enviado' && (
              <div className="hoja-dia__acciones">
                <p className="hoja-dia__aviso">En ruta: esperando que {hoja.destino} capture lo que regresa.</p>
                <button type="button" className="hoja-btn hoja-btn--secundario" onClick={reabrirEnvio} disabled={ocupado}>
                  Reabrir envío
                </button>
              </div>
            )}

            {mermaAbierta && (
              <div className="hoja-dia__acciones">
                {mermaPendiente.length > 0 && <p className="hoja-dia__aviso">Guarda la merma antes de cobrar.</p>}
                <button type="button" className="hoja-btn hoja-btn--secundario" onClick={guardarMerma} disabled={ocupado || !mermaPendiente.length}>
                  Guardar merma
                </button>
                <button type="button" className="hoja-btn hoja-btn--primario" onClick={() => setAccion('cobrar')} disabled={ocupado || mermaPendiente.length > 0}>
                  Confirmar y cobrar
                </button>
              </div>
            )}
          </section>
        )}

        {accion && hoja && (
          <ConfirmModal
            title={accion === 'envio' ? 'Confirmar envío' : 'Cobrar destino'}
            description={accion === 'envio'
              ? `¿Confirmar lo que se lleva ${hoja.destino}? Lo enviado queda fijo y ${hoja.destino} ya podrá capturar lo que regresa.`
              // camioneta: lo que se debe (vendido − comisión) del servidor, con la merma ya guardada
              : `¿Cobrar ${pesos(hoja.camioneta ? hoja.se_debe : total)} a ${hoja.destino}? Se genera la factura.`
                + ((hoja.a_favor ?? 0) > 0 ? ` La panadería le debe ${pesos(hoja.a_favor)} a ${hoja.destino} (por nómina).` : '')}
            subdescription={undefined}
            icon={undefined}
            iconStyle={undefined}
            confirmLabel={accion === 'envio' ? 'Confirmar envío' : 'Cobrar'}
            confirmClassName={undefined}
            confirmStyle={undefined}
            loading={ocupado}
            error={undefined}
            onFallback={undefined}
            fallbackLabel={undefined}
            fallbackDescription={undefined}
            passwordPrompt={undefined}
            onConfirm={accion === 'envio' ? confirmarEnvio : cobrar}
            onCancel={() => setAccion(null)}
          />
        )}

        <ModalError isOpen={Boolean(error)} message={error} onClose={() => setError('')} />
      </div>
    </Layout>
  );
}
