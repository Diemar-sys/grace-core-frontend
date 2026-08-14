/**
 * Reporte anual de salidas de dinero: TODO lo que gasta la panadería en un año,
 * mes por mes y categoría por categoría, con clic al detalle e impresión a PDF.
 *
 * La aritmética vive en utils/gastosAnuales (con tests). Aquí solo se pide la
 * información y se pinta.
 *
 * ponytail: agrega en el navegador, sin endpoint nuevo. Un año son ~770 compras
 * y ~600 egresos, muy debajo del tope de 2000 de getCompras. Si algún día se
 * vuelve lento o se pide varios años juntos, esto se mueve a un GROUP BY en SQL.
 */
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Layout from '../components/Layout';
import { comprasService } from '../services/frappePurchase';
import { egresosService } from '../services/frappeEgresos';
import { parseErrorFrappe } from '../utils/errorFrappe';
import {
  consolidarGastos, asignarColores, mesDe, etiquetaEgreso, bloqueDe,
  MESES, CAT_COMPRAS, CON_FACTURA, SIN_FACTURA,
} from '../utils/gastosAnuales';
import '../styles/global.css';
import '../styles/ReporteGastosAnual.css';

const fmtMoney = (n) =>
  (parseFloat(n) || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  });

/** Miles abreviados para los ejes: "$1.2M", "$340k". El eje no es una factura. */
const fmtEje = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};

// Geometría del SVG. viewBox fijo + width 100% = escala sola, y así imprime bien.
const W = 760, H = 280, PAD_L = 58, PAD_R = 12, PAD_T = 16, PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const ANCHO_BARRA = Math.floor(PLOT_W / 12) - 14;

function GraficaMensual({ datos, colores, onHover }) {
  const maxMes = Math.max(...datos.totalesMes, 1);
  // Techo redondeado hacia arriba para que la línea de arriba caiga en número limpio.
  const escala = Math.pow(10, Math.floor(Math.log10(maxMes)));
  const techo = Math.ceil(maxMes / escala) * escala;
  const y = (v) => PAD_T + PLOT_H - (v / techo) * PLOT_H;
  const xMes = (m) => PAD_L + (PLOT_W / 12) * m + (PLOT_W / 12 - ANCHO_BARRA) / 2;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => techo * f);

  return (
    <svg className="rga-svg" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Gasto por mes de ${datos.anio}`}>
      {ticks.map(t => (
        <g key={t}>
          <line className="rga-grid" x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} />
          <text className="rga-tick" x={PAD_L - 8} y={y(t) + 4} textAnchor="end">{fmtEje(t)}</text>
        </g>
      ))}

      {MESES.map((nombre, m) => {
        // Las categorías se apilan en orden fijo: la misma categoría queda
        // siempre a la misma altura relativa y la barra se lee de un mes a otro.
        let acumulado = 0;
        const segmentos = datos.familias
          .map(cat => {
            const v = cat.meses[m];
            if (!(v > 0)) return null;
            const desde = acumulado;
            acumulado += v;
            return { cat: cat.categoria, v, desde, hasta: acumulado };
          })
          .filter(Boolean);

        return (
          <g key={nombre}>
            {segmentos.map((s, i) => {
              const yTop = y(s.hasta);
              const alto = Math.max(y(s.desde) - yTop - (i < segmentos.length - 1 ? 2 : 0), 1);
              const esTope = i === segmentos.length - 1;
              return (
                <rect key={s.cat}
                  className="rga-barra"
                  x={xMes(m)} y={yTop} width={ANCHO_BARRA} height={alto}
                  rx={esTope ? 4 : 0}
                  fill={colores[s.cat]}
                  onMouseEnter={e => onHover({
                    mes: m, cat: s.cat, valor: s.v,
                    x: e.currentTarget.getBoundingClientRect().left,
                    y: e.currentTarget.getBoundingClientRect().top,
                  })}
                  onMouseLeave={() => onHover(null)}
                />
              );
            })}
            <text className="rga-tick" x={xMes(m) + ANCHO_BARRA / 2} y={H - 10}
              textAnchor="middle">{nombre}</text>
          </g>
        );
      })}

      <line className="rga-eje" x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} />
    </svg>
  );
}

function ReporteGastosAnual() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [compras, setCompras] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);
  const [detalle, setDetalle] = useState(null);   // { categoria, fiscal, mes }
  // La tabla abre plegada: dos renglones, no veinte. Quien quiera el desglose
  // pica la flecha del bloque que le interesa.
  const [abiertos, setAbiertos] = useState(() => new Set());

  const toggleBloque = (b) => setAbiertos(prev => {
    const s = new Set(prev);
    s.has(b) ? s.delete(b) : s.add(b);
    return s;
  });

  const cargar = useCallback(async (signal) => {
    setLoading(true); setError('');
    const desde = `${anio}-01-01`, hasta = `${anio}-12-31`;
    try {
      // En paralelo: son dos fuentes independientes y el reporte necesita ambas.
      const [c, e] = await Promise.all([
        comprasService.getCompras({ desde, hasta }, signal),
        egresosService.getEgresos({ fecha_desde: desde, fecha_hasta: hasta }),
      ]);
      setCompras(c || []);
      setEgresos(e || []);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(parseErrorFrappe(err).message || 'No se pudo cargar el reporte');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    const ctrl = new AbortController();
    cargar(ctrl.signal);
    return () => ctrl.abort();
  }, [cargar]);

  const datos   = useMemo(() => consolidarGastos(anio, compras, egresos), [anio, compras, egresos]);
  const colores = useMemo(() => asignarColores(datos.familias.map(f => f.categoria)), [datos]);

  const mesesConMovimiento = datos.totalesMes.filter(t => t > 0).length;
  const promedio = mesesConMovimiento ? datos.total / mesesConMovimiento : 0;
  const sinFactura = datos.bloques.find(b => b.categoria === SIN_FACTURA)?.total || 0;

  // Documentos detrás de una celda. Se filtra lo ya cargado: no hace falta ir al
  // servidor otra vez para algo que ya está en memoria.
  const docsDetalle = useMemo(() => {
    if (!detalle) return [];
    const { categoria, fiscal, mes } = detalle;
    if (categoria === CAT_COMPRAS) {
      return compras
        .filter(c => Number(c.docstatus) === 1 && mesDe(c.posting_date, anio) === mes
          && bloqueDe(c) === fiscal)
        .map(c => ({
          fecha: c.posting_date,
          concepto: c.supplier_name || c.supplier,
          referencia: c.custom_no_de_compra ? `#${c.custom_no_de_compra}` : c.name,
          monto: parseFloat(c.grand_total) || 0,
        }));
    }
    return egresos
      .filter(e => etiquetaEgreso(e) === categoria && mesDe(e.fecha, anio) === mes
        && bloqueDe(e) === fiscal)
      .map(e => ({
        fecha: e.fecha,
        // La subcategoría ya va en el título del modal; repetirla en cada renglón
        // solo gasta ancho.
        concepto: e.concepto || e.descripcion || '—',
        referencia: e.facturado_a || e.name,
        monto: parseFloat(e.monto) || 0,
      }));
  }, [detalle, compras, egresos, anio]);

  const anios = Array.from({ length: 5 }, (_, i) => anioActual - i);

  return (
    <Layout>
      <div className="rga">
        <header className="rga-header">
          <div>
            <h1>Gastos {anio}</h1>
            <p className="rga-sub">Todo lo que sale de la caja: compras, nómina, renta, impuestos y más</p>
          </div>
          <div className="rga-controles">
            <select className="rga-select" value={anio} onChange={e => setAnio(Number(e.target.value))}>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button className="rga-btn-print" onClick={() => window.print()}>Imprimir / PDF</button>
          </div>
        </header>

        {error && <div className="rga-error">{error}</div>}
        {loading && <div className="rga-loading">Cargando {anio}…</div>}

        {!loading && !error && datos.total === 0 && (
          <div className="rga-vacio">Sin gastos registrados en {anio}.</div>
        )}

        {!loading && !error && datos.total > 0 && (
          <>
            <section className="rga-totales">
              <div className="rga-hero">
                <span className="rga-hero-label">Total del año</span>
                <strong className="rga-hero-valor">{fmtMoney(datos.total)}</strong>
              </div>
              <div className="rga-tile">
                <span className="rga-tile-label">Promedio mensual</span>
                <strong className="rga-tile-valor">{fmtMoney(promedio)}</strong>
                <small>sobre {mesesConMovimiento} {mesesConMovimiento === 1 ? 'mes' : 'meses'} con movimiento</small>
              </div>
              <div className="rga-tile">
                <span className="rga-tile-label">Categoría más pesada</span>
                <strong className="rga-tile-valor">{datos.familias[0]?.categoria}</strong>
                <small>{fmtMoney(datos.familias[0]?.total)} — {Math.round((datos.familias[0]?.total / datos.total) * 100)}% del total</small>
              </div>
              <div className="rga-tile">
                <span className="rga-tile-label">Sin factura</span>
                <strong className="rga-tile-valor">{fmtMoney(sinFactura)}</strong>
                <small>{Math.round((sinFactura / datos.total) * 100)}% del año salió sin CFDI</small>
              </div>
            </section>

            <section className="rga-card">
              <h2>Gasto por mes</h2>
              {/* Leyenda siempre presente: la identidad no puede depender solo del color. */}
              <ul className="rga-leyenda">
                {datos.familias.map(f => (
                  <li key={f.categoria}>
                    <span className="rga-punto" style={{ background: colores[f.categoria] }} />
                    {f.categoria}
                  </li>
                ))}
              </ul>
              <GraficaMensual datos={datos} colores={colores} onHover={setHover} />
              {hover && (
                <div className="rga-tooltip" style={{ left: hover.x, top: hover.y }}>
                  <strong>{MESES[hover.mes]}</strong>
                  <span>{hover.cat}</span>
                  <span className="rga-tooltip-valor">{fmtMoney(hover.valor)}</span>
                </div>
              )}
            </section>

            <section className="rga-card">
              <h2>Detalle fiscal</h2>
              <p className="rga-hint">
                Pica la flecha para desglosar el bloque; luego cualquier cantidad
                para ver los documentos que la forman.
              </p>
              <div className="rga-tabla-scroll">
                <table className="rga-tabla">
                  <thead>
                    <tr>
                      <th className="rga-th-cat">Categoría</th>
                      {MESES.map(m => <th key={m}>{m}</th>)}
                      <th className="rga-th-total">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.bloques.map(bloque => {
                      const abierto = abiertos.has(bloque.categoria);
                      const filas = datos.categorias.filter(c => c.fiscal === bloque.categoria);
                      const esCon = bloque.categoria === CON_FACTURA;
                      return (
                        <Fragment key={bloque.categoria}>
                          <tr className={`rga-tr-bloque ${esCon ? 'rga-bloque-con' : 'rga-bloque-sin'}`}>
                            <th scope="row" className="rga-td-cat">
                              <button type="button" className="rga-toggle"
                                aria-expanded={abierto}
                                onClick={() => toggleBloque(bloque.categoria)}>
                                <span className={`rga-flecha ${abierto ? 'rga-flecha-abierta' : ''}`}
                                  aria-hidden="true">▶</span>
                                {bloque.categoria}
                                <small>{filas.length} {filas.length === 1 ? 'categoría' : 'categorías'}</small>
                              </button>
                            </th>
                            {bloque.meses.map((v, m) => (
                              <td key={m} className={v > 0 ? 'rga-td-num' : 'rga-td-num rga-td-cero'}>
                                {v > 0 ? fmtMoney(v) : '—'}
                              </td>
                            ))}
                            <td className="rga-td-num rga-td-total">{fmtMoney(bloque.total)}</td>
                          </tr>

                          {/* Las filas siempre se montan y se ocultan por CSS: así el
                              PDF impreso sale completo aunque la pantalla esté plegada. */}
                          {filas.map(cat => (
                            <tr key={cat.categoria} className={abierto ? 'rga-tr-detalle' : 'rga-tr-detalle rga-oculto'}>
                              <th scope="row" className="rga-td-cat">
                                <span className="rga-punto" style={{ background: colores[cat.familia] }} />
                                {cat.categoria}
                              </th>
                              {cat.meses.map((v, m) => (
                                <td key={m} className={v > 0 ? 'rga-td-num rga-td-click' : 'rga-td-num rga-td-cero'}
                                  onClick={v > 0 ? () => setDetalle({ categoria: cat.categoria, fiscal: cat.fiscal, mes: m }) : undefined}
                                  title={v > 0 ? `Ver ${cat.categoria} de ${MESES[m]}` : ''}>
                                  {v > 0 ? fmtMoney(v) : '—'}
                                </td>
                              ))}
                              <td className="rga-td-num rga-td-total">{fmtMoney(cat.total)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className="rga-td-cat">Total</th>
                      {datos.totalesMes.map((t, m) => (
                        <td key={m} className="rga-td-num">{t > 0 ? fmtMoney(t) : '—'}</td>
                      ))}
                      <td className="rga-td-num rga-td-total">{fmtMoney(datos.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}

        {detalle && (
          <div className="rga-modal-overlay" onClick={() => setDetalle(null)}>
            <div className="rga-modal" onClick={e => e.stopPropagation()}>
              <div className="rga-modal-header">
                <h3>{detalle.categoria} — {MESES[detalle.mes]} {anio}
                  <span className="rga-modal-bloque">{detalle.fiscal}</span></h3>
                <button className="rga-modal-close" onClick={() => setDetalle(null)}>×</button>
              </div>
              <table className="rga-tabla rga-tabla-detalle">
                <thead>
                  <tr><th>Fecha</th><th>Concepto</th><th>Referencia</th><th className="rga-td-num">Monto</th></tr>
                </thead>
                <tbody>
                  {docsDetalle.map((d, i) => (
                    <tr key={i}>
                      <td>{d.fecha}</td>
                      <td>{d.concepto}</td>
                      <td className="rga-td-ref">{d.referencia}</td>
                      <td className="rga-td-num">{fmtMoney(d.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>{docsDetalle.length} documento(s)</th>
                    <td className="rga-td-num rga-td-total">
                      {fmtMoney(docsDetalle.reduce((s, d) => s + d.monto, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ReporteGastosAnual;
