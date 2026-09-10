// src/pages/Liquidacion.tsx
// Cierre de ruta de la camioneta: qué se llevó, qué regresó, qué se tiró.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { camionetaService, type ResumenDia } from '../services/frappeCamioneta';
import { stockService } from '../services/frappeStock';
import { excesos, previsualizar, renglonesCaptura, yaTuvoCierre, type Captura } from '../utils/cierreRuta';
import { numero, pesos } from '../utils/formato';
import '../styles/global.css';
import '../styles/Liquidacion.css';

/**
 * El repartidor llega cuando la panadería ya cerró, así que captura él mismo y
 * ve SOLO su camioneta: el backend la saca de la sesión y esta pantalla nunca
 * manda un almacén.
 *
 * Captura dos columnas por producto:
 *
 *   REGRESA  lo que trae de vuelta y se revende (pan dulce, vive un día más).
 *   SE TIRÓ  el bolillo. Todo, incluido el que se muele para pan molido: como
 *            bolillo ya no existe, y el pan molido lo da de alta matriz.
 *
 * La venta no se teclea: sale por diferencia. Lo que se ve mientras teclea es
 * una VISTA PREVIA calculada en el render con funciones puras — nada de
 * `useEffect` escribiendo estado derivado, que fue el bug de `precio_final` que
 * viajó desfasado al servidor el 17-ago.
 */
function Liquidacion() {
  const [resumen, setResumen] = useState<ResumenDia | null>(null);
  const [captura, setCaptura] = useState<Captura>({});
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [destino, setDestino] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [datos, almacenes] = await Promise.all([
        camionetaService.resumenDia(),
        stockService.fetchAllWarehousesInclusive(),
      ]);
      setResumen(datos);
      setSucursales(almacenes.filter((a: any) => a.warehouse_type === 'SUCURSAL'));
      setDestino(prev => prev || datos.sucursal_regreso_sugerida || '');
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar tu ruta');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Todo lo derivado se calcula en el render. Si viviera en estado, quedaría un
  // ciclo atrás de lo que el repartidor está viendo.
  const liq = useMemo(() => (resumen ? previsualizar(resumen, captura) : null), [resumen, captura]);
  const malos = useMemo(
    () => (resumen ? excesos(resumen.salidas, captura) : []),
    [resumen, captura],
  );
  const pendientes = renglonesCaptura(captura);
  const hayRegreso = pendientes.some(r => r.regresa > 0);
  const puedeGuardar = pendientes.length > 0 && malos.length === 0 && !guardando;

  const teclear = (item_code: string, campo: 'regresa' | 'tiro', valor: string) =>
    setCaptura(prev => {
      // Se guarda el TEXTO, no el número: "1." a medio teclear tiene que poder
      // seguir escribiéndose, y un campo vacío no es un cero.
      const actual = prev[item_code] ?? { regresa: '', tiro: '' };
      return { ...prev, [item_code]: { ...actual, [campo]: valor } };
    });

  const confirmar = async () => {
    setGuardando(true);
    setError('');
    try {
      const r = await camionetaService.cerrarDia({
        fecha: resumen?.fecha,
        almacenRegreso: hayRegreso ? destino : undefined,
        renglones: pendientes,
      });
      setCaptura({});
      setResumen(r.resumen);
      setExito(
        [r.traspaso && `Regreso ${r.traspaso}`, r.merma && `Merma ${r.merma}`]
          .filter(Boolean).join(' · '),
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar el cierre');
    } finally {
      setGuardando(false);
    }
  };

  const salidas = resumen?.salidas ?? [];

  return (
    <Layout>
      <div className="liq">
        <header className="liq-cabecera">
          <div>
            <h1 className="liq-titulo">Cierre de ruta</h1>
            <p className="liq-sub">
              {resumen ? `${resumen.camioneta} · ${resumen.fecha}` : 'Cargando tu camioneta…'}
            </p>
          </div>
          {resumen && yaTuvoCierre(resumen) && (
            <span className="liq-badge liq-badge--aviso">Ya tiene movimientos de cierre hoy</span>
          )}
        </header>

        {error && <div className="liq-aviso liq-aviso--error" role="alert">{error}</div>}
        {exito && <div className="liq-aviso liq-aviso--ok" role="status">Registrado · {exito}</div>}

        {liq && (
          <section className="liq-totales">
            <article className="liq-stat">
              <span className="liq-stat-label">Vendido</span>
              <strong className="liq-stat-valor">{pesos(liq.totalVenta)}</strong>
            </article>
            <article className="liq-stat">
              <span className="liq-stat-label">Comisión</span>
              <strong className="liq-stat-valor liq-stat-valor--resta">−{pesos(liq.comision)}</strong>
            </article>
            <article className="liq-stat liq-stat--fuerte">
              <span className="liq-stat-label">Entrega a matriz</span>
              <strong className="liq-stat-valor">{pesos(liq.neto)}</strong>
            </article>
          </section>
        )}

        {liq && liq.inconsistentes.length > 0 && (
          <div className="liq-aviso liq-aviso--error">
            Estos productos regresaron o se tiraron más de lo que salieron:{' '}
            {liq.inconsistentes.map(r => r.item_name).join(', ')}
          </div>
        )}

        <section className="liq-tarjeta">
          {cargando && <p className="liq-vacio">Cargando…</p>}
          {!cargando && salidas.length === 0 && (
            <p className="liq-vacio">Hoy no salió nada en esta camioneta.</p>
          )}

          {salidas.length > 0 && (
            <div className="liq-tabla-scroll">
              <table className="liq-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="liq-num">Se llevó</th>
                    <th className="liq-num">Regresa</th>
                    <th className="liq-num">Se tiró</th>
                    <th className="liq-num">Vendido</th>
                    <th className="liq-num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {liq?.renglones.map(r => (
                    <tr key={r.item_code} className={malos.includes(r.item_code) ? 'liq-fila--mala' : ''}>
                      <td>
                        <span className="liq-producto">{r.item_name}</span>
                        <span className="liq-clave">{r.item_code}</span>
                      </td>
                      <td className="liq-num">{numero(r.salio)} {r.uom}</td>
                      <td className="liq-num">
                        <input
                          className="liq-input" type="text" inputMode="decimal"
                          placeholder="0" value={captura[r.item_code]?.regresa ?? ''}
                          onChange={e => teclear(r.item_code, 'regresa', e.target.value)}
                        />
                      </td>
                      <td className="liq-num">
                        <input
                          className="liq-input" type="text" inputMode="decimal"
                          placeholder="0" value={captura[r.item_code]?.tiro ?? ''}
                          onChange={e => teclear(r.item_code, 'tiro', e.target.value)}
                        />
                      </td>
                      <td className="liq-num liq-vendido">{numero(r.vendido)}</td>
                      <td className="liq-num">{pesos(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {salidas.length > 0 && (
          <footer className="liq-pie">
            <label className="liq-campo">
              <span>¿Dónde dejas lo que regresa?</span>
              <select
                className="liq-select" value={destino}
                onChange={e => setDestino(e.target.value)}
                disabled={!hayRegreso}
              >
                <option value="">Elige una sucursal</option>
                {sucursales.map(s => (
                  <option key={s.name} value={s.name}>{s.label || s.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button" className="liq-btn" onClick={confirmar}
              disabled={!puedeGuardar || (hayRegreso && !destino)}
            >
              {guardando ? 'Registrando…' : 'Confirmar cierre'}
            </button>
          </footer>
        )}
      </div>
    </Layout>
  );
}

export default Liquidacion;
