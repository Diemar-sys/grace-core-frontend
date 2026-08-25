// src/pages/Pedido.jsx
// Importa el pedido diario desde la hoja de Drive del jefe.
// El pedido se sigue capturando en Drive (a la 1 AM, sin conexión y sin depender
// de la torre); aquí solo entra al sistema, ya cerrado, en la mañana.
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ModalError from '../components/modals/ModalError';
import { pedidoService, leerBase64, urlPdfPedido } from '../services/frappePedido';
import { hojaDelDia } from '../utils/pedidoDia';
import { agruparDestinos, enOrden } from '../utils/gruposDestino';
import '../styles/global.css';
import '../styles/Pedido.css';

const hoy = () => new Date().toISOString().slice(0, 10);
const suma = (piezas) => Object.values(piezas).reduce((a, b) => a + b, 0);

export default function Pedido() {
  const [archivo, setArchivo] = useState(null);
  const [datos, setDatos] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [hojas, setHojas] = useState(null);
  const [cuadre, setCuadre] = useState(null);
  const [grupos, setGrupos] = useState({});
  const [ordenGrupos, setOrdenGrupos] = useState([]);
  const [elegidas, setElegidas] = useState([]);
  const [abierta, setAbierta] = useState('');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState('');
  const [aQuien, setAQuien] = useState('');
  const [aQuienes, setAQuienes] = useState([]);
  // Cambiar la key vacía el <input type="file">: sin eso, volver a elegir el
  // MISMO archivo después de quitarlo no dispara onChange y la pantalla se queda
  // muda. ponytail: una key basta, no hace falta un ref.
  const [nonce, setNonce] = useState(0);
  // Lo guardado de ESA fecha, que es sobre lo que trabajan el PDF y Telegram.
  // null mientras no se sabe: los botones arrancan apagados, no prendidos.
  const [guardado, setGuardado] = useState(null);

  useEffect(() => {
    pedidoService.destinatarios()
      .then((lista) => { setAQuienes(lista); setAQuien((a) => a || lista[0] || ''); })
      .catch(() => {});   // sin bot configurado la pantalla sigue sirviendo
  }, []);

  useEffect(() => {
    let vigente = true;
    setGuardado(null);
    pedidoService.hayPedido(fecha)
      .then((hay) => { if (vigente) setGuardado(hay); })
      .catch(() => { if (vigente) setGuardado(false); });
    return () => { vigente = false; };
  }, [fecha]);

  const limpiar = () => {
    setArchivo(null);
    setDatos('');
    setHojas(null);
    setCuadre(null);
    setGrupos({});
    setOrdenGrupos([]);
    setElegidas([]);
    setAbierta('');
    setResultado(null);
    setEnviado('');
    setNonce((n) => n + 1);
  };

  const elegirArchivo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    setHojas(null);
    setResultado(null);
    setCargando(true);
    try {
      const b64 = await leerBase64(f);
      setDatos(b64);
      const previa = await pedidoService.previsualizar(b64, f.name);
      setHojas(previa.hojas);
      setCuadre(previa.cuadre);
      setGrupos(previa.grupos);
      setOrdenGrupos(previa.ordenGrupos);
      setElegidas(previa.hojas.filter((h) => h.sugerida).map((h) => h.pestana));
      setAbierta('__todo__');   // arranca en el pedido del día completo
    } catch (err) {
      setError(err.message);
      limpiar();
    } finally {
      setCargando(false);
    }
  };

  const alternar = (pestana) =>
    setElegidas((prev) =>
      prev.includes(pestana) ? prev.filter((p) => p !== pestana) : [...prev, pestana]);

  const confirmar = async () => {
    setCargando(true);
    try {
      setResultado(await pedidoService.importar(datos, archivo.name, fecha, elegidas));
      setHojas(null);
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const TODO = '__todo__';

  const hoja = hojas
    ? (abierta === TODO ? hojaDelDia(hojas, elegidas) : hojas.find((h) => h.pestana === abierta))
    : null;
  const tramos = agruparDestinos(hoja?.destinos ?? [], grupos, ordenGrupos);
  const destinos = enOrden(tramos);
  const avisos = hoja?.renglones.filter((r) => r.aviso) ?? [];
  const totalElegido = (hojas ?? [])
    .filter((h) => elegidas.includes(h.pestana))
    .reduce((a, h) => a + h.total_piezas, 0);

  return (
    <Layout title="Pedido del día" subtitle="Importar la hoja de producción de Drive">
      <div className="ped-card">
        <div className="ped-card-head">
          <h3>Subir la hoja</h3>
          {archivo && <span className="ped-badge info">Hoja cargada</span>}
        </div>

        <div className="ped-grid">
          <div className="ped-field ped-archivo">
            <label htmlFor="ped-file">Archivo de la hoja *</label>
            {archivo ? (
              <span className="ped-archivo-puesto">
                <span className="ped-archivo-nombre" title={archivo.name}>{archivo.name}</span>
                <button
                  type="button"
                  className="ped-archivo-quitar"
                  onClick={limpiar}
                  title="Quitar el archivo"
                  aria-label="Quitar el archivo"
                >
                  ✕
                </button>
              </span>
            ) : (
              <>
                <input
                  key={nonce}
                  id="ped-file"
                  type="file"
                  accept=".xlsx,.csv,text/csv"
                  onChange={elegirArchivo}
                />
                <label className="ped-archivo-elegir" htmlFor="ped-file">
                  Elegir el .xlsx de Drive
                </label>
              </>
            )}
          </div>
          <div className="ped-field">
            <label htmlFor="ped-fecha">Fecha del pedido *</label>
            <input
              id="ped-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>

        <div className="ped-acciones">
          <button
            className="ped-btn secundario"
            disabled={!guardado}
            onClick={() => window.open(urlPdfPedido(fecha), '_blank')}
          >
            Descargar el PDF
          </button>
          {aQuienes.length > 1 && (
            <select value={aQuien} onChange={(e) => setAQuien(e.target.value)}>
              {aQuienes.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button
            className="ped-btn primario"
            disabled={cargando || !aQuienes.length || !guardado}
            onClick={async () => {
              setCargando(true);
              setEnviado('');
              try {
                const r = await pedidoService.enviar(fecha, aQuien);
                setEnviado(`Enviado a ${r.enviado_a} (${Math.round(r.bytes / 1024)} KB)`);
              } catch (err) {
                setError(err.message);
              } finally {
                setCargando(false);
              }
            }}
          >
            {aQuienes.length ? `Enviar a ${aQuien}` : 'Telegram sin configurar'}
          </button>
          {enviado && <span className="ped-badge ok">{enviado}</span>}
          {guardado === false && (
            <span className="ped-hint">
              No hay pedido guardado del {fecha}: impórtalo abajo y estos dos se prenden.
            </span>
          )}
        </div>

        <p className="ped-nota">
          Los dos botones mandan el pedido <strong>ya guardado</strong> de esa fecha,
          no lo que estés viendo abajo.
        </p>
        <p className="ped-nota">
          En Drive: <strong>Archivo → Descargar → Microsoft Excel (.xlsx)</strong> y sube
          ese archivo: trae todas las pestañas de un jalón. El CSV también sirve, pero
          solo exporta la pestaña que tengas abierta.
        </p>
      </div>

      {cargando && <div className="ped-card ped-cargando">Leyendo la hoja…</div>}

      {resultado && (
        <div className="ped-card">
          <div className="ped-card-head">
            <h3>Pedido {resultado.pedido} guardado</h3>
            <span className="ped-badge ok">{resultado.renglones} renglones</span>
          </div>
          <p className="ped-nota">
            Pestañas: <strong>{resultado.pestanas.join(', ')}</strong> · destinos:{' '}
            <strong>{resultado.destinos.join(', ')}</strong>
          </p>
          {resultado.problemas.length > 0 && (
            <p className="ped-nota">
              <span className="ped-badge bad">
                {resultado.problemas.length} renglones quedaron fuera por su clave
              </span>
            </p>
          )}
        </div>
      )}

      {hojas && (
        <>
          <div className="ped-card">
            <div className="ped-card-head">
              <h3>{archivo?.name}</h3>
              <button className="ped-btn secundario" onClick={limpiar}>
                Quitar el archivo
              </button>
            </div>
            <p className="ped-nota">Elige qué pestañas entran al pedido del día:</p>
            <div className="table-container">
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Importar</th>
                    <th>Pestaña</th>
                    <th className="cell-right">Productos</th>
                    <th className="cell-right">Piezas</th>
                    <th>Destinos</th>
                    <th className="cell-right">Fuera</th>
                  </tr>
                </thead>
                <tbody>
                  {hojas.map((h) => (
                    <tr key={h.pestana}>
                      <td>
                        <input
                          type="checkbox"
                          className="ped-check"
                          checked={elegidas.includes(h.pestana)}
                          onChange={() => alternar(h.pestana)}
                        />
                      </td>
                      <td>
                        <button
                          className={`ped-tab${abierta === h.pestana ? ' is-active' : ''}`}
                          onClick={() => setAbierta(h.pestana)}
                        >
                          {h.pestana}
                        </button>
                        {h.es_resumen && <span className="ped-hint"> — resumen de las otras</span>}
                        {!!h.duplica_a.length && (
                          <span className="ped-hint"> — ya viene en {h.duplica_a.join(', ')}</span>
                        )}
                        {!h.renglones.length && <span className="ped-hint"> — no pidió nada hoy</span>}
                      </td>
                      <td className="cell-right">{h.renglones.length}</td>
                      <td className="cell-right">{h.total_piezas.toLocaleString('es-MX')}</td>
                      <td>{h.destinos.join(', ')}</td>
                      <td className="cell-right">
                        {h.problemas.length
                          ? <span className="ped-badge bad">{h.problemas.length}</span>
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ped-confirmar">
              <span className="ped-resumen">
                Se van a importar <strong>{elegidas.length}</strong> pestañas ·{' '}
                <strong>{totalElegido.toLocaleString('es-MX')}</strong> piezas
              </span>
              <button
                className="ped-btn primario"
                onClick={confirmar}
                disabled={cargando || !elegidas.length}
              >
                Importar al sistema
              </button>
            </div>
          </div>

          {cuadre && (
            <div className="ped-card">
              <div className="ped-card-head">
                <h3>Cuadre contra «{cuadre.pestana}»</h3>
                {cuadre.diferencias.length
                  ? <span className="ped-badge warn">{cuadre.diferencias.length} no cuadran</span>
                  : <span className="ped-badge ok">Cuadra</span>}
              </div>
              <p className="ped-nota">
                {cuadre.comparados} productos cuadran con el resumen
                {cuadre.diferencias.length
                  ? `, ${cuadre.diferencias.length} no. El resumen lleva la cuenta en charolas y el detalle en piezas: si no coinciden, falta una pestaña por marcar o alguien tecleó de más en una de las dos.`
                  : '. La suma del detalle coincide con el total del día.'}
              </p>
              {cuadre.diferencias.length > 0 && (
                <div className="table-container">
                  <table className="sys-table">
                    <thead>
                      <tr>
                        <th>Clave</th><th>Producto</th>
                        <th className="cell-right">Dice el resumen</th>
                        <th className="cell-right">Suma el detalle</th>
                        <th className="cell-right">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadre.diferencias.map((d) => (
                        <tr key={d.clave}>
                          <td>{d.clave}</td>
                          <td>{d.producto}</td>
                          <td className="cell-right">{d.resumen}</td>
                          <td className="cell-right">{d.detalle}</td>
                          <td className="cell-right"><strong>{d.detalle - d.resumen}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {hoja?.problemas.length > 0 && (
            <div className="ped-card">
              <div className="ped-card-head">
                <h3>En «{hoja.pestana}» estos renglones NO se importan</h3>
                <span className="ped-badge bad">{hoja.problemas.length} fuera</span>
              </div>
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr><th>Clave</th><th>Producto en la hoja</th><th>Motivo</th></tr>
                  </thead>
                  <tbody>
                    {hoja.problemas.map((p, i) => (
                      <tr key={i}>
                        <td>{p.clave || '—'}</td>
                        <td>{p.producto}</td>
                        <td>{p.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="ped-card">
              <div className="ped-card-head">
                <h3>Sí entran, pero el nombre no coincide</h3>
                <span className="ped-badge warn">{avisos.length} por revisar</span>
              </div>
              <p className="ped-nota">Manda la clave, no el nombre. Revisa que sea el pan que crees.</p>
              <ul className="ped-avisos">{avisos.map((r, i) => <li key={i}>{r.aviso}</li>)}</ul>
            </div>
          )}

          {hoja && (
            <div className="ped-card">
              <div className="ped-grid">
                <div className="ped-field">
                  <label htmlFor="ped-ver">Ver el pedido de</label>
                  <select id="ped-ver" value={abierta} onChange={(e) => setAbierta(e.target.value)}>
                    <option value={TODO}>
                      — TODO EL DÍA (las {elegidas.length} pestañas marcadas) —
                    </option>
                    {hojas.map((h) => (
                      <option key={h.pestana} value={h.pestana}>
                        {h.pestana} — {h.total_piezas.toLocaleString('es-MX')} pz
                        {h.renglones.length ? '' : ' (sin pedido)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ped-card-head" style={{ marginTop: 'var(--space-5)' }}>
                <h3>
                  {abierta === TODO
                    ? `Pedido del día — ${hoja.renglones.length} productos, ${hoja.total_piezas.toLocaleString('es-MX')} piezas`
                    : `«${hoja.pestana}» — lo que se va a importar`}
                </h3>
              </div>
              {!hoja.renglones.length && (
                <p className="ped-nota">«{hoja.pestana}» no pidió nada hoy.</p>
              )}
              <div className="table-container">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th colSpan={2} />
                      {tramos.map((t) => (
                        <th key={t.grupo} colSpan={t.destinos.length} className="cell-center">
                          {t.grupo}
                        </th>
                      ))}
                      <th colSpan={2} />
                    </tr>
                    <tr>
                      <th>Clave</th>
                      <th>Producto</th>
                      {destinos.map((d) => <th key={d} className="cell-right">{d}</th>)}
                      <th className="cell-right">Total</th>
                      <th className="cell-right">Charolas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoja.renglones.map((r) => {
                      const total = suma(r.piezas);
                      return (
                        <tr key={r.clave}>
                          <td>{r.clave}</td>
                          <td>{r.item_name}</td>
                          {destinos.map((d) => (
                            <td key={d} className="cell-right">{r.piezas[d] || ''}</td>
                          ))}
                          <td className="cell-right"><strong>{total}</strong></td>
                          <td
                            className="cell-right"
                            title={r.piezas_por_charola ? `${r.piezas_por_charola} pz por charola` : ''}
                          >
                            {r.charolas_texto || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>TOTAL</th>
                      {destinos.map((d) => (
                        <th key={d} className="cell-right">
                          {hoja.renglones
                            .reduce((a, r) => a + (r.piezas[d] || 0), 0)
                            .toLocaleString('es-MX')}
                        </th>
                      ))}
                      <th className="cell-right">
                        {hoja.total_piezas.toLocaleString('es-MX')}
                      </th>
                      <th />
                    </tr>
                    <tr>
                      <th colSpan={2}>POR GRUPO</th>
                      {tramos.map((t) => (
                        <th key={t.grupo} colSpan={t.destinos.length} className="cell-center">
                          {hoja.renglones
                            .reduce((a, r) => a + t.destinos.reduce((x, d) => x + (r.piezas[d] || 0), 0), 0)
                            .toLocaleString('es-MX')}
                        </th>
                      ))}
                      <th colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <ModalError
        isOpen={!!error}
        title="No se pudo leer la hoja"
        message={error}
        onClose={() => setError('')}
      />
    </Layout>
  );
}
