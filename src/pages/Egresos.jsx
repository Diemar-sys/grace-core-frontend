import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../services/frappeAuth';
import { getRoleConfig } from '../config/roles';
import Layout from '../components/Layout';
import { egresosService } from '../services/frappeEgresos';
import { imprimirEgresoTicket } from '../services/printService';
import { IMPUESTOS_MAP } from '../config/impuestos';
import { calcGasolina } from '../components/compras/compraUtils';
import BuscadorProveedor from '../components/compras/BuscadorProveedor';
import { autoAgua, calcTotalesPartidas } from '../utils/egresosUtils';
export { autoAgua, calcTotalesPartidas };

import { CATEGORIAS, FACTURA_OPTIONS, FORM_INIT, IMP_ERPNEXT, IVA_RATE, impuestoDefault, n } from '../components/egresos/egresosConstants';
import { GasolinaForm } from '../components/egresos/GasolinaForm';
import { GasForm } from '../components/egresos/GasForm';
import { SubcatForm } from '../components/egresos/SubcatForm';
import { EgresosTabla } from '../components/egresos/EgresosTabla';

import '../styles/NuevaCompra.css';
import '../styles/Panel.css';
import '../styles/Compras.css';
import '../styles/Egresos.css';

// ── Página principal ──────────────────────────────────────────────
export default function Egresos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Operaciones captura, Consultas ve: la misma regla que el resto de los módulos.
  const modoConsulta = searchParams.get('modo') === 'consulta';
  const puedeNomina = getRoleConfig(auth.getUser()?.role).rutas.includes('/nomina');
  const [categoriaKey, setCategoriaKey] = useState(null);
  const [egresos, setEgresos]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(FORM_INIT);
  const [guardando, setGuardando]       = useState(false);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [busqueda, setBusqueda]         = useState('');
  const [okMsg, setOkMsg]               = useState('');
  const [subcatFiltro, setSubcatFiltro]       = useState('todas');
  const [facturadoFiltro, setFacturadoFiltro] = useState('todas');
  const [desde, setDesde]                     = useState('');
  const [hasta, setHasta]                     = useState('');

  const cat = CATEGORIAS.find(c => c.key === categoriaKey);

  const egresosFiltrados = (() => {
    const t = busqueda.toLowerCase().trim();
    const tn = t.replace(/^#/, '');
    let base = !t ? egresos : egresos.filter(e =>
      (e.no_factura || '').toLowerCase().includes(t) ||
      (e.proveedor || '').toLowerCase().includes(t) ||
      (e.concepto || '').toLowerCase().includes(t) ||
      (e.subcategoria || '').toLowerCase().includes(t) ||
      String(e.no_de_compra ?? '').includes(tn)
    );
    if (subcatFiltro !== 'todas')    base = base.filter(e => e.subcategoria === subcatFiltro);
    if (facturadoFiltro !== 'todas') base = base.filter(e => (e.facturado_a || 'SIN FACTURA') === facturadoFiltro);
    if (desde) base = base.filter(e => (e.fecha || '') >= desde);
    if (hasta) base = base.filter(e => (e.fecha || '') <= hasta);
    // Ordena por No. de compra desc (los sin consecutivo van al final por fecha desc).
    return [...base].sort((a, b) =>
      (b.no_de_compra || 0) - (a.no_de_compra || 0) ||
      (b.fecha || '').localeCompare(a.fecha || '')
    );
  })();

  const cargar = useCallback(async (key) => {
    setLoading(true); setError('');
    try {
      if (key === 'camioneta_view') {
        const todos = await egresosService.getEgresos({ categoria: 'GASTO' });
        setEgresos(todos.filter(e =>
          e.subcategoria === 'GASOLINA' ||
          e.subcategoria === 'REFACCIONES' ||
          (e.subcategoria === 'MANTENIMIENTO' && e.concepto?.toLowerCase().includes('camioneta'))
        ));
      } else {
        setEgresos(await egresosService.getEgresos({ categoria: key.toUpperCase() }));
      }
    } catch { setError('Error al cargar egresos'); }
    finally  { setLoading(false); }
  }, []);

  // En Operaciones no hay lista que llenar: se entra directo a capturar.
  useEffect(() => { if (categoriaKey && modoConsulta) cargar(categoriaKey); }, [categoriaKey, modoConsulta, cargar]);

  // catObj explícito: al abrir el form desde el tile, `cat` todavía es el anterior.
  const initForm = (subcat, catObj = cat) => {
    const sc = subcat || catObj?.subcategorias?.[0] || '';
    setForm({ ...FORM_INIT, subcategoria: sc, impuesto_key: impuestoDefault(sc) });
    setOkMsg('');
    setShowForm(true);
  };

  const buildPayload = () => {
    const facturaOpt = FACTURA_OPTIONS.find(o => o.facturado_a === (form.factura_key || 'SIN FACTURA'))
                    || FACTURA_OPTIONS[0];
    const up = s => (s || '').toUpperCase();
    const prov = form.proveedor?.name || '';  // pagado se marca en la lista, no al crear

    if (form.subcategoria === 'Gasolina') {
      const g = calcGasolina({
        litros: form.gasolina_litros, precio: form.gasolina_precio,
        iva: form.gasolina_iva, total: form.gasolina_total,
      });
      return {
        fecha: form.fecha, proveedor: prov, categoria: 'GASTO', subcategoria: 'GASOLINA',
        concepto: up(form.concepto),
        descripcion: JSON.stringify({
          gasolina_litros: form.gasolina_litros, gasolina_precio: form.gasolina_precio,
          gasolina_base: g.base, ieps_importe: g.ieps,
          base_gravable: g.baseGravable, iva: g.iva, total: g.total,
        }),
        monto: g.total.toFixed(2), impuesto_tipo: g.iva > 0 ? 'IVA' : '', monto_impuesto: g.iva.toFixed(2),
        facturado_a: facturaOpt.facturado_a,
        con_factura: facturaOpt.con_factura ? 1 : 0,
        no_factura: facturaOpt.con_factura ? (form.no_factura || '').trim() : '',
      };
    }

    if (form.subcategoria === 'Gas') {
      const gasSubtotal     = n(form.gas_litros) * n(form.gas_precio);
      const aditivoSubtotal = n(form.aditivo_litros) * n(form.aditivo_precio);
      const subtotal        = gasSubtotal + aditivoSubtotal;
      const descuento       = n(form.descuento_gas);
      const baseGravable    = subtotal - descuento;
      const iva             = baseGravable * IVA_RATE;
      const total           = baseGravable + iva;
      return {
        fecha: form.fecha, proveedor: prov, categoria: 'GASTO', subcategoria: 'GAS',
        concepto: up(form.concepto),
        descripcion: JSON.stringify({ gas_litros: form.gas_litros, gas_precio: form.gas_precio, gas_subtotal: gasSubtotal,
          aditivo_litros: form.aditivo_litros, aditivo_precio: form.aditivo_precio, aditivo_subtotal: aditivoSubtotal,
          subtotal, descuento, base_gravable: baseGravable, iva, total }),
        monto: total.toFixed(2), impuesto_tipo: 'IVA', monto_impuesto: iva.toFixed(2),
        facturado_a: facturaOpt.facturado_a,
        con_factura: facturaOpt.con_factura ? 1 : 0,
        no_factura: facturaOpt.con_factura ? (form.no_factura || '').trim() : '',
      };
    }
    const catKey   = categoriaKey === 'camioneta_view' ? 'GASTO' : up(categoriaKey);
    const rawPart  = (form.partidas || []).filter(p => (p.concepto || '').trim() || n(p.precio));

    if (rawPart.length) {
      const { ef } = calcTotalesPartidas(rawPart, form.ajuste, form.ajuste_manual);
      const partidas = rawPart.map(p => ({
        concepto: up(p.concepto), cantidad: n(p.cantidad), precio: n(p.precio),
        impuesto: (IMPUESTOS_MAP[p.impuesto_key || 'tasa0'] || {}).label || 'Tasa 0',
      }));
      const tipo = ef.iva > 0 ? 'IVA' : ef.ieps > 0 ? 'IEPS' : '';
      return {
        fecha: form.fecha, proveedor: prov, categoria: catKey,
        subcategoria: up(form.subcategoria), concepto: up(form.concepto),
        descripcion: up(form.descripcion), partidas,
        monto: ef.total.toFixed(2),
        impuesto_tipo: tipo,
        monto_impuesto: (ef.iva + ef.ieps).toFixed(2),
        facturado_a: facturaOpt.facturado_a,
        con_factura: facturaOpt.con_factura ? 1 : 0,
        no_factura: facturaOpt.con_factura ? (form.no_factura || '').trim() : '',
      };
    }

    const impKey   = form.impuesto_key || 'tasa0';
    const impEntry = IMPUESTOS_MAP[impKey] || IMPUESTOS_MAP['tasa0'];
    const base     = n(form.monto);
    const impMonto = base * impEntry.rate;
    const total    = base + impMonto;
    return {
      fecha: form.fecha,
      proveedor: prov,
      categoria: catKey,
      subcategoria: up(form.subcategoria),
      concepto: up(form.concepto),
      descripcion: up(form.descripcion),
      partidas: [],
      monto: total.toFixed(2),
      impuesto_tipo: IMP_ERPNEXT[impKey] || '',
      monto_impuesto: impMonto > 0 ? impMonto.toFixed(2) : 0,
      facturado_a: facturaOpt.facturado_a,
      con_factura: facturaOpt.con_factura ? 1 : 0,
      no_factura: facturaOpt.con_factura ? (form.no_factura || '').trim() : '',
    };
  };

  const handleGuardar = async () => {
    const payload = buildPayload();
    if (!payload.monto || parseFloat(payload.monto) <= 0) {
      setError('Ingresa un monto válido'); return;
    }
    setError('');
    setGuardando(true);
    try {
      const creado = await egresosService.crearEgreso(payload);
      if (modoConsulta) {
        setShowForm(false); setForm(FORM_INIT);
        cargar(categoriaKey);
      } else {
        initForm(form.subcategoria);
        setOkMsg(`Egreso ${creado?.no_de_compra ? `#${creado.no_de_compra} ` : ''}guardado`);
      }
      imprimirEgresoTicket({ ...payload, name: creado?.name, no_de_compra: creado?.no_de_compra })
        .catch(err => console.error('Auto-print egreso:', err));
    } catch(e) { setError(e?.message || 'Error al guardar'); }
    finally  { setGuardando(false); }
  };

  const handleEliminar = async (name) => {
    try { await egresosService.eliminarEgreso(name); setConfirmDel(null); cargar(categoriaKey); }
    catch { setError('Error al eliminar'); setConfirmDel(null); }
  };

  const handleImprimir = async (egreso) => {
    try { await imprimirEgresoTicket(egreso); }
    catch (err) { setError(err?.message || 'Error al imprimir'); }
  };

  const handlePagado = async (e) => {
    const nuevo = e.pagado ? 0 : 1;
    setEgresos(prev => prev.map(x => x.name === e.name ? { ...x, pagado: nuevo } : x));
    try { await egresosService.marcarPagado(e.name, nuevo); }
    catch { setError('Error al marcar pagado'); cargar(categoriaKey); }
  };

  const subcats = cat?.subcategorias || [];
  const cerrarForm = () => { setShowForm(false); setOkMsg(''); if (!modoConsulta) setCategoriaKey(null); };

  const formModal = (
    <div className="egresos-modal" onMouseDown={e => { if (e.target === e.currentTarget) cerrarForm(); }}>
      <div className="egresos-modal-card">
        <div className="egresos-modal-header">
          <h3>Nuevo egreso — {cat?.label}</h3>
          <button className="egresos-modal-close" onClick={cerrarForm} title="Cerrar">✕</button>
        </div>

        <div className="egresos-modal-body">
          {okMsg && <div className="egresos-ok-bar">✓ {okMsg} — captura el siguiente o cierra</div>}
          {error && <div className="egresos-error-bar"><span>⚠ {error}</span></div>}
          {(() => {
            const subcatField = subcats.length > 1 ? (
              <label className="egresos-subcat-field">Subcategoría
                <select value={form.subcategoria}
                  onChange={e => setForm(f => ({ ...FORM_INIT, subcategoria: e.target.value, impuesto_key: impuestoDefault(e.target.value), fecha: f.fecha, factura_key: f.factura_key, proveedor: f.proveedor }))}>
                  {subcats.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            ) : null;
            const proveedorField = (
              <label className="egresos-prov-field">Proveedor
                <BuscadorProveedor value={form.proveedor}
                  onChange={v => setForm(f => {
                    const auto = categoriaKey === 'Gasto' ? autoAgua(v.label) : null;
                    return { ...f, proveedor: v, ...(auto || {}) };
                  })} />
              </label>
            );
            if (form.subcategoria === 'Gas')
              return <GasForm form={form} setForm={setForm} subcatField={subcatField} proveedorField={proveedorField} />;
            if (form.subcategoria === 'Gasolina')
              return <GasolinaForm form={form} setForm={setForm} subcatField={subcatField} proveedorField={proveedorField} />;
            return <SubcatForm subcategoria={form.subcategoria} form={form} setForm={setForm} subcatField={subcatField} proveedorField={proveedorField} />;
          })()}
        </div>

        <div className="egresos-form-actions">
          <button className="egresos-cancel" onClick={cerrarForm}>Cerrar</button>
          <button className="egresos-guardar" onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar egreso'}
          </button>
        </div>
      </div>
    </div>
  );

  const categoriasVisibles = CATEGORIAS.filter(c =>
    (c.key !== 'Nómina' || puedeNomina) && (modoConsulta || !c.esVista));

  const abrirCategoria = (c) => {
    if (c.key === 'Nómina' && !modoConsulta) { navigate('/nomina'); return; }
    setCategoriaKey(c.key);
    setSubcatFiltro('todas'); setFacturadoFiltro('todas'); setBusqueda('');
    if (!modoConsulta) initForm(null, c);
  };

  if (!categoriaKey || !modoConsulta) {
    const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <Layout>
        <div className="egresos-page">
          <div className="panel-greeting">
            <h2>Egresos</h2>
            <p>{modoConsulta ? fecha : 'Elige qué vas a registrar'}</p>
          </div>
          <div className="panel-grid">
            {categoriasVisibles.map(c => (
              <button key={c.key} className="panel-module"
                style={{ '--mod-color': c.color, '--mod-bg': c.bg }}
                onClick={() => abrirCategoria(c)}>
                <div className="panel-module-icon">{c.icon}</div>
                <span className="panel-module-name">{c.label}</span>
                <span className="panel-module-sub">{c.sub}</span>
                {c.esVista && <span className="egreso-vista-badge">vista</span>}
              </button>
            ))}
          </div>
        </div>
        {showForm && formModal}
      </Layout>
    );
  }

  const subcatsPresentes = [...new Set(egresos.map(e => e.subcategoria).filter(Boolean))].sort();

  return (
    <Layout>
      <EgresosTabla
        cat={cat}
        categoriaKey={categoriaKey}
        egresos={egresos}
        egresosFiltrados={egresosFiltrados}
        subcatsPresentes={subcatsPresentes}
        subcatFiltro={subcatFiltro}
        setSubcatFiltro={setSubcatFiltro}
        facturadoFiltro={facturadoFiltro}
        setFacturadoFiltro={setFacturadoFiltro}
        desde={desde}
        setDesde={setDesde}
        hasta={hasta}
        setHasta={setHasta}
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        loading={loading}
        error={error}
        setError={setError}
        confirmDel={confirmDel}
        setConfirmDel={setConfirmDel}
        onVolver={() => { setCategoriaKey(null); setError(''); }}
        onCargar={cargar}
        onPagado={handlePagado}
        onImprimir={handleImprimir}
        onEliminar={handleEliminar}
      />
      {showForm && formModal}
    </Layout>
  );
}
