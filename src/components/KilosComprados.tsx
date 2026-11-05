import { Fragment, useEffect, useMemo, useState } from 'react';
import { comprasService } from '../services/frappePurchase';
import { parseErrorFrappe } from '../utils/errorFrappe';
import { cantidad } from '../utils/formato';
import { MESES } from '../utils/gastosAnuales';
import { armarKilos, csvKilos, CUENTAS, type Cuenta, type FilaKilos } from '../utils/kilosComprados';

/** «1,200 Kg · 40 L»: una categoría puede traer varias unidades y no se suman. */
const porUnidad = (totales: Record<string, number[]>, mes?: number) =>
  Object.entries(totales)
    .map(([uom, meses]) => [uom, mes == null ? meses.reduce((s, v) => s + v, 0) : meses[mes]] as const)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => (a === 'Kg' ? -1 : b === 'Kg' ? 1 : a.localeCompare(b)))
    .map(([uom, v]) => `${cantidad(v, 2)} ${uom}`)
    .join(' · ') || '—';

/**
 * Lo que pide el contador: cuánto se COMPRÓ de cada insumo por mes (no cuánto
 * se gastó: abrir una bolsa no deja movimiento). Por cuenta fiscal.
 */
export default function KilosComprados({ anio }: { anio: number }) {
  const [filas, setFilas] = useState<FilaKilos[]>([]);
  const [cuenta, setCuenta] = useState<Cuenta>('todas');
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setCargando(true); setError('');
    comprasService.getKilosComprados(anio)
      .then(r => { if (vivo) setFilas(r); })
      .catch(e => { if (vivo) setError(parseErrorFrappe(e).message); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [anio]);

  const categorias = useMemo(() => armarKilos(filas, cuenta), [filas, cuenta]);

  const alternar = (c: string) => setAbiertos(prev => {
    const s = new Set(prev);
    if (s.has(c)) s.delete(c); else s.add(c);
    return s;
  });

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([csvKilos(categorias)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `kilos_comprados_${anio}_${cuenta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rga-card">
      <div className="rga-kilos-cabeza">
        <div>
          <h2>Kilos comprados</h2>
          <p className="rga-hint">Lo que entró por compra, por insumo y mes. No es consumo.</p>
        </div>
        <div className="rga-kilos-controles">
          <div className="rga-pills" role="group" aria-label="Cuenta fiscal">
            {CUENTAS.map(c => (
              <button key={c.key} type="button" aria-pressed={cuenta === c.key}
                className={`rga-pill ${cuenta === c.key ? 'rga-pill-activa' : ''}`}
                onClick={() => setCuenta(c.key)}>{c.label}</button>
            ))}
          </div>
          <button type="button" className="rga-btn-print" onClick={descargar} disabled={!categorias.length}>
            Descargar Excel (CSV)
          </button>
        </div>
      </div>

      {error && <div className="rga-error">{error}</div>}
      {cargando && <div className="rga-loading">Cargando kilos de {anio}…</div>}
      {!cargando && !error && !categorias.length && <div className="rga-vacio">Sin compras en {anio} para esta cuenta.</div>}

      {!cargando && !error && categorias.length > 0 && (
        <div className="rga-tabla-scroll">
          <table className="rga-tabla">
            <thead>
              <tr>
                <th className="rga-th-cat">Insumo</th>
                {MESES.map(m => <th key={m}>{m}</th>)}
                <th className="rga-th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(c => {
                const abierto = abiertos.has(c.categoria);
                return (
                  <Fragment key={c.categoria}>
                    <tr className="rga-tr-bloque">
                      <th scope="row" className="rga-td-cat">
                        <button type="button" className="rga-toggle" aria-expanded={abierto}
                          onClick={() => alternar(c.categoria)}>
                          <span className={`rga-flecha ${abierto ? 'rga-flecha-abierta' : ''}`} aria-hidden="true">▶</span>
                          {c.categoria}
                          <small>{c.items.length} {c.items.length === 1 ? 'insumo' : 'insumos'}</small>
                        </button>
                      </th>
                      {MESES.map((m, i) => <td key={m} className="rga-td-num">{porUnidad(c.totales, i)}</td>)}
                      <td className="rga-td-num rga-td-total">{porUnidad(c.totales)}</td>
                    </tr>
                    {c.items.map(it => (
                      <tr key={`${it.item_code}|${it.uom}`} className={abierto ? 'rga-tr-detalle' : 'rga-tr-detalle rga-oculto'}>
                        <th scope="row" className="rga-td-cat">{it.item_name}</th>
                        {it.meses.map((v, i) => (
                          <td key={i} className="rga-td-num">{v > 0 ? `${cantidad(v, 2)} ${it.uom}` : '—'}</td>
                        ))}
                        <td className="rga-td-num rga-td-total">{cantidad(it.total, 2)} {it.uom}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
