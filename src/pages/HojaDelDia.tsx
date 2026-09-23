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
import { hoyISO } from '../components/modals/ModalEntradaPan';
import { hojaService, type DestinoDia, type Hoja } from '../services/frappeHoja';
import { bloquesDeHoja, cambiosEnviado, cantidad, totalCapturado } from '../utils/hojaDia';
import { COMISION_FIJA } from '../utils/liquidacion';
import { numero, pesos } from '../utils/formato';
import '../styles/global.css';
import '../styles/HojaDelDia.css';

const ESTADO: Record<DestinoDia['estado'], string> = {
  sin_capturar: 'Sin capturar', sin_confirmar: 'Sin confirmar', confirmado: 'Cobrado',
};

const ESTADO_CLASE: Record<DestinoDia['estado'], string> = {
  sin_capturar: 'hoja-badge--gris', sin_confirmar: 'hoja-badge--ambar', confirmado: 'hoja-badge--verde',
};

export default function HojaDelDia() {
  const [fecha, setFecha] = useState(hoyISO());
  const [destinos, setDestinos] = useState<DestinoDia[]>([]);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [captura, setCaptura] = useState<Record<string, string>>({});
  const [elegido, setElegido] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

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

  useEffect(() => { peticionRef.current++; setHoja(null); setCaptura({}); setElegido(''); cargarDestinos(); }, [cargarDestinos]);

  const abrir = async (destino: string) => {
    setElegido(destino);
    if (!destino) return;
    const folio = ++peticionRef.current;
    try {
      const h = await hojaService.hoja(fecha, destino);
      if (peticionRef.current !== folio) return; // ya se abrió otro destino/fecha
      setHoja(h); setCaptura({});
    } catch (e: any) {
      if (peticionRef.current !== folio) return;
      setError(e?.message || 'No se pudo abrir la hoja');
    }
  };

  // Lo que falta guardar: solo los renglones cuyo tecleado cambió.
  const cambiosPendientes = (h: Hoja) => cambiosEnviado(h.renglones, captura);

  // Guarda en el servidor y, si nadie más ganó la carrera mientras tanto,
  // pinta la hoja que regresa. La usan tanto el botón «Guardar» como
  // «Confirmar y cobrar» (C1): cobrar SIEMPRE pasa por aquí primero.
  const guardarEnServidor = async (destino: string, renglones: { item_code: string; enviado: number }[]) => {
    const folio = ++peticionRef.current;
    const actualizada = await hojaService.guardar(fecha, destino, renglones);
    if (peticionRef.current === folio) { setHoja(actualizada); setCaptura({}); }
    return actualizada;
  };

  const cobrado = Boolean(hoja?.factura);
  const estadoElegido = destinos.find(d => d.destino === hoja?.destino)?.estado;
  const bloques = useMemo(() => (hoja ? bloquesDeHoja(hoja.renglones) : []), [hoja]);
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
      const folio = ++peticionRef.current;
      const fresca = await hojaService.hoja(fecha, destino);
      if (peticionRef.current === folio) setHoja(fresca);
      await cargarDestinos();
    } catch (e: any) { setError(e?.message || 'No se cobró'); }
    finally { setOcupado(false); setConfirmando(false); }
  };

  return (
    <Layout>
      <div className="hoja-dia">
        <header className="hoja-dia__cabecera">
          <div>
            <h1>Hoja del día</h1>
            <p className="hoja-dia__sub">Cobrar lo que se llevó cada destino</p>
          </div>
          <div className="hoja-dia__filtros">
            <label className="hoja-dia__campo hoja-dia__campo--destino">
              Destino
              <select value={elegido} disabled={ocupado || !destinos.length} onChange={e => abrir(e.target.value)}>
                <option value="">{destinos.length ? 'Elige cliente, camioneta, sucursal o pueblo' : 'Sin destinos para esta fecha'}</option>
                {[...grupos.entries()].map(([grupo, lista]) => (
                  <optgroup key={grupo} label={grupo}>
                    {lista.map(d => (
                      <option key={d.destino} value={d.destino}>
                        {`${d.destino} · ${ESTADO[d.estado]} · ${pesos(d.camioneta ? d.se_debe : d.total)}`}
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
          </div>
        </header>

        {hoja && (
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

            {bloques.map(b => (
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
                      const vendido = r.enviado - r.regreso - r.merma;
                      return (
                        <tr key={r.item_code} className={!r.pedido && !enviadoActual ? 'hoja-fila--sin-pedido' : undefined}>
                          <td>{r.item_code}</td>
                          <td>{r.producto}</td>
                          <td>{pesos(r.precio)}</td>
                          <td>{numero(r.pedido, 0)}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              aria-label={`Enviado ${r.producto}`}
                              value={captura[r.item_code] ?? String(r.enviado)}
                              disabled={cobrado}
                              onChange={e => setCaptura(c => ({ ...c, [r.item_code]: e.target.value }))}
                            />
                          </td>
                          {hoja.camioneta && (
                            <>
                              <td>{numero(r.regreso, 0)}</td>
                              <td>{numero(r.merma, 0)}</td>
                              <td>{numero(vendido, 0)}</td>
                            </>
                          )}
                          <td>{pesos(enviadoActual * r.precio)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                    <div><span>Comisión 10%</span><strong>{pesos(hoja.comision - COMISION_FIJA)}</strong></div>
                    <div><span>Cuota fija</span><strong>{pesos(COMISION_FIJA)}</strong></div>
                  </>
                )}
                <div><span>Se debe</span><strong>{pesos(hoja.se_debe)}</strong></div>
              </div>
            )}

            <div className="hoja-dia__total">Total: {pesos(total)}</div>

            {!cobrado && (
              <div className="hoja-dia__acciones">
                <button type="button" className="hoja-btn hoja-btn--secundario" onClick={guardar} disabled={ocupado}>
                  Guardar
                </button>
                <button type="button" className="hoja-btn hoja-btn--primario" onClick={() => setConfirmando(true)} disabled={ocupado}>
                  Confirmar y cobrar
                </button>
              </div>
            )}
          </section>
        )}

        {confirmando && hoja && (
          <ConfirmModal
            title="Cobrar destino"
            description={`¿Cobrar ${pesos(total)} a ${hoja.destino}? Se genera la factura.`}
            subdescription={undefined}
            icon={undefined}
            iconStyle={undefined}
            confirmLabel="Cobrar"
            confirmClassName={undefined}
            confirmStyle={undefined}
            loading={ocupado}
            error={undefined}
            onFallback={undefined}
            fallbackLabel={undefined}
            fallbackDescription={undefined}
            passwordPrompt={undefined}
            onConfirm={cobrar}
            onCancel={() => setConfirmando(false)}
          />
        )}

        <ModalError isOpen={Boolean(error)} message={error} onClose={() => setError('')} />
      </div>
    </Layout>
  );
}
