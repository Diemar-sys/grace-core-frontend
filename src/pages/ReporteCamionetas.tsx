// src/pages/ReporteCamionetas.tsx
// Reportes → Camionetas (Diemar 10-nov, su Excel): por camioneta y día que salió, la venta,
// lo que cuesta y la diferencia. La merma ya está fuera del MONTO.
// 11-nov: la merma de gastos se escribe a mano (no es un 35 % parejo): borrador en Dexie →
// «Guardar» (servidor, `Merma Camioneta`) → «Cerrar» por día (reabre solo Luis/Administrator).
// Abajo de cada camioneta, lo vendido por categoría (Σ = Monto, lo exige el verificador).
// Diseño: el de Compras (`comprasv2`): encabezado con rombo, filtros en una barra.
// 🔴 Los números vienen del servidor; aquí solo se suman, se pintan y se sobrepone lo tecleado.
import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/modals/ConfirmModal';
import ModalError from '../components/modals/ModalError';
import useBorradorLocal from '../hooks/useBorradorLocal';
import { hojaService } from '../services/frappeHoja';
import '../styles/global.css';
import '../styles/Compras.css';
import '../styles/Pedido.css';
import { hoyISO } from '../utils/hora';
import { pesos } from '../utils/formato';
import {
  COLUMNAS, claveMerma, conMerma, csvCamionetas, fechaConDia, mermasPorGuardar, totales, totalesCategoria,
  type Columna, type FilaCamioneta, type ReporteCamionetas as Reporte,
} from '../utils/reporteCamionetas';

const TITULOS: Record<Columna, string> = {
  venta: 'Monto', materia: '35%', merma_mano: 'Merma', panadero: 'Panadero 10%',
  camioneta: 'Camioneta', chofer: 'Chofer 10%', ayudante: 'Ayudante', gastos: 'Total gastos',
  diferencia: 'Diferencia',
};
const TODAS = '';

type Accion = { tipo: 'cerrar' | 'reabrir'; destino: string; fecha: string };

interface PropsTabla {
  destino: string;
  dias: FilaCamioneta[];
  categorias: string[];
  escritas: Record<string, string>;
  puedeReabrir: boolean;
  escribir: (clave: string, valor: string) => void;
  pedir: (a: Accion) => void;
}

function CeldaMerma({ destino, d, escritas, puedeReabrir, escribir, pedir }:
  Omit<PropsTabla, 'dias' | 'categorias'> & { d: FilaCamioneta }) {
  if (d.merma_cerrada) {
    return (
      <div className="cam-merma-celda">
        <span>{pesos(d.merma_mano ?? 0)}</span>
        <span className="ped-badge ok">cerrada</span>
        {puedeReabrir && (
          <button type="button" className="cam-mini" onClick={() => pedir({ tipo: 'reabrir', destino, fecha: d.fecha })}>
            Reabrir
          </button>
        )}
      </div>
    );
  }
  const clave = claveMerma(destino, d.fecha);
  const guardadaSinCambios = d.merma_mano !== null && !d.pendiente && !d.invalida;
  return (
    <div className="cam-merma-celda">
      <input className={`cam-merma${d.pendiente ? ' is-pendiente' : ''}${d.invalida ? ' is-invalida' : ''}`}
        type="text" inputMode="decimal" placeholder="—" aria-label={`Merma ${destino} ${d.fecha}`}
        value={escritas[clave] ?? (d.merma_mano === null ? '' : String(d.merma_mano))}
        onChange={(e) => escribir(clave, e.target.value)} />
      {guardadaSinCambios && (
        <button type="button" className="cam-mini" onClick={() => pedir({ tipo: 'cerrar', destino, fecha: d.fecha })}>
          Cerrar
        </button>
      )}
    </div>
  );
}

function TablaCamioneta(p: PropsTabla) {
  const { destino, dias, categorias } = p;
  const t = useMemo(() => totales(dias), [dias]);
  const tc = useMemo(() => totalesCategoria(dias, categorias), [dias, categorias]);
  return (
    <section className="cam-bloque">
      <div className="cam-bloque-head">
        <h2>{destino}</h2>
        <span className="ped-badge info">{dias.length} días</span>
      </div>
      <div className="table-container cam-scroll">
        <table className="sys-table cam-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              {COLUMNAS.map((k) => <th key={k} className="cell-right">{TITULOS[k]}</th>)}
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.fecha}>
                <td className="cam-fecha">
                  {fechaConDia(d.fecha)}
                  {!d.liquidado && <span className="ped-badge warn">sin liquidar</span>}
                </td>
                {COLUMNAS.map((k) => (k === 'merma_mano' ? (
                  <td key={k} className="cell-right"><CeldaMerma {...p} d={d} /></td>
                ) : (
                  <td key={k} className={`cell-right${k === 'diferencia' && d.diferencia < 0 ? ' ped-neg' : ''}`}>
                    {d[k] === null ? '' : pesos(d[k])}
                  </td>
                )))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              {COLUMNAS.map((k) => (
                <td key={k} className={`cell-right${k === 'diferencia' && t.diferencia < 0 ? ' ped-neg' : ''}`}>
                  {pesos(t[k])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {categorias.length > 0 && (
        <>
          <h3 className="cam-subtitulo">Vendido por categoría</h3>
          <div className="table-container cam-scroll">
            <table className="sys-table cam-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  {categorias.map((k) => <th key={k} className="cell-right">{k}</th>)}
                  <th className="cell-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((d) => (
                  <tr key={d.fecha}>
                    <td className="cam-fecha">{fechaConDia(d.fecha)}</td>
                    {categorias.map((k) => <td key={k} className="cell-right">{pesos(d.categorias[k] ?? 0)}</td>)}
                    <td className="cell-right">{pesos(d.venta)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL</td>
                  {categorias.map((k) => <td key={k} className="cell-right">{pesos(tc[k])}</td>)}
                  <td className="cell-right">{pesos(t.venta)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default function ReporteCamionetas() {
  const [desde, setDesde] = useState(() => hoyISO().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoyISO());
  const [elegida, setElegida] = useState(TODAS);
  const [datos, setDatos] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  // lo tecleado y aún no guardado: { "MARTIN|2026-11-09": "655.90" }. Borrador en Dexie.
  const [escritas, setEscritas] = useState<Record<string, string>>({});
  useBorradorLocal('reporte-camionetas-merma', Object.keys(escritas).length ? escritas : null, setEscritas);
  const escribir = (clave: string, valor: string) => setEscritas((e) => ({ ...e, [clave]: valor }));

  useEffect(() => {
    if (!desde || !hasta) return;
    let vigente = true;
    setCargando(true);
    hojaService.rentabilidadCamionetas(desde, hasta)
      .then((d) => { if (vigente) setDatos(d); })
      .catch((err: any) => { if (vigente) { setError(err.message); setDatos(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [desde, hasta, recarga]);

  const camionetas = datos?.camionetas;
  const categorias = datos?.categorias ?? [];
  // todas: lo pendiente de una camioneta oculta por el filtro también se guarda
  const todas = useMemo(() => (camionetas ?? [])
    .map((c) => ({ destino: c.destino, dias: conMerma(c.destino, c.dias, escritas) })), [camionetas, escritas]);
  const filas = elegida === TODAS ? todas : todas.filter((c) => c.destino === elegida);
  const porGuardar = useMemo(() => mermasPorGuardar(todas), [todas]);
  const hayInvalidas = todas.some((c) => c.dias.some((d) => d.invalida));
  const general = useMemo(() => totales(filas.flatMap((c) => c.dias)), [filas]);
  const hayPendientes = filas.some((c) => c.dias.some((d) => !d.liquidado));

  const guardar = async () => {
    setGuardando(true);
    try {
      await hojaService.guardarMermasCamioneta(porGuardar);
      // solo se quita lo que ya subió (lo tecleado en otro rango de fechas se queda)
      const subidas = new Set(porGuardar.map((m) => claveMerma(m.destino, m.fecha)));
      setEscritas((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !subidas.has(k))));
      setRecarga((n) => n + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmar = async () => {
    if (!accion) return;
    setGuardando(true);
    try {
      if (accion.tipo === 'cerrar') await hojaService.cerrarMermaCamioneta(accion.fecha, accion.destino);
      else await hojaService.reabrirMermaCamioneta(accion.fecha, accion.destino);
      setAccion(null);
      setRecarga((n) => n + 1);
    } catch (err: any) {
      setAccion(null);
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([csvCamionetas(filas, categorias)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `camionetas_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="page-container comprasv2">
        <div className="page-header">
          <div className="cam-titulo">
            <h1>Camionetas</h1>
            <span className="header-subtitle">Venta, gastos y diferencia por día</span>
          </div>
        </div>

        <div className="filtros-section">
          <div className="filtro-group filtro-sm">
            <label htmlFor="cam-camioneta">Camioneta</label>
            <select id="cam-camioneta" className="comp-date-input" value={elegida}
              onChange={(e) => setElegida(e.target.value)}>
              <option value={TODAS}>Todas ({camionetas?.length ?? 0})</option>
              {(camionetas ?? []).map((c) => <option key={c.destino} value={c.destino}>{c.destino}</option>)}
            </select>
          </div>
          <div className="filtro-group filtro-sm">
            <label htmlFor="cam-desde">Desde</label>
            <input id="cam-desde" type="date" className="comp-date-input" value={desde} max={hasta}
              onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="filtro-group filtro-sm">
            <label htmlFor="cam-hasta">Hasta</label>
            <input id="cam-hasta" type="date" className="comp-date-input" value={hasta} min={desde}
              onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="cam-acciones">
            {filas.length > 0 && (
              <button type="button" className="btn-refresh btn-compacto" onClick={descargar}>Descargar CSV</button>
            )}
            <button type="button" className="comp-btn-confirmar cam-guardar"
              disabled={!porGuardar.length || hayInvalidas || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : `Guardar merma${porGuardar.length ? ` (${porGuardar.length})` : ''}`}
            </button>
          </div>
        </div>

        <p className="ped-nota cam-nota">
          Monto = lo vendido (lo cargado menos la merma). <strong>Merma</strong>: escríbela a mano,
          dale <strong>Guardar</strong> y, cuando ya esté bien, <strong>Cerrar</strong> (solo Luis la reabre).
          Lo que escribes sin guardar se queda en este navegador.
          El 35% y el 10% del panadero son porcentajes fijos, <strong>no medidos</strong>.
          {hayPendientes && ' «Sin liquidar»: el repartidor no ha entregado su merma; ese día puede cambiar.'}
          {hayInvalidas && <strong className="ped-neg"> Hay una merma que no es un número: corrígela para guardar.</strong>}
        </p>

        {cargando && <div className="ped-card ped-cargando">Sumando las camionetas…</div>}

        {!cargando && datos && !filas.length && (
          <div className="ped-card"><p className="ped-nota">Ninguna camioneta salió en este periodo.</p></div>
        )}

        {!cargando && filas.map((c) => (
          <TablaCamioneta key={c.destino} destino={c.destino} dias={c.dias} categorias={categorias}
            escritas={escritas} puedeReabrir={!!datos?.puede_reabrir} escribir={escribir} pedir={setAccion} />
        ))}

        {!cargando && elegida === TODAS && filas.length > 1 && (
          <section className="cam-bloque">
            <div className="cam-bloque-head"><h2>Todas las camionetas</h2></div>
            <div className="val-tiles">
              <div className="val-tile"><span>Monto</span><strong>{pesos(general.venta)}</strong></div>
              <div className="val-tile"><span>Total gastos</span><strong>{pesos(general.gastos)}</strong></div>
              <div className={`val-tile is-margen${general.diferencia < 0 ? ' is-neg' : ''}`}>
                <span>Diferencia</span><strong>{pesos(general.diferencia)}</strong>
              </div>
            </div>
          </section>
        )}
      </div>

      {accion && (
        <ConfirmModal
          title={accion.tipo === 'cerrar' ? 'Cerrar merma' : 'Reabrir merma'}
          description={`${accion.destino} · ${fechaConDia(accion.fecha)}`}
          subdescription={accion.tipo === 'cerrar'
            ? 'Ya no se podrá corregir. Solo Luis o el administrador la reabren.'
            : 'Se podrá corregir otra vez.'}
          confirmLabel={accion.tipo === 'cerrar' ? 'Cerrar' : 'Reabrir'}
          loadingLabel="Guardando…"
          loading={guardando}
          icon={undefined}
          iconStyle={undefined}
          confirmClassName={undefined}
          confirmStyle={undefined}
          error={undefined}
          onFallback={undefined}
          fallbackLabel={undefined}
          fallbackDescription={undefined}
          passwordPrompt={undefined}
          onConfirm={confirmar}
          onCancel={() => setAccion(null)}
        />
      )}
      <ModalError isOpen={!!error} title="No se pudo completar"
        message={error} onClose={() => setError('')} />
    </Layout>
  );
}
