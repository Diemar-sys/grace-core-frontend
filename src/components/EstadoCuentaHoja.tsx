// Estado de cuenta de la Hoja del día (Diemar 23-sep): por destino, un renglón por
// día cobrado. Camioneta: VENTA | COMISIÓN 10% | AYUDANTE | SUELDO | RECIBIR/PAGAR |
// PAGADO/ABONO. Cliente, sucursal y pueblo no llevan comisión: VENTA | RECIBIR |
// PAGADO/ABONO. Los números salen de las facturas (servidor); aquí no se calcula
// dinero. «Cobrar» abre el MISMO modal que Venta B2B → Cobrar: un solo camino.
// 09-oct: LIQUIDADO, última columna — lo que Eva le entregó a Luis de lo cobrado ese día
// (un segundo cobro: no cambia lo que debe el destino). Solo lo teclean Administrator y
// luis.th: lo dice el servidor (`puede_liquidar`), y la diferencia (`eva_debe`) también.
// 20-oct (Diemar): rango libre Desde/Hasta en vez de «la semana del día elegido». Arranca
// en la semana de hoy; el tope es el del servidor (MAX_DIAS_ESTADO + 1 = 32 días).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalRegistrarPago from './modals/ModalRegistrarPago';
import ModalError from './modals/ModalError';
import { hoyISO, rangoFechas } from '../utils/hora';
import { hojaService, type DeudorHoja, type DiaCuenta, type EstadoCuenta } from '../services/frappeHoja';
import { grupoCobro, ventasService } from '../services/frappeSales';
import { semanaDe } from '../utils/hojaDia';
import { pesos } from '../utils/formato';

/** Lo que acepta `hoja_api.estado_cuenta` (MAX_DIAS_ESTADO + 1). */
export const MAX_DIAS_RANGO = 32;

/** Días del rango contando los dos extremos (fechas ISO, sin hora: sin brinco de UTC). */
export const diasDelRango = (desde: string, hasta: string) => (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1;

const ESTADO_DIA: Record<DiaCuenta['estado'], [string, string]> = {
  // «PAGADO» (antes «LIQUIDADO»): LIQUIDADO es ahora la columna de lo que Eva entregó
  liquidado: ['PAGADO', 'hoja-badge--verde'],
  abono: ['ABONÓ', 'hoja-badge--ambar'],
  pendiente: ['PENDIENTE', 'hoja-badge--rojo'],
};

function PagadoAbono({ d }: { d: Pick<DiaCuenta, 'estado' | 'pagado' | 'debe' | 'a_favor'> }) {
  const [texto, clase] = ESTADO_DIA[d.estado];
  return (
    <span className="hoja-estado__pago">
      <span className={`hoja-badge ${clase}`}>{texto}</span>
      {d.estado !== 'liquidado' && <span>Debe {pesos(d.debe)}</span>}
      {d.estado === 'abono' && <span className="hoja-estado__abono">abonó {pesos(d.pagado)}</span>}
      {/* excepción 23-sep: vendió menos que su sueldo; la panadería le debe la diferencia */}
      {d.a_favor > 0 && <span className="hoja-badge hoja-badge--azul">A FAVOR {pesos(d.a_favor)}</span>}
    </span>
  );
}

// 27-oct: egresos que Eva pagó con lo cobrado (la pipa con lo de GUSTAVO), con folio y quién lo
// capturó: es lo que Luis revisa. El monto del día es la parte que cayó aquí (un egreso grande se
// reparte entre los días de su cobro); el folio enseña el egreso completo.
function Egresos({ d }: { d: Pick<DiaCuenta, 'egreso' | 'egresos'> }) {
  if (!d.egreso) return <span className="text-muted">—</span>;
  return (
    <span className="hoja-estado__egreso">
      <strong>−{pesos(d.egreso)}</strong>
      {d.egresos?.map(e => (
        <small key={e.egreso} title={`${e.concepto ?? ''} · cobro ${e.cobro}`}>
          {e.egreso} · {e.subcategoria ?? e.concepto} {pesos(e.monto)} · {e.capturo.split('@')[0]} {e.cuando.slice(5)}
        </small>
      ))}
    </span>
  );
}

function Liquidado({ d }: { d: Pick<DiaCuenta, 'pagado' | 'liquidado' | 'eva_debe' | 'por_entregar'> }) {
  if (d.pagado <= 0) return <span className="hoja-estado__sin">—</span>;
  // 27-oct: sin liquidar dice cuánto esperar (cobrado − egresos que Eva pagó con eso; del servidor)
  if (d.liquidado == null || d.eva_debe == null) {
    return <span className="hoja-badge hoja-badge--ambar">POR ENTREGAR {pesos(d.por_entregar ?? d.pagado)}</span>;
  }
  if (d.eva_debe > 0) return <span className="hoja-badge hoja-badge--rojo">EVA DEBE {pesos(d.eva_debe)}</span>;
  if (d.eva_debe < 0) return <span className="hoja-badge hoja-badge--azul">SOBRA {pesos(-d.eva_debe)}</span>;
  return <span className="hoja-badge hoja-badge--verde">ENTREGÓ TODO</span>;
}

export default function EstadoCuentaHoja() {
  const [deudores, setDeudores] = useState<DeudorHoja[]>([]);
  const [destino, setDestino] = useState('');
  const [rango, setRango] = useState(() => semanaDe(hoyISO()));
  const { desde, hasta } = rango;
  const dias = diasDelRango(desde, hasta);
  const rangoMal = dias < 1 ? '«Hasta» va después de «Desde».'
    : dias > MAX_DIAS_RANGO ? `Máximo ${MAX_DIAS_RANGO} días por consulta.` : '';
  const [estado, setEstado] = useState<EstadoCuenta | null>(null);
  const [pagoModal, setPagoModal] = useState<ReturnType<typeof grupoCobro>>(null);
  const [error, setError] = useState('');
  const peticionRef = useRef(0);
  // lo tecleado en LIQUIDADO sin guardar, por factura
  const [tecleoLiq, setTecleoLiq] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState('');

  useEffect(() => {
    hojaService.deudores().then(setDeudores).catch((e: any) => setError(e?.message || 'No se pudo leer la lista'));
  }, []);

  const cargar = useCallback(async () => {
    const folio = ++peticionRef.current;
    if (!destino || rangoMal) { setEstado(null); return; }
    try {
      const e = await hojaService.estadoCuenta(destino, desde, hasta);
      if (peticionRef.current === folio) setEstado(e);   // una respuesta vieja no pisa la nueva
    } catch (e: any) {
      if (peticionRef.current === folio) setError(e?.message || 'No se pudo leer el estado de cuenta');
    }
  }, [destino, desde, hasta, rangoMal]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setTecleoLiq({}); }, [destino, desde, hasta]);

  const liquidar = async (factura: string) => {
    const texto = tecleoLiq[factura];
    if (texto == null || texto.trim() === '') return;
    setGuardando(factura);
    try {
      await hojaService.liquidar(factura, Number(texto));
      setTecleoLiq(({ [factura]: _, ...resto }) => resto);
      await cargar();
    } catch (e: any) { setError(e?.message || 'No se guardó lo liquidado'); }
    finally { setGuardando(''); }
  };

  const grupos = useMemo(() => {
    const m = new Map<string, DeudorHoja[]>();
    for (const d of deudores) {
      const lista = m.get(d.grupo);
      if (lista) lista.push(d); else m.set(d.grupo, [d]);
    }
    return m;
  }, [deudores]);

  const cobrar = async () => {
    if (!estado) return;
    try {
      // todas las facturas de PAN con saldo de ese deudor, como en Venta B2B → Cobrar (filtro PAN)
      const facturas = await ventasService.getFacturasPendientes({ customer: estado.cliente, tipo: 'pan' });
      const grupo = grupoCobro(estado.cliente, estado.cliente, facturas);
      if (!grupo) { setError(`${estado.cliente} no debe nada de pan.`); cargar(); return; }
      setPagoModal(grupo);
    } catch (e: any) { setError(e?.message || 'No se pudo abrir el cobro'); }
  };

  const camioneta = Boolean(estado?.camioneta);
  // 15-oct: DELI/ZAKIA llevan descuento; la columna solo sale si en el rango hubo (camioneta: 0)
  const conDescuento = (estado?.total.descuento ?? 0) > 0;
  const conEgreso = (estado?.total.egreso ?? 0) > 0;   // 27-oct: solo si Eva pagó algo con lo cobrado
  // 27-oct: lo que Eva cobró y no ha entregado: lo de días sin liquidar + lo que quedó a deber al liquidar
  const faltaEntregar = (estado?.total.por_entregar ?? 0) + (estado?.total.eva_debe ?? 0);
  const conCaja = conEgreso || (estado?.total.liquidado ?? 0) > 0;
  const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

  return (
    <section className="hoja-estado">
      <div className="hoja-dia__filtros hoja-toolbar">
        <label className="hoja-dia__campo hoja-dia__campo--destino">
          Destino
          <select value={destino} onChange={e => setDestino(e.target.value)}>
            <option value="">Elige cliente, camioneta, sucursal o pueblo</option>
            {[...grupos.entries()].map(([grupo, lista]) => (
              <optgroup key={grupo} label={grupo}>
                {lista.map(d => <option key={d.destino} value={d.destino}>{d.destino}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="hoja-dia__campo">
          Desde
          <input type="date" value={desde} max={hasta} onChange={e => { const v = e.target.value; if (v) setRango(x => ({ ...x, desde: v })); }} />
        </label>
        <label className="hoja-dia__campo">
          Hasta
          <input type="date" value={hasta} min={desde} onChange={e => { const v = e.target.value; if (v) setRango(x => ({ ...x, hasta: v })); }} />
        </label>
        <strong className="hoja-estado__rango">{rangoMal || `${rangoFechas(desde, hasta)} · ${dias} ${dias === 1 ? 'día' : 'días'}`}</strong>
      </div>

      {estado && (
        <div className="hoja-dia__detalle hoja-estado__detalle">
          <header className="hoja-estado__cabecera">
            <div className="hoja-estado__nombre">
              <h2 className="hoja-estado__titulo">{estado.destino}</h2>
              <span className="hoja-estado__cliente">{estado.cliente}</span>
            </div>
            {estado.total.debe > 0 && (
              <button type="button" className="hoja-btn hoja-btn--primario hoja-estado__cobrar" onClick={cobrar}>Cobrar</button>
            )}
          </header>

          {/* resumen del rango: los totales vienen del servidor, aquí no se suma dinero */}
          <div className="hoja-estado__resumen">
            <div className="hoja-estado__stat">
              <span className="hoja-estado__stat-label">Venta del periodo</span>
              <span className="hoja-estado__stat-valor">{pesos(estado.total.venta)}</span>
            </div>
            {camioneta && (
              <div className="hoja-estado__stat">
                <span className="hoja-estado__stat-label">Sueldo del repartidor</span>
                <span className="hoja-estado__stat-valor">{pesos(estado.total.sueldo)}</span>
              </div>
            )}
            <div className="hoja-estado__stat">
              <span className="hoja-estado__stat-label">Pagado</span>
              <span className="hoja-estado__stat-valor hoja-estado__stat-valor--ok">{pesos(estado.total.pagado)}</span>
            </div>
            <div className="hoja-estado__stat">
              <span className="hoja-estado__stat-label">Se debe</span>
              <span className={`hoja-estado__stat-valor${estado.total.debe > 0 ? ' hoja-estado__stat-valor--debe' : ' hoja-estado__stat-valor--ok'}`}>
                {pesos(estado.total.debe)}
              </span>
            </div>
            {conCaja && conEgreso && (
              <div className="hoja-estado__stat">
                <span className="hoja-estado__stat-label">Pagado en egresos</span>
                <span className="hoja-estado__stat-valor hoja-estado__stat-valor--favor">−{pesos(estado.total.egreso ?? 0)}</span>
              </div>
            )}
            {conCaja && (
              <div className="hoja-estado__stat">
                <span className="hoja-estado__stat-label">Entregado a Luis</span>
                <span className="hoja-estado__stat-valor">{pesos(estado.total.liquidado)}</span>
              </div>
            )}
            {conCaja && (
              <div className="hoja-estado__stat">
                <span className="hoja-estado__stat-label">{faltaEntregar < 0 ? 'Sobra' : 'Falta entregar'}</span>
                <span className={`hoja-estado__stat-valor${faltaEntregar > 0 ? ' hoja-estado__stat-valor--debe'
                  : faltaEntregar < 0 ? ' hoja-estado__stat-valor--favor' : ' hoja-estado__stat-valor--ok'}`}>
                  {pesos(Math.abs(faltaEntregar))}
                </span>
              </div>
            )}
            {estado.total.a_favor > 0 && (
              <div className="hoja-estado__stat">
                <span className="hoja-estado__stat-label">Se le debe al repartidor</span>
                <span className="hoja-estado__stat-valor hoja-estado__stat-valor--favor">{pesos(estado.total.a_favor)}</span>
              </div>
            )}
          </div>

          {!estado.dias.length ? (
            <p className="hoja-dia__vacio">No hay días cobrados en estas fechas.</p>
          ) : (
            <div className="hoja-estado__tabla-wrap">
              <table className="sys-table hoja-estado__tabla">
                <thead>
                  <tr>
                    <th>FECHA</th><th className="cell-right">VENTA TOTAL</th>
                    {camioneta && (<><th className="cell-right">COMISIÓN 10%</th><th className="cell-right">AYUDANTE (FIJO)</th><th className="cell-right">SUELDO TOTAL</th></>)}
                    {conDescuento && <th className="cell-right">DESCUENTO</th>}
                    <th className="cell-right">{camioneta ? 'RECIBIR/PAGAR' : 'RECIBIR'}</th><th className="hoja-estado__col-pago">PAGADO/ABONO</th>
                    {conEgreso && <th className="hoja-estado__col-egreso">EGRESO</th>}
                    <th className="hoja-estado__col-liq">LIQUIDADO</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.dias.map(d => (
                    <tr key={d.factura}>
                      <td>{fechaCorta(d.fecha)}</td>
                      <td className="cell-right">{pesos(d.venta)}</td>
                      {camioneta && (<>
                        <td className="cell-right">{pesos(d.comision)}</td>
                        <td className="cell-right">{pesos(d.ayudante)}</td>
                        <td className="cell-right">{pesos(d.sueldo)}</td>
                      </>)}
                      {conDescuento && <td className="cell-right">{(d.descuento ?? 0) > 0 ? `−${pesos(d.descuento ?? 0)}` : '—'}</td>}
                      <td className="cell-right hoja-estado__recibir">{pesos(d.recibir)}</td>
                      <td className="hoja-estado__col-pago"><PagadoAbono d={d} /></td>
                      {conEgreso && <td className="hoja-estado__col-egreso"><Egresos d={d} /></td>}
                      <td className="hoja-estado__col-liq">
                        <span className="hoja-estado__liq">
                          {estado.puede_liquidar && d.pagado > 0 && (
                            <>
                              <input
                                type="number" min={0} step="0.01" inputMode="decimal"
                                aria-label={`Liquidado ${fechaCorta(d.fecha)}`}
                                className="hoja-input hoja-estado__liq-input"
                                value={tecleoLiq[d.factura] ?? (d.liquidado == null ? '' : String(d.liquidado))}
                                placeholder={d.por_entregar != null ? String(d.por_entregar) : undefined}
                                disabled={guardando === d.factura}
                                onChange={e => setTecleoLiq(t => ({ ...t, [d.factura]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') liquidar(d.factura); }}
                              />
                              <button type="button" className="hoja-btn hoja-btn--primario hoja-estado__liq-btn"
                                onClick={() => liquidar(d.factura)}
                                disabled={guardando === d.factura || tecleoLiq[d.factura] == null}>Guardar</button>
                            </>
                          )}
                          {!estado.puede_liquidar && d.liquidado != null && <span className="hoja-estado__liq-monto">{pesos(d.liquidado)}</span>}
                          <Liquidado d={d} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>TOTAL</td>
                    <td className="cell-right">{pesos(estado.total.venta)}</td>
                    {camioneta && (<>
                      <td className="cell-right">{pesos(estado.total.comision)}</td>
                      <td className="cell-right">{pesos(estado.total.ayudante)}</td>
                      <td className="cell-right">{pesos(estado.total.sueldo)}</td>
                    </>)}
                    {conDescuento && <td className="cell-right">−{pesos(estado.total.descuento ?? 0)}</td>}
                    <td className="cell-right">{pesos(estado.total.recibir)}</td>
                    <td className="hoja-estado__col-pago">
                      {estado.total.debe > 0 ? `Debe ${pesos(estado.total.debe)}` : 'PAGADO'}
                      {estado.total.a_favor > 0 && ` · a favor del repartidor ${pesos(estado.total.a_favor)}`}
                    </td>
                    {conEgreso && <td className="hoja-estado__col-egreso">−{pesos(estado.total.egreso ?? 0)}</td>}
                    <td className="hoja-estado__col-liq">
                      {pesos(estado.total.liquidado)}
                      {estado.total.eva_debe > 0 && ` · Eva debe ${pesos(estado.total.eva_debe)}`}
                      {estado.total.eva_debe < 0 && ` · sobra ${pesos(-estado.total.eva_debe)}`}
                      {(estado.total.por_entregar ?? 0) > 0 && ` · por entregar ${pesos(estado.total.por_entregar ?? 0)}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {pagoModal && (
        <ModalRegistrarPago
          grupo={pagoModal}
          onSuccess={() => { setPagoModal(null); cargar(); }}
          onCancel={() => setPagoModal(null)}
        />
      )}
      <ModalError isOpen={Boolean(error)} message={error} onClose={() => setError('')} />
    </section>
  );
}
