// Reportes → por grupo (12-nov, Diemar): la misma idea que Camionetas para PUEBLOS, CLIENTES y SUCURSALES.
// Un bloque por destino, un renglón por día. Pueblos (17-nov, la tabla del jefe): MONTO (el efectivo), 35%,
// fijos, gastos por concepto, TOTAL GASTOS y GANANCIA; el TOTAL es la sumatoria del periodo.
// 17-nov: cada pueblo trae SUS columnas (VEGIL lleva su 10%); las del grupo son las del total de abajo.
// 🔴 Solo lectura: columnas, renglones y totales vienen del
// servidor (`hoja_api.reporte_grupo`, los números del Estado de cuenta); aquí no se suma dinero.
// 24-nov: P.REAL trae la tabla del jefe; Luis/Administrator escriben las columnas `mano` (borrador local →
// «Guardar»); las diferencias las recalcula el servidor al guardar.
import { useEffect, useMemo, useState } from 'react';
import { hojaService, type ReporteGrupoDatos } from '../../../compartido/services/frappeHoja';
import { pesos } from '../../../compartido/utils/formato';
import { fechaConDia } from '../../../compartido/utils/reporteCamionetas';
import { claseDiferencia, conSigno } from '../../../compartido/utils/entregaPueblo';
import useBorradorLocal from '../../../compartido/hooks/useBorradorLocal';
import { capturasPorGuardar, claveCaptura, previsualizar, type Escritas } from './cuentaPuertaReal';

interface Props {
  grupo: string; desde: string; hasta: string;
  /** '' = todos los del grupo */
  elegido: string;
  /** los destinos que trajo el servidor, para llenar el segundo dropdown */
  onDestinos: (destinos: string[]) => void;
  onError: (mensaje: string) => void;
}

/** La GANANCIA de un pueblo va con signo y color de texto (gana azul, pierde rojo); lo demás, en pesos. */
const celda = (clave: string, n: number | undefined, enCero: string) => (clave !== 'ganancia' ? (n ? pesos(n) : enCero)
  : <span className={claseDiferencia(n ?? 0)}>{conSigno(n ?? 0)}</span>);

export default function ReporteGrupo({ grupo, desde, hasta, elegido, onDestinos, onError }: Props) {
  const [datos, setDatos] = useState<ReporteGrupoDatos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [escritas, setEscritas] = useState<Escritas>({});
  useBorradorLocal('reporte-preal-cuenta', Object.keys(escritas).length ? escritas : null, setEscritas);

  // lo guardado de quien se captura (P.REAL), por fecha: para mandar solo lo que cambió
  const capturable = datos?.destinos.find((x) => x.puede_capturar);
  const porGuardar = useMemo(() => {
    const porFecha = new Map((capturable?.dias ?? []).map((d) => [d.fecha, d]));
    return capturasPorGuardar(escritas, (f, c) => Number(porFecha.get(f)?.[c] ?? 0));
  }, [escritas, capturable]);
  // las diferencias se ven mientras se teclea (espejo de `cuenta_preal`); al guardar manda el servidor
  const vista = useMemo(() => capturable && previsualizar(capturable.dias, capturable.total, escritas), [capturable, escritas]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await hojaService.guardarCuentaPuertaReal(porGuardar.capturas);
      setEscritas({});
      setRecarga((n) => n + 1);
    } catch (err: any) {
      onError(err?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    if (!desde || !hasta) return;
    let vigente = true;
    setCargando(true);
    hojaService.reporteGrupo(grupo, desde, hasta)
      .then((d) => { if (vigente) { setDatos(d); onDestinos(d.destinos.map((x) => x.destino)); } })
      .catch((err: any) => { if (vigente) { setDatos(null); onDestinos([]); onError(err?.message || 'No se pudo leer el reporte'); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    // onDestinos/onError son del padre y no cambian lo que se pide
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo, desde, hasta, recarga]);

  if (cargando) return <div className="ped-card ped-cargando">Sumando…</div>;
  if (!datos) return null;
  const columnas = datos.columnas;
  const destinos = elegido ? datos.destinos.filter((d) => d.destino === elegido) : datos.destinos;
  if (!destinos.length) return <div className="ped-card"><p className="ped-nota">No hay días con pan en este periodo.</p></div>;

  return (
    <>
      {destinos.map((x) => { const cols = x.columnas ?? columnas; const v = x === capturable && vista ? vista : x; return (
        <section className="cam-bloque" key={x.destino}>
          <div className="cam-bloque-head">
            <h2>{x.destino}</h2>
            <span className="ped-chip">{x.dias.length} {x.dias.length === 1 ? 'día' : 'días'}</span>
            {x.puede_capturar && (
              <button type="button" className="comp-btn-confirmar cam-guardar"
                disabled={!porGuardar.capturas.length || porGuardar.invalidas.size > 0 || guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : `Guardar${porGuardar.capturas.length ? ` (${porGuardar.capturas.length})` : ''}`}
              </button>
            )}
          </div>
          {x.puede_capturar && porGuardar.invalidas.size > 0 && (
            <p className="ped-nota ped-neg">Hay un monto que no es un número: corrígelo para guardar.</p>
          )}
          <div className="table-container cam-scroll">
            <table className="sys-table cam-tabla cam-tabla--grupo">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {cols.map((c) => <th key={c.clave} className="cell-right">{c.titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {v.dias.map((d, i) => (
                  <tr key={`${d.fecha}-${d.nota}-${i}`}>
                    <td className="cam-fecha">
                      {fechaConDia(d.fecha)}
                      {d.nota && <span className={`hoja-badge ${d.nota === 'ABARROTES' ? 'hoja-badge--azul' : 'hoja-badge--rojo'}`}> {d.nota}{d.sin_cobrar ? ` ${pesos(d.sin_cobrar)}` : ''}</span>}
                    </td>
                    {cols.map((c) => {
                      if (c.mano && x.puede_capturar) {
                        const clave = claveCaptura(d.fecha, c.clave);
                        const guardado = Number(d[c.clave] ?? 0);
                        const valor = escritas[clave] ?? (guardado ? String(guardado) : '');
                        return (
                          <td key={c.clave} className="cell-right">
                            <input className={`cam-merma${clave in escritas ? ' is-pendiente' : ''}${porGuardar.invalidas.has(clave) ? ' is-invalida' : ''}`}
                              type="text" inputMode="decimal" placeholder="—" aria-label={`${c.titulo} ${d.fecha}`} value={valor}
                              onChange={(e) => setEscritas((w) => ({ ...w, [clave]: e.target.value }))} />
                          </td>
                        );
                      }
                      // SIN COBRAR no trae números (P.REAL sí: lo capturado de ese día)
                      const n = d[c.clave];
                      return <td key={c.clave} className="cell-right">{n === undefined && d.nota === 'SIN COBRAR' ? '—' : celda(c.clave, n as number, '—')}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL</td>
                  {cols.map((c) => <td key={c.clave} className="cell-right">{celda(c.clave, v.total[c.clave], pesos(0))}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ); })}

      {!elegido && destinos.length > 1 && (
        <section className="cam-bloque">
          <div className="cam-bloque-head"><h2>Todo el grupo</h2></div>
          <div className="val-tiles">
            {columnas.map((c) => (
              <div className="val-tile" key={c.clave}><span>{c.titulo}</span><strong>{celda(c.clave, datos.total[c.clave], pesos(0))}</strong></div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
