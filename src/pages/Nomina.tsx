import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import {
  nominaService,
  type Empleado,
  type Sucursal,
  type Corrida,
  type ReporteRow,
} from '../services/frappeNomina';
import '../styles/Nomina.css'; // <-- Tu CSS hace toda la magia aquí

type Num = number | string | null | undefined;
const money = (n: Num) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

type Flash = (tipo: 'ok' | 'error', texto: string) => void;

function proximoMiercoles(): string {
  const d = new Date();
  const diff = (3 - d.getDay() + 7) % 7; 
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface Fila { empleado: string; declarado: string; retenciones: string; efectivo: string; }
const filaVacia = (): Fila => ({ empleado: '', declarado: '', retenciones: '', efectivo: '' });

export default function Nomina() {
  const [tab, setTab] = useState<'corrida' | 'empleados' | 'reporte'>('corrida');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const flash: Flash = useCallback((tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  }, []);

  const cargarBase = useCallback(async () => {
    try {
      const [emps, sucs] = await Promise.all([
        nominaService.getEmpleados(),
        nominaService.getSucursales(),
      ]);
      setEmpleados(emps);
      setSucursales(sucs);
    } catch (e) { flash('error', (e as Error).message); }
  }, []);

  useEffect(() => { cargarBase(); }, [cargarBase]);

  return (
    <Layout>
      <div className="nomina">
        <header className="nomina-head">
          <h1>Nómina</h1>
          <nav className="nomina-tabs">
            {(['corrida', 'empleados', 'reporte'] as const).map(t => (
              <button key={t}
                className={'nomina-tab' + (tab === t ? ' active' : '')}
                onClick={() => setTab(t)}>
                {t === 'corrida' ? 'Corrida semanal' : t === 'empleados' ? 'Empleados' : 'Costo real'}
              </button>
            ))}
          </nav>
        </header>

        {msg && <div className={`nomina-msg ${msg.tipo}`}>{msg.texto}</div>}

        {tab === 'corrida' && <Corrida empleados={empleados} flash={flash} />}
        {tab === 'empleados' && (
          <Empleados empleados={empleados} sucursales={sucursales} recargar={cargarBase} flash={flash} />
        )}
        {tab === 'reporte' && <Reporte flash={flash} />}
      </div>
    </Layout>
  );
}

// ─────────────────────────────────────────────── Corrida semanal
function Corrida({ empleados, flash }: { empleados: Empleado[]; flash: Flash }) {
  const [nominaDe, setNominaDe] = useState('');
  const [fechaPago, setFechaPago] = useState<string>(proximoMiercoles);
  const [semanaDel, setSemanaDel] = useState('');
  const [semanaAl, setSemanaAl] = useState('');
  const [filas, setFilas] = useState<Fila[]>([filaVacia()]);
  const [guardando, setGuardando] = useState(false);
  const [corridas, setCorridas] = useState<Corrida[]>([]);

  const [filtroNom, setFiltroNom] = useState<'todas' | 'ALMA RODRIGUEZ' | 'LUIS TORRES'>('todas');

  const cargarCorridas = useCallback(async () => {
    try { setCorridas(await nominaService.getCorridas()); }
    catch (e) { flash('error', (e as Error).message); }
  }, [flash]);
  useEffect(() => { cargarCorridas(); }, [cargarCorridas]);

  const corridasFiltradas = useMemo(
    () => filtroNom === 'todas' ? corridas : corridas.filter(c => c.nomina_de === filtroNom),
    [corridas, filtroNom],
  );
  
  const totalesCorridas = useMemo(() => corridasFiltradas.reduce((t, c) => {
    if (c.docstatus !== 1) return t;
    t.neto += Number(c.total_neto || 0);
    t.costo += Number(c.total_costo || 0);
    return t;
  }, { neto: 0, costo: 0 }), [corridasFiltradas]);

  const cancelarCorrida = async (c: Corrida) => {
    if (!window.confirm(`Cancelar la corrida ${c.name}? Se borrará su gasto de nómina.`)) return;
    try {
      await nominaService.cancelarCorrida(c.name);
      flash('ok', `Corrida ${c.name} cancelada`);
      cargarCorridas();
    } catch (e) { flash('error', (e as Error).message); }
  };

  // Solo empleados de la nómina elegida (Alma/Luis). Sin nómina elegida, ninguno.
  const empleadosNomina = useMemo(
    () => nominaDe ? empleados.filter(e => e.custom_nomina_de === nominaDe) : [],
    [empleados, nominaDe],
  );

  const setFila = (i: number, campo: keyof Fila, val: string) =>
    setFilas(fs => fs.map((f, j) => j === i ? { ...f, [campo]: val } : f));
  const addFila = () => setFilas(fs => [...fs, filaVacia()]);
  const delFila = (i: number) => setFilas(fs => fs.filter((_, j) => j !== i));

  const calc = (f: Fila) => {
    const d = Number(f.declarado || 0), r = Number(f.retenciones || 0), e = Number(f.efectivo || 0);
    return { neto: d - r + e, costo: d + e };
  };
  
  const totales = useMemo(() => filas.reduce((t, f) => {
    const { neto, costo } = calc(f);
    t.declarado += Number(f.declarado || 0);
    t.retenciones += Number(f.retenciones || 0);
    t.efectivo += Number(f.efectivo || 0);
    t.neto += neto; t.costo += costo;
    return t;
  }, { declarado: 0, retenciones: 0, efectivo: 0, neto: 0, costo: 0 }), [filas]);

  const guardar = async (submit: boolean) => {
    const renglones = filas.filter(f => f.empleado);
    if (!nominaDe) { flash('error', 'Elige de quién es la nómina (Alma / Luis)'); return; }
    if (!renglones.length) { flash('error', 'Agrega al menos un empleado'); return; }
    if (submit && !window.confirm('Confirmar la corrida generará el gasto de nómina. ¿Continuar?')) return;
    setGuardando(true);
    try {
      const res = await nominaService.crearCorrida({
        fecha_pago: fechaPago, nomina_de: nominaDe,
        semana_del: semanaDel || null, semana_al: semanaAl || null,
        renglones, submit: submit ? 1 : 0,
      });
      flash('ok', `Corrida ${res.name} ${submit ? 'confirmada' : 'guardada en borrador'}`);
      setFilas([filaVacia()]);
      cargarCorridas();
    } catch (e) { flash('error', (e as Error).message); }
    finally { setGuardando(false); }
  };

  return (
    <div className="nomina-corrida">
      <div className="nomina-cabecera">
        <label>Nómina de
          <select value={nominaDe} onChange={e => setNominaDe(e.target.value)}>
            <option value="">— elegir —</option>
            <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
            <option value="LUIS TORRES">Luis Torres</option>
          </select>
        </label>
        <label>Fecha de pago<input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} /></label>
        <label>Semana del<input type="date" value={semanaDel} onChange={e => setSemanaDel(e.target.value)} /></label>
        <label>al<input type="date" value={semanaAl} onChange={e => setSemanaAl(e.target.value)} /></label>
      </div>

      <table className="nomina-tabla">
        <thead>
          <tr>
            <th>Empleado</th><th>Declarado</th><th>Retenciones</th><th>Efectivo</th>
            <th>Neto</th><th>Costo patrón</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const { neto, costo } = calc(f);
            return (
              <tr key={i}>
                <td>
                  <select value={f.empleado} onChange={e => setFila(i, 'empleado', e.target.value)} disabled={!nominaDe}>
                    <option value="">{nominaDe ? '— elegir —' : '— elige nómina primero —'}</option>
                    {empleadosNomina.map(emp => (
                      <option key={emp.name} value={emp.name}>{emp.employee_name}{emp.branch ? ` (${emp.branch})` : ''}</option>
                    ))}
                  </select>
                </td>
                <td><input type="number" step="0.01" value={f.declarado} onChange={e => setFila(i, 'declarado', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={f.retenciones} onChange={e => setFila(i, 'retenciones', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={f.efectivo} onChange={e => setFila(i, 'efectivo', e.target.value)} /></td>
                <td className="ro">{money(neto)}</td>
                <td className="ro">{money(costo)}</td>
                <td><button className="nomina-del" onClick={() => delFila(i)} title="Quitar">×</button></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th>Totales</th>
            <th>{money(totales.declarado)}</th>
            <th>{money(totales.retenciones)}</th>
            <th>{money(totales.efectivo)}</th>
            <th>{money(totales.neto)}</th>
            <th>{money(totales.costo)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>

      <div className="nomina-acciones">
        <button onClick={addFila}>+ Empleado</button>
        <span className="spacer" />
        <button disabled={guardando} onClick={() => guardar(false)}>Guardar borrador</button>
        <button disabled={guardando} className="primary" onClick={() => guardar(true)}>Guardar y confirmar</button>
      </div>

      <div className="nomina-lista-head">
        <h2>Corridas recientes</h2>
        <label>Filtrar:
          <select value={filtroNom} onChange={e => setFiltroNom(e.target.value as typeof filtroNom)}>
            <option value="todas">Todas las nóminas</option>
            <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
            <option value="LUIS TORRES">Luis Torres</option>
          </select>
        </label>
      </div>
      <table className="nomina-lista">
        <thead>
          <tr><th>Folio</th><th>Nómina de</th><th>Pago</th><th>Estado</th><th>Neto</th><th>Costo patrón</th><th>Gasto Generado</th><th></th></tr>
        </thead>
        <tbody>
          {corridasFiltradas.map(c => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td>{c.nomina_de}</td>
              <td>{c.fecha_pago}</td>
              <td>
                {c.docstatus === 1
                  ? <span className="nomina-badge confirmada">Confirmada</span>
                  : c.docstatus === 2
                    ? <span className="nomina-badge cancelada">Cancelada</span>
                    : <span className="nomina-badge borrador">Borrador</span>}
              </td>
              <td>{money(c.total_neto)}</td>
              <td>{money(c.total_costo)}</td>
              <td>{c.egreso_generado || '—'}</td>
              <td>{c.docstatus === 1 && (
                <button className="nomina-del" title="Cancelar corrida" onClick={() => cancelarCorrida(c)}>×</button>
              )}</td>
            </tr>
          ))}
          {!corridasFiltradas.length && <tr><td colSpan={8} className="vacio">Sin corridas aún</td></tr>}
        </tbody>
        {totalesCorridas.costo > 0 && (
          <tfoot>
            <tr>
              <th colSpan={4}>Total confirmadas{filtroNom !== 'todas' ? ` (${filtroNom === 'ALMA RODRIGUEZ' ? 'Alma' : 'Luis'})` : ''}</th>
              <th>{money(totalesCorridas.neto)}</th>
              <th>{money(totalesCorridas.costo)}</th>
              <th colSpan={2}></th>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────── Empleados
function Empleados({ empleados, sucursales, recargar, flash }: {
  empleados: Empleado[]; sucursales: Sucursal[]; recargar: () => void; flash: Flash;
}) {
  const [form, setForm] = useState({ nombre: '', fecha_ingreso: '', fecha_nacimiento: '', genero: 'Male', sucursal: '', nomina_de: '' });
  const [nuevaSuc, setNuevaSuc] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!form.nombre.trim()) { flash('error', 'El nombre es obligatorio'); return; }
    if (!form.nomina_de) { flash('error', 'Elige de quién es la nómina (Alma / Luis)'); return; }
    try {
      const res = await nominaService.crearEmpleado({
        nombre: form.nombre, fecha_ingreso: form.fecha_ingreso, fecha_nacimiento: form.fecha_nacimiento,
        genero: form.genero, sucursal: form.sucursal || null, nomina_de: form.nomina_de,
      });
      flash('ok', `Empleado ${res.employee_name} dado de alta`);
      setForm({ nombre: '', fecha_ingreso: '', fecha_nacimiento: '', genero: 'Male', sucursal: '', nomina_de: '' });
      recargar();
    } catch (e) { flash('error', (e as Error).message); }
  };

  const crearSucursal = async () => {
    if (!nuevaSuc.trim()) return;
    try { await nominaService.crearSucursal(nuevaSuc); setNuevaSuc(''); recargar(); flash('ok', 'Sucursal creada'); }
    catch (e) { flash('error', (e as Error).message); }
  };

  const asignarNomina = async (name: string, nomina_de: string) => {
    try {
      await nominaService.editarEmpleado(name, { nomina_de });
      recargar();
      if (nomina_de) flash('ok', 'Nómina asignada');
    } catch (e) { flash('error', (e as Error).message); }
  };

  return (
    <div className="nomina-empleados">
      <div className="nomina-form">
        <h2>Alta de empleado</h2>
        <label>Nombre<input value={form.nombre} onChange={e => set('nombre', e.target.value)} /></label>
        <label>Fecha de ingreso<input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} /></label>
        <label>Fecha de nacimiento<input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} /></label>
        <label>Género
          <select value={form.genero} onChange={e => set('genero', e.target.value)}>
            <option value="Male">Hombre</option>
            <option value="Female">Mujer</option>
          </select>
        </label>
        <label>Sucursal
          <select value={form.sucursal} onChange={e => set('sucursal', e.target.value)}>
            <option value="">— sin asignar —</option>
            {sucursales.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>
        <label>Nómina de
          <select value={form.nomina_de} onChange={e => set('nomina_de', e.target.value)}>
            <option value="">— elegir —</option>
            <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
            <option value="LUIS TORRES">Luis Torres</option>
          </select>
        </label>
        <button className="primary" onClick={guardar}>Dar de alta</button>

        <div className="nomina-suc-nueva">
          <input placeholder="Nueva sucursal" value={nuevaSuc} onChange={e => setNuevaSuc(e.target.value)} />
          <button onClick={crearSucursal}>+ Sucursal</button>
        </div>
      </div>

      <div className="nomina-lista-emp">
        <h2>Empleados ({empleados.length})</h2>
        <table className="nomina-lista">
          <thead><tr><th>Nombre</th><th>Sucursal</th><th>Nómina de</th><th>Ingreso</th></tr></thead>
          <tbody>
            {empleados.map(e => (
              <tr key={e.name}>
                <td>{e.employee_name}</td>
                <td>{e.branch || '—'}</td>
                <td>
                  <select
                    className={'nomina-inline-select' + (e.custom_nomina_de ? '' : ' sin-asignar')}
                    value={e.custom_nomina_de || ''}
                    onChange={ev => asignarNomina(e.name, ev.target.value)}
                  >
                    <option value="">— sin asignar —</option>
                    <option value="ALMA RODRIGUEZ">Alma Rodríguez</option>
                    <option value="LUIS TORRES">Luis Torres</option>
                  </select>
                </td>
                <td>{e.date_of_joining}</td>
              </tr>
            ))}
            {!empleados.length && <tr><td colSpan={4} className="vacio">Sin empleados aún</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── Reporte costo real
function Reporte({ flash }: { flash: Flash }) {
  const [desde, setDesde] = useState('');
  const [hasta, setDesde2] = useState(''); // Nota: dejé la variable original 'hasta' para no romper tu lógica
  const [hastaEstado, setHasta] = useState(''); 
  const [datos, setDatos] = useState<ReporteRow[]>([]);

  const cargar = useCallback(async () => {
    try { setDatos(await nominaService.getReporteCostoReal({ fecha_desde: desde || null, fecha_hasta: hastaEstado || null })); }
    catch (e) { flash('error', (e as Error).message); }
  }, [desde, hastaEstado, flash]);
  useEffect(() => { cargar(); }, [cargar]);

  const total = datos.reduce((s, r) => s + Number(r.costo_patron || 0), 0);

  return (
    <div className="nomina-reporte">
      <div className="nomina-cabecera">
        <label>Desde<input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={hastaEstado} onChange={e => setHasta(e.target.value)} /></label>
      </div>
      <table className="nomina-lista">
        <thead>
          <tr><th>Sucursal</th><th>Empleado</th><th>Corridas</th><th>Declarado</th><th>Efectivo</th><th>Neto</th><th>Costo patrón</th></tr>
        </thead>
        <tbody>
          {datos.map((r, i) => (
            <tr key={i}>
              <td>{r.sucursal}</td><td>{r.empleado}</td><td>{r.corridas}</td>
              <td>{money(r.declarado)}</td><td>{money(r.efectivo)}</td>
              <td>{money(r.neto)}</td><td>{money(r.costo_patron)}</td>
            </tr>
          ))}
          {!datos.length && <tr><td colSpan={7} className="vacio">Sin datos en el rango</td></tr>}
        </tbody>
        <tfoot><tr><th colSpan={6}>Costo real total</th><th>{money(total)}</th></tr></tfoot>
      </table>
    </div>
  );
}