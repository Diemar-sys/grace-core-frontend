// Estado de cuenta de la Hoja del día (Diemar 23-sep): por destino, un renglón por
// día cobrado. Camioneta: VENTA | COMISIÓN 10% | AYUDANTE | SUELDO | RECIBIR/PAGAR |
// PAGADO/ABONO. Cliente, sucursal y pueblo no llevan comisión: VENTA | RECIBIR |
// PAGADO/ABONO. Los números salen de las facturas (servidor); aquí no se calcula
// dinero. «Cobrar» abre el MISMO modal que Venta B2B → Cobrar: un solo camino.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalRegistrarPago from './modals/ModalRegistrarPago';
import ModalError from './modals/ModalError';
import { hoyISO } from './modals/ModalEntradaPan';
import { hojaService, type DeudorHoja, type DiaCuenta, type EstadoCuenta } from '../services/frappeHoja';
import { grupoCobro, ventasService } from '../services/frappeSales';
import { semanaDe } from '../utils/hojaDia';
import { pesos } from '../utils/formato';

const ESTADO_DIA: Record<DiaCuenta['estado'], [string, string]> = {
  liquidado: ['LIQUIDADO', 'hoja-badge--verde'],
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

export default function EstadoCuentaHoja() {
  const [deudores, setDeudores] = useState<DeudorHoja[]>([]);
  const [destino, setDestino] = useState('');
  // 24-sep: la semana se elige con el calendario, como el día de la captura: cualquier
  // día → su semana lunes-domingo. (`type="week"` no existe en Firefox.)
  const [dia, setDia] = useState(hoyISO);
  const semana = useMemo(() => semanaDe(dia), [dia]);
  const [estado, setEstado] = useState<EstadoCuenta | null>(null);
  const [pagoModal, setPagoModal] = useState<ReturnType<typeof grupoCobro>>(null);
  const [error, setError] = useState('');
  const peticionRef = useRef(0);

  useEffect(() => {
    hojaService.deudores().then(setDeudores).catch((e: any) => setError(e?.message || 'No se pudo leer la lista'));
  }, []);

  const cargar = useCallback(async () => {
    const folio = ++peticionRef.current;
    if (!destino) { setEstado(null); return; }
    try {
      const e = await hojaService.estadoCuenta(destino, semana.desde, semana.hasta);
      if (peticionRef.current === folio) setEstado(e);   // una respuesta vieja no pisa la nueva
    } catch (e: any) {
      if (peticionRef.current === folio) setError(e?.message || 'No se pudo leer el estado de cuenta');
    }
  }, [destino, semana]);

  useEffect(() => { cargar(); }, [cargar]);

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
          Semana
          <input type="date" value={dia} onChange={e => e.target.value && setDia(e.target.value)} />
        </label>
        <strong className="hoja-estado__rango">Lunes {fechaCorta(semana.desde)} al domingo {fechaCorta(semana.hasta)}</strong>
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

          {/* resumen de la semana: los totales vienen del servidor, aquí no se suma dinero */}
          <div className="hoja-estado__resumen">
            <div className="hoja-estado__stat">
              <span className="hoja-estado__stat-label">Venta de la semana</span>
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
            {estado.total.a_favor > 0 && (
              <div className="hoja-estado__stat">
                <span className="hoja-estado__stat-label">Se le debe al repartidor</span>
                <span className="hoja-estado__stat-valor hoja-estado__stat-valor--favor">{pesos(estado.total.a_favor)}</span>
              </div>
            )}
          </div>

          {!estado.dias.length ? (
            <p className="hoja-dia__vacio">No hay días cobrados esta semana.</p>
          ) : (
            <div className="hoja-estado__tabla-wrap">
              <table className="sys-table hoja-estado__tabla">
                <thead>
                  <tr>
                    <th>FECHA</th><th className="cell-right">VENTA TOTAL</th>
                    {camioneta && (<><th className="cell-right">COMISIÓN 10%</th><th className="cell-right">AYUDANTE (FIJO)</th><th className="cell-right">SUELDO TOTAL</th></>)}
                    <th className="cell-right">{camioneta ? 'RECIBIR/PAGAR' : 'RECIBIR'}</th><th className="hoja-estado__col-pago">PAGADO/ABONO</th>
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
                      <td className="cell-right hoja-estado__recibir">{pesos(d.recibir)}</td>
                      <td className="hoja-estado__col-pago"><PagadoAbono d={d} /></td>
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
                    <td className="cell-right">{pesos(estado.total.recibir)}</td>
                    <td className="hoja-estado__col-pago">
                      {estado.total.debe > 0 ? `Debe ${pesos(estado.total.debe)}` : 'LIQUIDADO'}
                      {estado.total.a_favor > 0 && ` · a favor del repartidor ${pesos(estado.total.a_favor)}`}
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
