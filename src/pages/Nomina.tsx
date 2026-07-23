import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import {
  nominaService,
  type Empleado,
  type Sucursal,
  type Corrida,
  type RenglonInput,
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

interface Fila {
  empleado: string;
  // Percepciones
  sueldo: string; septimo_dia: string; prima_dominical: string; gratificacion: string; vacaciones: string;
  // Deducciones
  isr_mes: string; imss: string; prestamo_infonavit_cf: string; ajuste_neto: string;
  // Informativos (no suman)
  isr_antes_subsidio: string; infonavit_cf_corresp: string;
  efectivo: string;
}
const filaVacia = (): Fila => ({
  empleado: '', sueldo: '', septimo_dia: '', prima_dominical: '', gratificacion: '', vacaciones: '',
  isr_mes: '', imss: '', prestamo_infonavit_cf: '', ajuste_neto: '',
  isr_antes_subsidio: '', infonavit_cf_corresp: '', efectivo: '',
});

// Grupos de captura (label + campo). Informativos NO suman al neto.
const PERCEPCIONES: [keyof Fila, string][] = [
  ['sueldo', 'Sueldo'], ['septimo_dia', 'Séptimo día'],
  ['prima_dominical', 'Prima dominical'], ['gratificacion', 'Gratificación'],
  ['vacaciones', 'Vacaciones'],
];
const DEDUCCIONES: [keyof Fila, string][] = [
  ['isr_mes', 'ISR (mes)'], ['imss', 'IMSS'],
  ['infonavit_cf_corresp', 'Infonavit CF corresp.'], ['ajuste_neto', 'Ajuste al neto'],
];
const INFORMATIVOS: [keyof Fila, string][] = [
  ['isr_antes_subsidio', 'ISR antes de subsidio'], ['prestamo_infonavit_cf', 'Préstamo Infonavit CF (saldo)'],
];

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
  const [borradorId, setBorradorId] = useState<string | null>(null); // name del borrador que se está editando

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
    () => nominaDe
      ? empleados.filter(e => e.custom_nomina_de === nominaDe)
          .sort((a, b) => (a.date_of_joining || '').localeCompare(b.date_of_joining || ''))
      : [],
    [empleados, nominaDe],
  );

  const setFila = (i: number, campo: keyof Fila, val: string) =>
    setFilas(fs => fs.map((f, j) => j === i ? { ...f, [campo]: val } : f));
  const addFila = () => setFilas(fs => [...fs, filaVacia()]);
  const delFila = (i: number) => setFilas(fs => fs.filter((_, j) => j !== i));

  // Renglón guardado → Fila de captura (0/null → '' pa no ensuciar inputs; negativos se conservan).
  const filaDesde = (r: RenglonInput): Fila => {
    const s = (v: number | string | undefined) => (v ? String(v) : '');
    return {
      empleado: r.empleado || '',
      sueldo: s(r.sueldo), septimo_dia: s(r.septimo_dia),
      prima_dominical: s(r.prima_dominical), gratificacion: s(r.gratificacion),
      vacaciones: s(r.vacaciones),
      isr_mes: s(r.isr_mes), imss: s(r.imss),
      prestamo_infonavit_cf: s(r.prestamo_infonavit_cf), ajuste_neto: s(r.ajuste_neto),
      isr_antes_subsidio: s(r.isr_antes_subsidio), infonavit_cf_corresp: s(r.infonavit_cf_corresp),
      efectivo: s(r.efectivo),
    };
  };

  // Precarga la semana anterior de cada fila que tenga empleado (1 fila → solo ese; +Todos → todos).
  // Conta solo ajusta lo que cambió. Filas sin historial confirmado se dejan como están.
  const cargarAnterior = async () => {
    const conEmp = filas.map((f, i) => ({ f, i })).filter(x => x.f.empleado);
    if (!conEmp.length) { flash('error', 'Elige o agrega al menos un empleado'); return; }
    try {
      const prev = await Promise.all(conEmp.map(x => nominaService.getUltimoRenglon(x.f.empleado)));
      const byIdx = new Map(conEmp.map((x, k) => [x.i, prev[k]]));
      let hallados = 0;
      setFilas(fs => fs.map((f, i) => {
        const r = byIdx.get(i);
        if (!r) return f;               // sin historial → deja la fila intacta
        hallados++;
        return { ...filaDesde(r), empleado: f.empleado };
      }));
      flash(hallados ? 'ok' : 'error',
        hallados ? `Cargados ${hallados} de ${conEmp.length} (semana anterior) — ajusta lo que cambió`
                 : 'Ninguno tiene corrida confirmada previa');
    } catch (e) { flash('error', (e as Error).message); }
  };

  // Un renglón vacío por cada empleado de la nómina (primer uso, sin corrida previa).
  const agregarTodos = () => {
    if (!nominaDe) { flash('error', 'Elige la nómina primero'); return; }
    setFilas(empleadosNomina.map(e => ({ ...filaVacia(), empleado: e.name })));
  };

  // Carga un borrador al formulario para seguir editándolo (guardar lo actualiza, no crea otro).
  const editarBorrador = async (c: Corrida) => {
    try {
      const det = await nominaService.getCorrida(c.name);
      setNominaDe(det.nomina_de || '');
      setFechaPago(det.fecha_pago || proximoMiercoles());
      setSemanaDel(det.semana_del || '');
      setSemanaAl(det.semana_al || '');
      setFilas((det.renglones || []).length ? det.renglones.map(filaDesde) : [filaVacia()]);
      setBorradorId(c.name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      flash('ok', `Editando borrador ${c.name}`);
    } catch (e) { flash('error', (e as Error).message); }
  };
  // Limpia el form y sale del modo edición de borrador.
  const nuevaCorrida = () => {
    setBorradorId(null); setFilas([filaVacia()]);
    setNominaDe(''); setSemanaDel(''); setSemanaAl(''); setFechaPago(proximoMiercoles());
  };

  const calc = (f: Fila) => {
    const n = (v: string) => Number(v || 0);
    const bruto = n(f.sueldo) + n(f.septimo_dia) + n(f.prima_dominical) + n(f.gratificacion) + n(f.vacaciones);
    const deducc = n(f.isr_mes) + n(f.imss) + n(f.infonavit_cf_corresp) + n(f.ajuste_neto);
    const efectivo = n(f.efectivo);
    return { bruto, deducc, neto: bruto - deducc + efectivo, costo: bruto + efectivo };
  };

  // Totales por concepto + los 2 números del cliente.
  const totales = useMemo(() => {
    const n = (v: string) => Number(v || 0);
    const t = {
      sueldo: 0, septimo_dia: 0, prima_dominical: 0, gratificacion: 0, vacaciones: 0, bruto: 0,
      isr_mes: 0, imss: 0, infonavit_cf_corresp: 0, ajuste_neto: 0, deducc: 0,
      efectivo: 0, neto: 0, costo: 0, impuestos: 0,
    };
    for (const f of filas) {
      const c = calc(f);
      t.sueldo += n(f.sueldo); t.septimo_dia += n(f.septimo_dia);
      t.prima_dominical += n(f.prima_dominical); t.gratificacion += n(f.gratificacion);
      t.vacaciones += n(f.vacaciones);
      t.isr_mes += n(f.isr_mes); t.imss += n(f.imss);
      t.infonavit_cf_corresp += n(f.infonavit_cf_corresp); t.ajuste_neto += n(f.ajuste_neto);
      t.bruto += c.bruto; t.deducc += c.deducc; t.efectivo += n(f.efectivo);
      t.neto += c.neto; t.costo += c.costo;
    }
    t.impuestos = t.isr_mes + t.imss + t.ajuste_neto; // + ajuste → cuadra con Total Deducciones del recibo
    return t;
  }, [filas]);

  // Sumatoria dispersa: solo conceptos con valor (0 → no se muestra).
  const conceptoTotales: [string, number][] = [
    ['Sueldo', totales.sueldo], ['Séptimo día', totales.septimo_dia],
    ['Prima dominical', totales.prima_dominical], ['Gratificación', totales.gratificacion],
    ['Vacaciones', totales.vacaciones],
    ['ISR', totales.isr_mes], ['IMSS', totales.imss],
    ['Infonavit CF corresp.', totales.infonavit_cf_corresp], ['Ajuste al neto', totales.ajuste_neto],
    ['Efectivo', totales.efectivo],
  ];

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
        name: borradorId || undefined, // si editaba un borrador, lo actualiza
      });
      flash('ok', `Corrida ${res.name} ${submit ? 'confirmada' : 'guardada en borrador'}`);
      nuevaCorrida();
      cargarCorridas();
    } catch (e) { flash('error', (e as Error).message); }
    finally { setGuardando(false); }
  };

  return (
    <div className="nomina-corrida">
      {borradorId && (
        <div className="nomina-borrador-bar">
          <span>✏️ Editando borrador <b>{borradorId}</b></span>
          <button onClick={nuevaCorrida}>Nueva corrida</button>
        </div>
      )}
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

      {/* Captura por empleado: cada tarjeta bento con percepciones + deducciones + informativos + efectivo. */}
      {filas.map((f, i) => {
        const c = calc(f);
        const grupo = (titulo: string, tono: string, campos: [keyof Fila, string][]) => (
          <div className="nom-grupo">
            <div className={`nom-grupo-tit ${tono}`}>{titulo}</div>
            {campos.map(([campo, label]) => (
              <label key={campo} className="nom-field">
                <span>{label}</span>
                <input type="number" step="0.01" value={f[campo]} onChange={e => setFila(i, campo, e.target.value)} />
              </label>
            ))}
          </div>
        );
        return (
          <div key={i} className="nom-card">
            <div className="nom-card-head">
              <select className="nom-card-emp" value={f.empleado} onChange={e => setFila(i, 'empleado', e.target.value)} disabled={!nominaDe}>
                <option value="">{nominaDe ? '— elegir empleado —' : '— elige nómina primero —'}</option>
                {empleadosNomina.map(emp => (
                  <option key={emp.name} value={emp.name}>{emp.employee_name}{emp.branch ? ` (${emp.branch})` : ''}</option>
                ))}
              </select>
              <button className="nomina-del" onClick={() => delFila(i)} title="Quitar">×</button>
            </div>
            <div className="nom-grupos">
              {grupo('Percepciones', 'perc', PERCEPCIONES)}
              {grupo('Deducciones', 'ded', DEDUCCIONES)}
              {grupo('Informativos (no suman)', 'info', INFORMATIVOS)}
              {grupo('Efectivo', 'efe', [['efectivo', 'Efectivo']])}
            </div>
            <div className="nom-card-tot">
              <span className="nom-stat"><em>Bruto</em><b>{money(c.bruto)}</b></span>
              <span className="nom-stat"><em>Deducciones</em><b>{money(c.deducc)}</b></span>
              <span className="nom-stat neto"><em>Neto</em><b>{money(c.neto)}</b></span>
              <span className="nom-stat"><em>Costo</em><b>{money(c.costo)}</b></span>
            </div>
          </div>
        );
      })}

      {/* Sumatoria: conceptos con valor (chips) + los 2 números del cliente (tiles hero). */}
      <div className="nom-suma">
        <h3>Sumatoria</h3>
        <div className="nom-suma-chips">
          {conceptoTotales.filter(([, v]) => v !== 0).map(([label, v]) => (
            <span key={label} className="nom-chip">{label}<b>{money(v)}</b></span>
          ))}
        </div>
        <div className="nom-suma-hero">
          <div className="nom-hero"><span>Total neto</span><b>{money(totales.neto)}</b></div>
          <div className="nom-hero gasto"><span>💰 Gasto en empleados</span><b>{money(totales.costo)}</b></div>
          <div className="nom-hero imp"><span>🏛️ Total impuestos</span><b>{money(totales.impuestos)}</b></div>
        </div>
      </div>

      <div className="nomina-acciones">
        <button onClick={agregarTodos} disabled={!nominaDe} title="Agrega un renglón por cada empleado de la nómina">+ Todos los empleados</button>
        <button onClick={cargarAnterior} disabled={!nominaDe} title="Precarga la semana anterior de cada empleado en la lista">↻ Cargar nómina anterior</button>
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
              <td>
                {c.docstatus === 0 && (
                  <button className="nomina-editar" title="Seguir editando este borrador"
                    onClick={() => editarBorrador(c)}>Continuar</button>
                )}
                {c.docstatus === 1 && (
                  <button className="nomina-del" title="Cancelar corrida" onClick={() => cancelarCorrida(c)}>×</button>
                )}
              </td>
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
  const FORM_VACIO = { nombre: '', fecha_ingreso: '', fecha_nacimiento: '', genero: 'Male', sucursal: '', nomina_de: '' };
  const [form, setForm] = useState(FORM_VACIO);
  const [nuevaSuc, setNuevaSuc] = useState('');
  const [editando, setEditando] = useState<string | null>(null); // name del empleado en edición, o null = alta
  const [adminPwd, setAdminPwd] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Carga un empleado en el form (modo edición). Editar datos personales exige clave de Administrator.
  const editar = (e: Empleado) => {
    setEditando(e.name);
    setAdminPwd('');
    setForm({
      nombre: e.employee_name || '', fecha_ingreso: e.date_of_joining || '',
      fecha_nacimiento: e.date_of_birth || '', genero: e.gender || 'Male',
      sucursal: e.branch || '', nomina_de: e.custom_nomina_de || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelarEdicion = () => { setEditando(null); setAdminPwd(''); setForm(FORM_VACIO); };

  const guardar = async () => {
    if (!form.nombre.trim()) { flash('error', 'El nombre es obligatorio'); return; }
    try {
      if (editando) {
        if (!adminPwd) { flash('error', 'Escribe la contraseña de Administrator'); return; }
        const res = await nominaService.editarEmpleado(editando, {
          nombre: form.nombre, fecha_ingreso: form.fecha_ingreso || null,
          fecha_nacimiento: form.fecha_nacimiento || null, genero: form.genero,
          sucursal: form.sucursal || '', nomina_de: form.nomina_de, admin_password: adminPwd,
        });
        flash('ok', `Empleado ${res.employee_name} actualizado`);
        cancelarEdicion();
      } else {
        if (!form.nomina_de) { flash('error', 'Elige de quién es la nómina (Alma / Luis)'); return; }
        const res = await nominaService.crearEmpleado({
          nombre: form.nombre, fecha_ingreso: form.fecha_ingreso, fecha_nacimiento: form.fecha_nacimiento,
          genero: form.genero, sucursal: form.sucursal || null, nomina_de: form.nomina_de,
        });
        flash('ok', `Empleado ${res.employee_name} dado de alta`);
        setForm(FORM_VACIO);
      }
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
      <div className={'nomina-form' + (editando ? ' editando' : '')}>
        <h2>{editando ? 'Editar empleado' : 'Alta de empleado'}</h2>
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
        {editando && (
          <label className="nomina-gate">Contraseña de Administrator
            <input type="password" autoComplete="off" placeholder="••••••••"
              value={adminPwd} onChange={e => setAdminPwd(e.target.value)} />
          </label>
        )}
        {editando ? (
          <div className="nomina-form-acc">
            <button onClick={cancelarEdicion}>Cancelar</button>
            <button className="primary" onClick={guardar}>Guardar cambios</button>
          </div>
        ) : (
          <button className="primary" onClick={guardar}>Dar de alta</button>
        )}

        <div className="nomina-suc-nueva">
          <input placeholder="Nueva sucursal" value={nuevaSuc} onChange={e => setNuevaSuc(e.target.value)} />
          <button onClick={crearSucursal}>+ Sucursal</button>
        </div>
      </div>

      <div className="nomina-lista-emp">
        <h2>Empleados ({empleados.length})</h2>
        <table className="nomina-lista">
          <thead><tr><th>Nombre</th><th>Sucursal</th><th>Nómina de</th><th>Ingreso</th><th></th></tr></thead>
          <tbody>
            {[...empleados].sort((a, b) => (a.date_of_joining || '').localeCompare(b.date_of_joining || '')).map(e => (
              <tr key={e.name} className={editando === e.name ? 'fila-editando' : ''}>
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
                <td><button className="nomina-editar" onClick={() => editar(e)}>Editar</button></td>
              </tr>
            ))}
            {!empleados.length && <tr><td colSpan={5} className="vacio">Sin empleados aún</td></tr>}
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