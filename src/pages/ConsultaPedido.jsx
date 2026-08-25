// src/pages/ConsultaPedido.jsx
// Consultas → Pedido del día: ver un pedido YA guardado y bajar su PDF.
// La pantalla de Operaciones importa; esta solo lee. La tabla la arma el backend
// con el mismo orden que el PDF (`_orden_producto`) para que papel y pantalla no
// digan cosas distintas del mismo pedido.
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ModalError from '../components/modals/ModalError';
import { pedidoService, urlPdfPedido } from '../services/frappePedido';
import '../styles/global.css';
import '../styles/Pedido.css';

const DIA_MES = { day: '2-digit', month: 'short' };
const fechaCorta = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', DIA_MES);

export default function ConsultaPedido() {
  const [fechas, setFechas] = useState([]);
  const [fecha, setFecha] = useState('');
  const [pedido, setPedido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState('');
  const [aQuien, setAQuien] = useState('');
  const [aQuienes, setAQuienes] = useState([]);

  useEffect(() => {
    pedidoService.fechas()
      .then((lista) => {
        setFechas(lista);
        setFecha((f) => f || lista[0]?.fecha || '');
        if (!lista.length) setCargando(false);
      })
      .catch((err) => { setError(err.message); setCargando(false); });
    pedidoService.destinatarios()
      .then((lista) => { setAQuienes(lista); setAQuien((a) => a || lista[0] || ''); })
      .catch(() => {});   // sin bot configurado la pantalla sigue sirviendo
  }, []);

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    setCargando(true);
    setEnviado('');
    pedidoService.consultar(fecha)
      .then((p) => { if (vigente) setPedido(p); })
      .catch((err) => { if (vigente) { setError(err.message); setPedido(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [fecha]);

  const destinos = pedido ? pedido.tramos.flatMap((t) => t.destinos) : [];
  const totalDe = (d) => (pedido?.renglones ?? []).reduce((a, r) => a + (r.piezas[d] || 0), 0);

  // Un renglón de departamento antes del primer producto de cada uno, igual que
  // el PDF: sin eso una tabla de 70 renglones es una lista sin relieve.
  const filas = [];
  let deptoActual = null;
  for (const r of pedido?.renglones ?? []) {
    if (r.depto !== deptoActual) {
      deptoActual = r.depto;
      filas.push({
        depto: r.depto,
        total: pedido.renglones
          .filter((q) => q.depto === r.depto)
          .reduce((a, q) => a + q.total, 0),
      });
    }
    filas.push(r);
  }

  return (
    <Layout title="Pedido del día" subtitle="Consultar un pedido guardado">
      <div className="ped-card">
        <div className="ped-card-head">
          <h3>Elegir el día</h3>
          {pedido && (
            <span className="ped-badge info">
              {pedido.renglones.length} productos · {pedido.total_piezas.toLocaleString('es-MX')} piezas
            </span>
          )}
        </div>

        <div className="ped-grid">
          <div className="ped-field">
            <label htmlFor="cped-fecha">Pedido guardado</label>
            <select
              id="cped-fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={!fechas.length}
            >
              {!fechas.length && <option value="">No hay pedidos guardados</option>}
              {fechas.map((f) => (
                <option key={f.name} value={f.fecha}>
                  {fechaCorta(f.fecha)} · {f.dia} — {f.total_piezas.toLocaleString('es-MX')} pz
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ped-acciones">
          <button
            className="ped-btn secundario"
            disabled={!pedido}
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
            disabled={!pedido || cargando || !aQuienes.length}
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
        </div>
      </div>

      {cargando && <div className="ped-card ped-cargando">Cargando el pedido…</div>}

      {!cargando && !fechas.length && (
        <div className="ped-card">
          <p className="ped-nota">
            Todavía no hay ningún pedido guardado. Se guardan en{' '}
            <strong>Operaciones → Pedido del día</strong>, importando la hoja de Drive.
          </p>
        </div>
      )}

      {!cargando && pedido && (
        <div className="ped-card">
          <div className="ped-card-head">
            <h3>{pedido.pedido} — {pedido.dia}</h3>
            <span className="ped-badge ok">{destinos.length} destinos</span>
          </div>
          <div className="table-container">
            <table className="sys-table">
              <thead>
                <tr>
                  <th colSpan={2} />
                  {pedido.tramos.map((t) => (
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
                {filas.map((f) => (f.depto !== undefined && f.clave === undefined ? (
                  <tr key={`d-${f.depto}`} className="ped-fila-depto">
                    <td colSpan={destinos.length + 3}>{f.depto}</td>
                    <td className="cell-right">{f.total.toLocaleString('es-MX')}</td>
                  </tr>
                ) : (
                  <tr key={f.clave}>
                    <td>{f.clave}</td>
                    <td>{f.producto}</td>
                    {destinos.map((d) => (
                      <td key={d} className="cell-right">{f.piezas[d] || ''}</td>
                    ))}
                    <td className="cell-right"><strong>{f.total}</strong></td>
                    <td
                      className="cell-right"
                      title={f.por_charola ? `${f.por_charola} pz por charola` : ''}
                    >
                      {f.charolas_texto || '—'}
                    </td>
                  </tr>
                )))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2}>TOTAL DEL DÍA</th>
                  {destinos.map((d) => (
                    <th key={d} className="cell-right">{totalDe(d).toLocaleString('es-MX')}</th>
                  ))}
                  <th className="cell-right">{pedido.total_piezas.toLocaleString('es-MX')}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <ModalError
        isOpen={!!error}
        title="No se pudo leer el pedido"
        message={error}
        onClose={() => setError('')}
      />
    </Layout>
  );
}
