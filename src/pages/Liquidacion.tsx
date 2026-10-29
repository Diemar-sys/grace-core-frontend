// src/pages/Liquidacion.tsx
// Liquidación del repartidor SOBRE LA HOJA (22-sep): sin inventario de
// camioneta, sin almacén de regreso — no hay a dónde regresar porque ya no
// hay traspaso. El repartidor teclea la MERMA: lo que trae de vuelta (30-sep,
// Diemar: «merma y regresó es lo mismo»). Héctor la confirma o corrige en la
// Hoja del día antes de cobrar. La hoja solo aparece después de que matriz
// confirma el envío (etapa de la camioneta).
//
// La venta no se teclea: sale por diferencia (enviado − merma), en
// una VISTA PREVIA calculada en el render con funciones puras — nada de
// `useEffect` escribiendo estado derivado, que fue el bug de `precio_final`
// que viajó desfasado al servidor el 17-ago.
//
// El servidor manda: `guardarRegreso` REEMPLAZA la merma de cada
// renglón (no suma), así que siempre se mandan TODOS los renglones de la
// hoja, no solo los tecleados. Una vez que matriz confirma y factura el
// destino (`hoja.factura`), la hoja queda de solo lectura.
//
// 12-oct (Diemar): pensada para el celular — un renglón es una tarjeta, no una fila de
// tabla — y los sabores que cuestan igual (polvorón, muerto) van en UN renglón: se teclea
// el total del grupo y `repartirMerma` lo reparte por pan (`utils/mermaAgrupada`).
//
// 13-oct (Diemar): la merma se manda UNA vez. Ya enviada (`etapa` «liquidado») es de Héctor:
// queda de solo lectura, igual que cobrada (el servidor también la rechaza). La casilla va
// verde con merma 0 (desde que abre) y roja en cuanto lleva algo.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { hoyISO } from '../utils/hora';
import { hojaService, type Hoja } from '../services/frappeHoja';
import { cantidad, excesos, previsualizar, type ResumenRuta } from '../utils/cierreRuta';
import { agruparRenglones, mermaPorGrupo, repartirMerma } from '../utils/mermaAgrupada';
import { COMISION_FIJA } from '../utils/liquidacion';
import { numero, pesos } from '../utils/formato';
import { coincidePan, normalizarBusqueda } from '../utils/buscarPan';
import '../styles/global.css';
import '../styles/Liquidacion.css';

function Liquidacion() {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  // Lo tecleado, por GRUPO (un pan suelto es un grupo de uno). Texto, no número.
  const [porGrupo, setPorGrupo] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // 29-oct: buscador; solo filtra lo que se pinta (enviar manda todos los renglones)
  const [busqueda, setBusqueda] = useState('');
  const buscado = normalizarBusqueda(busqueda);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  // El repartidor elige el día (28-sep: MARTIN no pudo liquidar el viernes el
  // lunes). El servidor amarra la camioneta a su sesión; aquí solo va la fecha.
  const [fecha, setFecha] = useState(hoyISO());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const h = await hojaService.miHoja(fecha);
      setHoja(h);
      setPorGrupo(mermaPorGrupo(agruparRenglones(h.renglones), h.renglones));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar tu hoja');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  // Todo lo derivado se calcula en el render. Si viviera en estado, quedaría un
  // ciclo atrás de lo que el repartidor está viendo.
  const resumen: ResumenRuta = useMemo(() => ({
    salidas: (hoja?.renglones ?? []).map(r => ({
      item_code: r.item_code, item_name: r.producto, qty: r.enviado, precio: r.precio,
    })),
    regresos: [],
    mermas: [],
  }), [hoja]);

  const grupos = useMemo(() => agruparRenglones(hoja?.renglones ?? []), [hoja]);
  const captura = useMemo(() => repartirMerma(grupos, porGrupo), [grupos, porGrupo]);
  const liq = useMemo(() => previsualizar(resumen, captura), [resumen, captura]);
  // vendido e importe del grupo = suma de sus panes (O(n) con un Map)
  const porItem = useMemo(() => new Map(liq.renglones.map(r => [r.item_code, r])), [liq]);
  const malos = useMemo(() => excesos(resumen.salidas, captura), [resumen, captura]);

  const cobrado = Boolean(hoja?.factura);
  const enviada = hoja?.etapa === 'liquidado';
  const soloLectura = cobrado || enviada;
  const renglones = hoja?.renglones ?? [];

  // Se guarda el TEXTO, no el número: "1." a medio teclear tiene que poder
  // seguir escribiéndose, y un campo vacío no es un cero.
  const teclear = (clave: string, valor: string) => setPorGrupo(prev => ({ ...prev, [clave]: valor }));

  const enviar = async () => {
    if (!hoja) return;
    setGuardando(true);
    setError('');
    setExito(false);
    try {
      // TODOS los renglones: el servidor reemplaza, no suma. Mandar solo los
      // tecleados borraría (a ceros) lo que ya estaba guardado del lado del
      // servidor en un envío previo.
      const paraGuardar = hoja.renglones.map(r => ({
        item_code: r.item_code,
        merma: cantidad(captura[r.item_code]?.tiro),
      }));
      const h = await hojaService.guardarRegreso(fecha, paraGuardar);
      setHoja(h);
      setExito(true);
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Layout>
      <div className="liq">
        <header className="liq-cabecera">
          <div>
            <h1 className="liq-titulo">Liquidación</h1>
            <p className="liq-sub">
              {hoja ? hoja.destino : 'Cargando tu hoja…'}
            </p>
          </div>
          <input
            className="liq-input liq-fecha" type="date" aria-label="Día"
            value={fecha} max={hoyISO()} disabled={guardando}
            onChange={e => { if (e.target.value) { setExito(false); setFecha(e.target.value); } }}
          />
          {cobrado && (
            <span className="liq-badge liq-badge--aviso">
              Cobrado{hoja?.factura ? ` · ${hoja.factura.name} · saldo ${pesos(hoja.factura.outstanding_amount)}` : ''}
            </span>
          )}
          {enviada && !cobrado && (
            <span className="liq-badge liq-badge--aviso">Enviada a matriz · si hay error, avisarle al responsable del área</span>
          )}
        </header>

        {error && <div className="liq-aviso liq-aviso--error" role="alert">{error}</div>}
        {exito && !error && <div className="liq-aviso liq-aviso--ok" role="status">Enviado a matriz</div>}

        {/* El desglose (10% + cuota fija) es SOLO de pantalla, para que el
            repartidor vea de dónde sale la comisión. La autoridad sigue siendo
            `calcularLiquidacion` (espejo del backend): aquí solo se resta
            COMISION_FIJA de `liq.comision`, nunca se recalcula el total. */}
        <section className="liq-totales">
          <article className="liq-stat">
            <span className="liq-stat-label">Venta</span>
            <strong className="liq-stat-valor">{pesos(liq.totalVenta)}</strong>
          </article>
          {liq.comision > 0 && (
            <>
              <article className="liq-stat">
                <span className="liq-stat-label">Comisión 10%</span>
                <strong className="liq-stat-valor liq-stat-valor--resta">{pesos(liq.comision - COMISION_FIJA)}</strong>
              </article>
              <article className="liq-stat">
                <span className="liq-stat-label">Cuota fija</span>
                <strong className="liq-stat-valor liq-stat-valor--resta">{pesos(COMISION_FIJA)}</strong>
              </article>
            </>
          )}
          <article className="liq-stat liq-stat--fuerte">
            <span className="liq-stat-label">Se debe</span>
            <strong className="liq-stat-valor">{pesos(liq.neto)}</strong>
          </article>
          {liq.aFavor > 0 && (
            <article className="liq-stat">
              <span className="liq-stat-label">A tu favor</span>
              <strong className="liq-stat-valor">{pesos(liq.aFavor)}</strong>
            </article>
          )}
        </section>

        {liq.inconsistentes.length > 0 && (
          <div className="liq-aviso liq-aviso--error">
            Estos productos tienen más merma de lo que salió:{' '}
            {liq.inconsistentes.map(r => r.item_name).join(', ')}
          </div>
        )}

        <section className="liq-tarjeta">
          {cargando && <p className="liq-vacio">Cargando…</p>}
          {!cargando && renglones.length === 0 && (
            <p className="liq-vacio">
              {hoja && !hoja.etapa && !cobrado
                ? 'Todavía no te envían pan: cuando matriz confirme tu envío, aquí aparece lo que llevas.'
                : 'Ese día no tienes hoja.'}
            </p>
          )}

          {renglones.length > 0 && (
            <input type="search" className="buscador-pan" placeholder="Buscar pan o clave" aria-label="Buscar pan"
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          )}
          {renglones.length > 0 && (
            <ul className="liq-lista">
              {grupos.filter(g => coincidePan(buscado, g.nombre, g.detalle)).map(g => {
                const filas = g.items.map(i => porItem.get(i.item_code)).filter(r => r !== undefined);
                const vendido = filas.reduce((t, r) => t + r.vendido, 0);
                const importe = filas.reduce((t, r) => t + r.importe, 0);
                const malo = g.items.some(i => malos.includes(i.item_code));
                return (
                  <li key={g.clave} className={`liq-renglon${malo ? ' liq-renglon--malo' : ''}`}>
                    <div className="liq-renglon-nombre">
                      <span className="liq-producto">{g.nombre}</span>
                      <span className="liq-clave">{g.detalle}</span>
                    </div>
                    <div className="liq-renglon-dato">
                      <span className="liq-dato-label">Enviado</span>
                      <span className="liq-num">{numero(g.enviado, 0)}</span>
                    </div>
                    <label className="liq-renglon-dato">
                      <span className="liq-dato-label">Merma</span>
                      <input
                        className={`liq-input ${cantidad(porGrupo[g.clave]) > 0 ? 'liq-input--con-merma' : 'liq-input--sin-merma'}`}
                        type="text" inputMode="decimal"
                        aria-label={`Merma ${g.nombre}`}
                        placeholder="0" value={porGrupo[g.clave] ?? ''}
                        disabled={soloLectura}
                        onChange={e => teclear(g.clave, e.target.value)}
                      />
                    </label>
                    <div className="liq-renglon-dato">
                      <span className="liq-dato-label">Vendido</span>
                      <span className="liq-num liq-vendido">{numero(vendido, 0)}</span>
                    </div>
                    <div className="liq-renglon-dato">
                      <span className="liq-dato-label">Importe</span>
                      <span className="liq-num">{pesos(importe)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {renglones.length > 0 && !soloLectura && (
          <footer className="liq-pie">
            <button
              type="button" className="liq-btn" onClick={enviar}
              disabled={guardando || malos.length > 0}
            >
              {guardando ? 'Enviando…' : 'Enviar a matriz'}
            </button>
          </footer>
        )}
      </div>
    </Layout>
  );
}

export default Liquidacion;
