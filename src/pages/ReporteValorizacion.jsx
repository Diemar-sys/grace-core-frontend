// src/pages/ReporteValorizacion.jsx
// Reportes → Valorización de envíos: cuánto se mandó a las sucursales en un
// periodo y cuánto vale, al costo y a precio de venta.
//
// Lo vendible y la materia prima van SEPARADOS a propósito. Un traspaso de harina
// no es una venta: darle margen sería inventarlo, y mezclarlo en un solo total
// contamina el número que se le lleva al jefe.
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ModalError from '../components/modals/ModalError';
import { pedidoService } from '../services/frappePedido';
import '../styles/global.css';
import '../styles/Pedido.css';

const hoy = () => new Date().toISOString().split('T')[0];

/** Dinero, o «—» cuando NO HAY dinero que mostrar.
 *
 * null y 0 no son lo mismo y aquí la diferencia cuesta: la materia prima llega
 * con precio y margen en null porque no se vende, y pintarla como $0.00 diría
 * que se regaló. Se exporta para poder probarlo: es la clase de detalle que solo
 * se nota cuando alguien ya tomó una decisión con el número mal. */
export const pesos = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  // El signo va ANTES del $, no pegado al número: toLocaleString da «$-100.50»
  // y en un reporte donde el margen negativo es la señal, eso se lee mal de reojo.
  const cifra = Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '-' : ''}$${cifra}`;
};

export const piezas = (n) => Number(n || 0).toLocaleString('es-MX');

export default function ReporteValorizacion() {
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [datos, setDatos] = useState(null);
  const [verInsumos, setVerInsumos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!desde || !hasta) return;
    let vigente = true;
    setCargando(true);
    pedidoService.valorizacion(desde, hasta)
      .then((d) => { if (vigente) setDatos(d); })
      .catch((err) => { if (vigente) { setError(err.message); setDatos(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [desde, hasta]);

  const v = datos?.vendible;
  const renglones = (datos?.renglones ?? []).filter((r) => r.vendible !== verInsumos);

  return (
    <Layout title="Valorización de envíos" subtitle="Cuánto se mandó y cuánto vale">
      <div className="ped-card">
        <div className="ped-card-head">
          <h3>Periodo</h3>
          {datos && <span className="ped-badge info">{datos.renglones.length} renglones</span>}
        </div>
        <div className="val-fechas">
          <div className="ped-field">
            <label htmlFor="val-desde">Desde</label>
            <input id="val-desde" type="date" value={desde} max={hasta}
              onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="ped-field">
            <label htmlFor="val-hasta">Hasta</label>
            <input id="val-hasta" type="date" value={hasta} min={desde}
              onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
      </div>

      {cargando && <div className="ped-card ped-cargando">Sumando los envíos…</div>}

      {!cargando && datos && (
        <>
          <div className="ped-card">
            <div className="ped-card-head">
              <h3>Producto terminado</h3>
              {datos.hay_costo_estimado && (
                <span className="ped-badge warn">Costo estimado, no medido</span>
              )}
            </div>
            <div className="val-tiles">
              <div className="val-tile"><span>Piezas</span><strong>{piezas(v.piezas)}</strong></div>
              <div className="val-tile"><span>Al costo</span><strong>{pesos(v.costo)}</strong></div>
              <div className="val-tile"><span>A precio de venta</span><strong>{pesos(v.precio)}</strong></div>
              <div className={`val-tile is-margen${v.margen < 0 ? ' is-neg' : ''}`}>
                <span>Margen</span>
                <strong>
                  {pesos(v.margen)}
                  {v.margen_pct !== null && <em>{v.margen_pct}%</em>}
                </strong>
              </div>
            </div>
            {datos.hay_costo_estimado && (
              <p className="ped-nota">
                Hay pan sin receta: su costo es un porcentaje del precio, así que ese
                margen es <strong>aritmética, no medición</strong>. El número se vuelve
                real cuando cada pan tenga su BOM.
              </p>
            )}
          </div>

          <div className="ped-card">
            <div className="ped-card-head">
              <h3>Materia prima e insumos</h3>
              <span className="ped-badge info">No se vende</span>
            </div>
            <div className="val-tiles is-duo">
              <div className="val-tile"><span>Piezas</span><strong>{piezas(datos.insumo.piezas)}</strong></div>
              <div className="val-tile"><span>Al costo</span><strong>{pesos(datos.insumo.costo)}</strong></div>
            </div>
            <p className="ped-nota">
              Harina, bolsas y velas se <strong>consumen</strong> en la sucursal, no se
              venden. Mover esto cuesta dinero, pero no tiene precio de venta ni margen.
            </p>
          </div>

          <div className="ped-card">
            <div className="ped-card-head"><h3>Por destino</h3></div>
            {!datos.destinos.length ? (
              <p className="ped-nota">No se mandó producto terminado en este periodo.</p>
            ) : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th>Destino</th><th>Grupo</th>
                      <th className="cell-right">Piezas</th>
                      <th className="cell-right">Al costo</th>
                      <th className="cell-right">A precio</th>
                      <th className="cell-right">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.destinos.map((d) => (
                      <tr key={d.destino}>
                        <td><strong>{d.destino}</strong></td>
                        <td>{d.grupo}</td>
                        <td className="cell-right">{piezas(d.piezas)}</td>
                        <td className="cell-right">{pesos(d.costo)}</td>
                        <td className="cell-right">{pesos(d.precio)}</td>
                        <td className={`cell-right${d.margen < 0 ? ' ped-neg' : ''}`}>
                          {pesos(d.margen)}{d.margen_pct !== null && ` · ${d.margen_pct}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ped-card">
            <div className="ped-switch">
              <button className={`ped-switch-op${!verInsumos ? ' is' : ''}`}
                onClick={() => setVerInsumos(false)}>
                Producto terminado ({datos.renglones.filter((r) => r.vendible).length})
              </button>
              <button className={`ped-switch-op${verInsumos ? ' is' : ''}`}
                onClick={() => setVerInsumos(true)}>
                Insumos ({datos.renglones.filter((r) => !r.vendible).length})
              </button>
            </div>

            {!renglones.length ? (
              <p className="ped-nota">Nada de este tipo en el periodo.</p>
            ) : (
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th>Clave</th><th>Producto</th><th>Destino</th>
                      <th className="cell-right">Piezas</th>
                      <th className="cell-right">Al costo</th>
                      <th className="cell-right">A precio</th>
                      <th className="cell-right">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renglones.map((r) => (
                      <tr key={`${r.destino}-${r.clave}`}>
                        <td>{r.clave}</td>
                        <td>
                          {r.producto}
                          {r.costo_estimado && <span className="ped-badge warn">estimado</span>}
                          {r.sin_precio && <span className="ped-badge bad">sin precio</span>}
                        </td>
                        <td>{r.destino}</td>
                        <td className="cell-right">{piezas(r.piezas)}</td>
                        <td className="cell-right">{pesos(r.costo)}</td>
                        <td className="cell-right">{pesos(r.precio)}</td>
                        <td className={`cell-right${r.margen < 0 ? ' ped-neg' : ''}`}>
                          {pesos(r.margen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ModalError isOpen={!!error} title="No se pudo armar el reporte"
        message={error} onClose={() => setError('')} />
    </Layout>
  );
}
