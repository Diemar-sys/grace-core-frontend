// Reportes → por grupo (12-nov, Diemar): la misma idea que Camionetas para PUEBLOS, CLIENTES y SUCURSALES.
// Un bloque por destino, un renglón por día. Pueblos: enviado, entregó (efectivo), en qué se fue lo demás
// por concepto y lo que quedó sin justificar. 🔴 Solo lectura: columnas, renglones y totales vienen del
// servidor (`hoja_api.reporte_grupo`, los números del Estado de cuenta); aquí no se suma dinero.
import { useEffect, useState } from 'react';
import { hojaService, type ReporteGrupoDatos } from '../services/frappeHoja';
import { pesos } from '../utils/formato';
import { fechaConDia } from '../utils/reporteCamionetas';

interface Props {
  grupo: string; desde: string; hasta: string;
  /** '' = todos los del grupo */
  elegido: string;
  /** los destinos que trajo el servidor, para llenar el segundo dropdown */
  onDestinos: (destinos: string[]) => void;
  onError: (mensaje: string) => void;
}

const valor = (n: number | undefined) => (n ? pesos(n) : '—');

export default function ReporteGrupo({ grupo, desde, hasta, elegido, onDestinos, onError }: Props) {
  const [datos, setDatos] = useState<ReporteGrupoDatos | null>(null);
  const [cargando, setCargando] = useState(true);

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
  }, [grupo, desde, hasta]);

  if (cargando) return <div className="ped-card ped-cargando">Sumando…</div>;
  if (!datos) return null;
  const columnas = datos.columnas;
  const destinos = elegido ? datos.destinos.filter((d) => d.destino === elegido) : datos.destinos;
  if (!destinos.length) return <div className="ped-card"><p className="ped-nota">No hay días con pan en este periodo.</p></div>;

  return (
    <>
      {destinos.map((x) => (
        <section className="cam-bloque" key={x.destino}>
          <div className="cam-bloque-head">
            <h2>{x.destino}</h2>
            <span className="ped-chip">{x.dias.length} {x.dias.length === 1 ? 'día' : 'días'}</span>
          </div>
          <div className="table-container cam-scroll">
            <table className="sys-table cam-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {columnas.map((c) => <th key={c.clave} className="cell-right">{c.titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {x.dias.map((d, i) => (
                  <tr key={`${d.fecha}-${d.nota}-${i}`}>
                    <td className="cam-fecha">
                      {fechaConDia(d.fecha)}
                      {d.nota && <span className="hoja-badge hoja-badge--azul"> {d.nota}{d.sin_cobrar ? ` ${pesos(d.sin_cobrar)}` : ''}</span>}
                    </td>
                    {columnas.map((c) => <td key={c.clave} className="cell-right">{d.nota === 'SIN COBRAR' ? '—' : valor(d[c.clave] as number)}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL</td>
                  {columnas.map((c) => <td key={c.clave} className="cell-right">{pesos(x.total[c.clave] ?? 0)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}

      {!elegido && destinos.length > 1 && (
        <section className="cam-bloque">
          <div className="cam-bloque-head"><h2>Todo el grupo</h2></div>
          <div className="val-tiles">
            {columnas.map((c) => (
              <div className="val-tile" key={c.clave}><span>{c.titulo}</span><strong>{pesos(datos.total[c.clave] ?? 0)}</strong></div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
