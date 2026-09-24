// src/pages/Liquidacion.tsx
// Liquidación del repartidor SOBRE LA HOJA (22-sep): sin inventario de
// camioneta, sin almacén de regreso — no hay a dónde regresar porque ya no
// hay traspaso. El repartidor solo teclea REGRESA: lo que trae de vuelta
// (su inventario al regresar). Desde el 23-sep la MERMA («Se tiró») la pone
// Héctor en la Hoja del día; aquí se ve, no se teclea. Y la hoja solo aparece
// después de que matriz confirma el envío (etapa de la camioneta).
//
// La venta no se teclea: sale por diferencia (enviado − regresa − tiro), en
// una VISTA PREVIA calculada en el render con funciones puras — nada de
// `useEffect` escribiendo estado derivado, que fue el bug de `precio_final`
// que viajó desfasado al servidor el 17-ago.
//
// El servidor manda: `guardarRegreso` REEMPLAZA el regreso de cada
// renglón (no suma), así que siempre se mandan TODOS los renglones de la
// hoja, no solo los tecleados. Una vez que matriz confirma y factura el
// destino (`hoja.factura`), la hoja queda de solo lectura.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { hoyISO } from '../components/modals/ModalEntradaPan';
import { hojaService, type Hoja } from '../services/frappeHoja';
import { cantidad, excesos, previsualizar, type Captura, type ResumenRuta } from '../utils/cierreRuta';
import { COMISION_FIJA } from '../utils/liquidacion';
import { numero, pesos } from '../utils/formato';
import '../styles/global.css';
import '../styles/Liquidacion.css';

function Liquidacion() {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [captura, setCaptura] = useState<Captura>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const h = await hojaService.miHoja(hoyISO());
      setHoja(h);
      setCaptura(Object.fromEntries(
        h.renglones.map(r => [
          r.item_code,
          { regresa: r.regreso ? String(r.regreso) : '', tiro: r.merma ? String(r.merma) : '' },
        ]),
      ));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar tu hoja');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Todo lo derivado se calcula en el render. Si viviera en estado, quedaría un
  // ciclo atrás de lo que el repartidor está viendo.
  const resumen: ResumenRuta = useMemo(() => ({
    salidas: (hoja?.renglones ?? []).map(r => ({
      item_code: r.item_code, item_name: r.producto, qty: r.enviado, precio: r.precio,
    })),
    regresos: [],
    mermas: [],
  }), [hoja]);

  const liq = useMemo(() => previsualizar(resumen, captura), [resumen, captura]);
  const malos = useMemo(() => excesos(resumen.salidas, captura), [resumen, captura]);

  const cobrado = Boolean(hoja?.factura);
  const renglones = hoja?.renglones ?? [];

  const teclear = (item_code: string, campo: 'regresa', valor: string) =>
    setCaptura(prev => {
      // Se guarda el TEXTO, no el número: "1." a medio teclear tiene que poder
      // seguir escribiéndose, y un campo vacío no es un cero.
      const actual = prev[item_code] ?? { regresa: '', tiro: '' };
      return { ...prev, [item_code]: { ...actual, [campo]: valor } };
    });

  const enviar = async () => {
    if (!hoja) return;
    setGuardando(true);
    setError('');
    setExito(false);
    try {
      // TODOS los renglones: el servidor reemplaza, no suma. Mandar solo los
      // tecleados borraría (a ceros) lo que ya estaba guardado del lado del
      // servidor en un envío previo.
      const paraGuardar = hoja.renglones.map(r => ({
        item_code: r.item_code,
        regreso: cantidad(captura[r.item_code]?.regresa),
      }));
      const h = await hojaService.guardarRegreso(hoyISO(), paraGuardar);
      setHoja(h);
      setExito(true);
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Layout>
      <div className="liq">
        <header className="liq-cabecera">
          <div>
            <h1 className="liq-titulo">Liquidación</h1>
            <p className="liq-sub">
              {hoja ? hoja.destino : 'Cargando tu hoja…'}
            </p>
          </div>
          {cobrado && (
            <span className="liq-badge liq-badge--aviso">
              Cobrado{hoja?.factura ? ` · ${hoja.factura.name} · saldo ${pesos(hoja.factura.outstanding_amount)}` : ''}
            </span>
          )}
        </header>

        {error && <div className="liq-aviso liq-aviso--error" role="alert">{error}</div>}
        {exito && !error && <div className="liq-aviso liq-aviso--ok" role="status">Enviado a matriz</div>}

        {/* El desglose (10% + cuota fija) es SOLO de pantalla, para que el
            repartidor vea de dónde sale la comisión. La autoridad sigue siendo
            `calcularLiquidacion` (espejo del backend): aquí solo se resta
            COMISION_FIJA de `liq.comision`, nunca se recalcula el total. */}
        <section className="liq-totales">
          <article className="liq-stat">
            <span className="liq-stat-label">Venta</span>
            <strong className="liq-stat-valor">{pesos(liq.totalVenta)}</strong>
          </article>
          {liq.comision > 0 && (
            <>
              <article className="liq-stat">
                <span className="liq-stat-label">Comisión 10%</span>
                <strong className="liq-stat-valor liq-stat-valor--resta">{pesos(liq.comision - COMISION_FIJA)}</strong>
              </article>
              <article className="liq-stat">
                <span className="liq-stat-label">Cuota fija</span>
                <strong className="liq-stat-valor liq-stat-valor--resta">{pesos(COMISION_FIJA)}</strong>
              </article>
            </>
          )}
          <article className="liq-stat liq-stat--fuerte">
            <span className="liq-stat-label">Se debe</span>
            <strong className="liq-stat-valor">{pesos(liq.neto)}</strong>
          </article>
          {liq.aFavor > 0 && (
            <article className="liq-stat">
              <span className="liq-stat-label">A tu favor</span>
              <strong className="liq-stat-valor">{pesos(liq.aFavor)}</strong>
            </article>
          )}
        </section>

        {liq.inconsistentes.length > 0 && (
          <div className="liq-aviso liq-aviso--error">
            Estos productos regresaron o se tiraron más de lo que salieron:{' '}
            {liq.inconsistentes.map(r => r.item_name).join(', ')}
          </div>
        )}

        <section className="liq-tarjeta">
          {cargando && <p className="liq-vacio">Cargando…</p>}
          {!cargando && renglones.length === 0 && (
            <p className="liq-vacio">
              {hoja && !hoja.etapa && !cobrado
                ? 'Todavía no te envían pan: cuando matriz confirme tu envío, aquí aparece lo que llevas.'
                : 'Hoy no tienes hoja.'}
            </p>
          )}

          {renglones.length > 0 && (
            <div className="liq-tabla-scroll">
              <table className="liq-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="liq-num">Enviado</th>
                    <th className="liq-num">Regresa</th>
                    <th className="liq-num">Se tiró</th>
                    <th className="liq-num">Vendido</th>
                    <th className="liq-num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {liq.renglones.map(r => (
                    <tr key={r.item_code} className={malos.includes(r.item_code) ? 'liq-fila--mala' : ''}>
                      <td>
                        <span className="liq-producto">{r.item_name}</span>
                        <span className="liq-clave">{r.item_code}</span>
                      </td>
                      <td className="liq-num">{numero(r.salio)} {r.uom}</td>
                      <td className="liq-num">
                        <input
                          className="liq-input" type="text" inputMode="decimal"
                          aria-label={`Regresa ${r.item_name}`}
                          placeholder="0" value={captura[r.item_code]?.regresa ?? ''}
                          disabled={cobrado}
                          onChange={e => teclear(r.item_code, 'regresa', e.target.value)}
                        />
                      </td>
                      {/* la merma la pone Héctor (23-sep): aquí solo se ve */}
                      <td className="liq-num">{numero(cantidad(captura[r.item_code]?.tiro))}</td>
                      <td className="liq-num liq-vendido">{numero(r.vendido)} {r.uom}</td>
                      <td className="liq-num">{pesos(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {renglones.length > 0 && !cobrado && (
          <footer className="liq-pie">
            <button
              type="button" className="liq-btn" onClick={enviar}
              disabled={guardando || malos.length > 0}
            >
              {guardando ? 'Enviando…' : 'Enviar a matriz'}
            </button>
          </footer>
        )}
      </div>
    </Layout>
  );
}

export default Liquidacion;
