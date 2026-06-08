import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { egresosService } from '../services/frappeEgresos';
import { imprimirEgresoTicket } from '../services/printService';
import { IMPUESTOS_LIST, IMPUESTOS_MAP } from '../config/impuestos';
import '../styles/Egresos.css';

// ── SVG Icons ────────────────────────────────────────────────────
const IconGasto = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
  </svg>
);
const IconCamioneta = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11v12H5Z"/>
    <path d="M12 3h4l3 3v6h-7V3Z"/>
    <circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
    <path d="M17 17H9v-2"/>
  </svg>
);
const IconActivoFijo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconPrestamo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 22V12h18v10M2 12l10-9 10 9"/>
    <path d="M10 22v-5h4v5"/>
  </svg>
);
const IconNomina = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconImpuesto = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
  </svg>
);
const IconRenta = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

// ── Catálogos fijos ───────────────────────────────────────────────
const VEHICULOS   = ['Tornado Van 1', 'Tornado Van 2', 'Tornado Van 3', 'Tornado Van 4', 'Hilux', 'Avanza', 'BRV'];
const SUCURSALES_GAS = ['Paseos del Bosque', 'Puerta Real', 'Pirámides', 'Santuarios', 'Casa'];
const TELEFONOS   = ['Héctor', 'Luis', 'Alma', 'Paseos del Bosque'];
const TIPOS_MANT  = ['Maquinaria', 'Camioneta', 'Infraestructura', 'Cómputo'];
const TIPOS_REFAC = ['Camioneta', 'Maquinaria', 'Otro'];

// ── Categorías ────────────────────────────────────────────────────
const CATEGORIAS = [
  { key: 'Gasto',        label: 'Gastos',      sub: 'Operativos',       icon: <IconGasto />,      color: '#dc2626', bg: '#fee2e2',
    subcategorias: ['Gasolina','Gas','Agua','Internet','Teléfono','Mantenimiento','Uniformes','Papelería','Artículos de limpieza','Refacciones'] },
  { key: 'camioneta_view', label: 'Camioneta', sub: 'Vista filtrada',   icon: <IconCamioneta />,  color: '#0891b2', bg: '#cffafe', esVista: true, subcategorias: [] },
  { key: 'Activo Fijo',  label: 'Activo Fijo', sub: 'Inversiones',      icon: <IconActivoFijo />, color: '#7c3aed', bg: '#ede9fe', subcategorias: ['Pago camioneta'] },
  { key: 'Préstamo',     label: 'Préstamos',   sub: 'Financiamiento',   icon: <IconPrestamo />,   color: '#d97706', bg: '#fef3c7', subcategorias: ['Paneles','Pago Guillermo'] },
  { key: 'Nómina',       label: 'Nómina',      sub: 'Empleados',        icon: <IconNomina />,     color: '#059669', bg: '#d1fae5', subcategorias: ['Empleados'] },
  { key: 'Impuesto',     label: 'Impuestos',   sub: 'IVA · IEPS · ISR', icon: <IconImpuesto />,   color: '#1565c0', bg: '#e3f0ff', subcategorias: ['IVA','IEPS','ISR'] },
  { key: 'Renta',        label: 'Renta',       sub: 'Locales',          icon: <IconRenta />,      color: '#be185d', bg: '#fce7f3', subcategorias: [] },
];

const FACTURA_OPTIONS = [
  { label: 'Sin factura',   facturado_a: 'SIN FACTURA',  con_factura: false },
  { label: 'Alma Rodríguez', facturado_a: 'ALMA RODRIGUEZ', con_factura: true  },
  { label: 'Luis Torres',   facturado_a: 'LUIS TORRES',  con_factura: true  },
];
const IMP_ERPNEXT = { tasa0: '', iva16: 'IVA', ieps: 'IEPS' };
const IVA_RATE = 0.16;

function fmtN(n) { return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }); }
function n(v)    { return parseFloat(v) || 0; }

// ── FORM_INIT ─────────────────────────────────────────────────────
const FORM_INIT = {
  fecha: new Date().toISOString().split('T')[0],
  subcategoria: '', concepto: '', descripcion: '',
  monto: '', impuesto_key: 'tasa0', impuesto_tipo: '', monto_impuesto: '',
  factura_key: 'SIN FACTURA',
  // Gas-specific
  gas_litros: '', gas_precio: '',
  aditivo_litros: '', aditivo_precio: '',
  descuento_gas: '',
};

// ── Formulario Gas con cálculo automático ─────────────────────────
function GasForm({ form, setForm }) {
  const gasSubtotal    = n(form.gas_litros) * n(form.gas_precio);
  const aditivoSubtotal = n(form.aditivo_litros) * n(form.aditivo_precio);
  const subtotal       = gasSubtotal + aditivoSubtotal;
  const descuento      = n(form.descuento_gas);
  const baseGravable   = subtotal - descuento;
  const iva            = baseGravable * IVA_RATE;
  const total          = baseGravable + iva;

  // Sync calculated totals to form for saving
  useEffect(() => {
    setForm(f => ({
      ...f,
      monto: total.toFixed(2),
      monto_impuesto: iva.toFixed(2),
      impuesto_tipo: 'IVA',
    }));
  }, [total, iva]); // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="gas-form">
      <div className="gas-form-grid">
        <label>Sucursal
          <select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
            <option value="">Seleccionar...</option>
            {SUCURSALES_GAS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Fecha
          <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </label>
        <label>Factura
          <select value={form.factura_key || 'SIN FACTURA'} onChange={e => set('factura_key', e.target.value)}>
            {FACTURA_OPTIONS.map(o => (
              <option key={o.label} value={o.facturado_a}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="gas-lineas">
        {/* Línea Gas */}
        <div className="gas-linea-header">Gas</div>
        <div className="gas-linea-grid">
          <label>Litros
            <input type="number" step="0.001" placeholder="0.000" value={form.gas_litros} onChange={e => set('gas_litros', e.target.value)} />
          </label>
          <label>Precio unitario
            <input type="number" step="0.000001" placeholder="0.000000" value={form.gas_precio} onChange={e => set('gas_precio', e.target.value)} />
          </label>
          <label>Subtotal
            <input type="text" readOnly value={fmtN(gasSubtotal)} className="gas-calc-field" />
          </label>
        </div>

        {/* Línea Aditivo */}
        <div className="gas-linea-header">Aditivo</div>
        <div className="gas-linea-grid">
          <label>Litros
            <input type="number" step="0.001" placeholder="0.000" value={form.aditivo_litros} onChange={e => set('aditivo_litros', e.target.value)} />
          </label>
          <label>Precio unitario
            <input type="number" step="0.000001" placeholder="0.000000" value={form.aditivo_precio} onChange={e => set('aditivo_precio', e.target.value)} />
          </label>
          <label>Subtotal
            <input type="text" readOnly value={fmtN(aditivoSubtotal)} className="gas-calc-field" />
          </label>
        </div>

        {/* Totales */}
        <div className="gas-totales">
          <div className="gas-total-row">
            <span>Subtotal</span>
            <span>{fmtN(subtotal)}</span>
          </div>
          <div className="gas-total-row">
            <span>Descuento</span>
            <input type="number" step="0.01" placeholder="0.00" value={form.descuento_gas}
              onChange={e => set('descuento_gas', e.target.value)} className="gas-descuento-input" />
          </div>
          <div className="gas-total-row">
            <span>Base gravable</span>
            <span>{fmtN(baseGravable)}</span>
          </div>
          <div className="gas-total-row">
            <span>IVA (16%)</span>
            <span>{fmtN(iva)}</span>
          </div>
          <div className="gas-total-row gas-total-final">
            <span>Total</span>
            <span>{fmtN(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Formulario genérico por subcategoría ──────────────────────────
function SubcatForm({ subcategoria, form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const montoBase    = n(form.monto);
  const impKey       = form.impuesto_key || 'tasa0';
  const impEntry     = IMPUESTOS_MAP[impKey] || IMPUESTOS_MAP['tasa0'];
  const montoImp     = montoBase * impEntry.rate;
  const total        = montoBase + montoImp;

  // Sync calculated tax fields back to form
  useEffect(() => {
    setForm(f => ({
      ...f,
      monto_impuesto: montoImp > 0 ? montoImp.toFixed(2) : '',
      impuesto_tipo:  impKey === 'tasa0' ? '' : impEntry.label,
    }));
  }, [form.monto, impKey]); // eslint-disable-line

  const conceptoSelect = (opciones, placeholder) => (
    <label>Concepto
      <select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
        <option value="">{placeholder}</option>
        {opciones.map(o => <option key={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="egresos-form-grid">
      <label>Fecha
        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
      </label>

      {subcategoria === 'Gasolina'     && conceptoSelect(VEHICULOS,   'Seleccionar vehículo...')}
      {subcategoria === 'Teléfono'     && conceptoSelect(TELEFONOS,   'Seleccionar persona...')}
      {subcategoria === 'Mantenimiento'&& conceptoSelect(TIPOS_MANT,  'Seleccionar tipo...')}
      {subcategoria === 'Refacciones'  && conceptoSelect(TIPOS_REFAC, 'Seleccionar tipo...')}
      {!['Gasolina','Teléfono','Mantenimiento','Refacciones'].includes(subcategoria) && (
        <label>Concepto
          <input type="text" placeholder="Descripción breve" value={form.concepto} onChange={e => set('concepto', e.target.value)} />
        </label>
      )}

      <label>Monto base
        <input type="number" min="0" step="0.01" placeholder="0.00" value={form.monto} onChange={e => set('monto', e.target.value)} />
      </label>

      <label>Impuesto
        <select value={impKey} onChange={e => set('impuesto_key', e.target.value)}>
          {IMPUESTOS_LIST.map(imp => (
            <option key={imp.key} value={imp.key}>{imp.label}</option>
          ))}
        </select>
      </label>

      {montoImp > 0 && (
        <label>Monto impuesto
          <input type="text" readOnly value={fmtN(montoImp)} className="gas-calc-field" />
        </label>
      )}

      {montoBase > 0 && (
        <label>Total
          <input type="text" readOnly value={fmtN(total)} className="gas-calc-field" style={{ fontWeight: 700, color: '#dc2626' }} />
        </label>
      )}

      <label>Factura
        <select value={form.factura_key || 'SIN FACTURA'} onChange={e => set('factura_key', e.target.value)}>
          {FACTURA_OPTIONS.map(o => (
            <option key={o.label} value={o.facturado_a}>{o.label}</option>
          ))}
        </select>
      </label>

      <label className="egresos-form-full">Descripción / Justificación
        <textarea rows={2} placeholder="Nota adicional (opcional)" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
      </label>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────
export default function Egresos() {
  const [categoriaKey, setCategoriaKey] = useState(null);
  const [egresos, setEgresos]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(FORM_INIT);
  const [guardando, setGuardando]       = useState(false);
  const [confirmDel, setConfirmDel]     = useState(null);

  const cat = CATEGORIAS.find(c => c.key === categoriaKey);

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

  useEffect(() => { if (categoriaKey) cargar(categoriaKey); }, [categoriaKey, cargar]);

  const initForm = (subcat) => {
    setForm({ ...FORM_INIT, subcategoria: subcat || cat?.subcategorias?.[0] || '' });
    setShowForm(true);
  };

  const buildPayload = () => {
    const facturaOpt = FACTURA_OPTIONS.find(o => o.facturado_a === (form.factura_key || 'SIN FACTURA'))
                    || FACTURA_OPTIONS[0];
    const up = s => (s || '').toUpperCase();

    if (form.subcategoria === 'Gas') {
      const gasSubtotal     = n(form.gas_litros) * n(form.gas_precio);
      const aditivoSubtotal = n(form.aditivo_litros) * n(form.aditivo_precio);
      const subtotal        = gasSubtotal + aditivoSubtotal;
      const descuento       = n(form.descuento_gas);
      const baseGravable    = subtotal - descuento;
      const iva             = baseGravable * IVA_RATE;
      const total           = baseGravable + iva;
      return {
        fecha: form.fecha, categoria: 'GASTO', subcategoria: 'GAS',
        concepto: up(form.concepto),
        descripcion: JSON.stringify({ gas_litros: form.gas_litros, gas_precio: form.gas_precio, gas_subtotal: gasSubtotal,
          aditivo_litros: form.aditivo_litros, aditivo_precio: form.aditivo_precio, aditivo_subtotal: aditivoSubtotal,
          subtotal, descuento, base_gravable: baseGravable, iva, total }),
        monto: total.toFixed(2), impuesto_tipo: 'IVA', monto_impuesto: iva.toFixed(2),
        facturado_a: facturaOpt.facturado_a,
        con_factura: facturaOpt.con_factura ? 1 : 0,
      };
    }
    const impKey   = form.impuesto_key || 'tasa0';
    const impEntry = IMPUESTOS_MAP[impKey] || IMPUESTOS_MAP['tasa0'];
    const base     = n(form.monto);
    const impMonto = base * impEntry.rate;
    const total    = base + impMonto;
    const catKey   = categoriaKey === 'camioneta_view' ? 'GASTO' : up(categoriaKey);
    return {
      fecha: form.fecha,
      categoria: catKey,
      subcategoria: up(form.subcategoria),
      concepto: up(form.concepto),
      descripcion: up(form.descripcion),
      monto: total.toFixed(2),
      impuesto_tipo: IMP_ERPNEXT[impKey] || '',
      monto_impuesto: impMonto > 0 ? impMonto.toFixed(2) : 0,
      facturado_a: facturaOpt.facturado_a,
      con_factura: facturaOpt.con_factura ? 1 : 0,
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
      await egresosService.crearEgreso(payload);
      setShowForm(false); setForm(FORM_INIT);
      cargar(categoriaKey);
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

  // ── Tiles ─────────────────────────────────────────────────────
  if (!categoriaKey) {
    const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <Layout>
        <div className="egresos-page">
          <div className="panel-greeting"><h2>Egresos</h2><p>{fecha}</p></div>
          <div className="panel-grid">
            {CATEGORIAS.map(c => (
              <button key={c.key} className="panel-module"
                style={{ '--mod-color': c.color, '--mod-bg': c.bg }}
                onClick={() => setCategoriaKey(c.key)}>
                <div className="panel-module-icon">{c.icon}</div>
                <span className="panel-module-name">{c.label}</span>
                <span className="panel-module-sub">{c.sub}</span>
                {c.esVista && <span className="egreso-vista-badge">vista</span>}
              </button>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // ── Lista + form ──────────────────────────────────────────────
  const subcats = cat?.subcategorias || [];

  return (
    <Layout>
      <div className="egresos-page">
        <div className="egresos-list-header">
          <button className="egresos-back" onClick={() => { setCategoriaKey(null); setShowForm(false); setError(''); }}>← Egresos</button>
          <div className="egresos-list-title" style={{ '--mod-color': cat?.color }}>{cat?.label}
            {cat?.esVista && <span className="egreso-vista-badge">vista</span>}
          </div>
          {!cat?.esVista && (
            <button className="egresos-nuevo" onClick={() => initForm()}>+ Nuevo egreso</button>
          )}
        </div>

        {error && (
          <div className="egresos-error-bar">
            <span>⚠ {error}</span>
            <button onClick={() => { setError(''); cargar(categoriaKey); }}>Reintentar</button>
          </div>
        )}

        {showForm && (
          <div className="egresos-form-card">
            <div className="egresos-form-topbar">
              <h3>Nuevo egreso — {cat?.label}</h3>
              {subcats.length > 1 && (
                <div className="egresos-subcat-tabs">
                  {subcats.map(s => (
                    <button key={s}
                      className={'egresos-subcat-tab' + (form.subcategoria === s ? ' active' : '')}
                      style={{ '--mod-color': cat?.color }}
                      onClick={() => setForm(f => ({ ...FORM_INIT, subcategoria: s, fecha: f.fecha, factura_key: f.factura_key }))}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {form.subcategoria === 'Gas'
              ? <GasForm form={form} setForm={setForm} />
              : <SubcatForm subcategoria={form.subcategoria} form={form} setForm={setForm} />
            }

            <div className="egresos-form-actions">
              <button className="egresos-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="egresos-guardar" style={{ '--mod-color': cat?.color }} onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar egreso'}
              </button>
            </div>
          </div>
        )}

        {/* Tabla */}
        {loading
          ? <div className="egresos-loading"><span className="egresos-spinner" />Cargando...</div>
          : egresos.length === 0
            ? <p className="egresos-empty">Sin egresos registrados.</p>
            : (
          <div className="egresos-tabla-wrap">
            <table className="egresos-tabla">
              <thead>
                <tr>
                  <th>Fecha</th><th>Subcategoría</th><th>Concepto</th>
                  <th>Monto</th><th>Impuesto</th><th>Factura</th><th></th>
                </tr>
              </thead>
              <tbody>
                {egresos.map(e => (
                  <tr key={e.name}>
                    <td>{e.fecha}</td>
                    <td>{e.subcategoria || '—'}</td>
                    <td>{e.concepto || <span className="text-muted">{e.descripcion ? '(ver detalle)' : '—'}</span>}</td>
                    <td className="egresos-monto">{fmtN(e.monto)}</td>
                    <td className="text-muted">{e.impuesto_tipo ? `${e.impuesto_tipo} ${fmtN(e.monto_impuesto)}` : '—'}</td>
                    <td>
                      {e.facturado_a
                        ? <span className="egresos-factura-badge">{e.facturado_a}</span>
                        : <span className="egresos-sinfactura-badge">Sin factura</span>}
                    </td>
                    <td>
                      <button className="egresos-print" title="Imprimir ticket"
                        style={{ marginRight: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}
                        onClick={() => handleImprimir(e)}>🖨</button>
                      {confirmDel === e.name
                        ? <span className="egresos-confirm-del">
                            ¿Seguro?{' '}
                            <button className="egresos-del-si" onClick={() => handleEliminar(e.name)}>Sí</button>
                            <button className="egresos-del-no" onClick={() => setConfirmDel(null)}>No</button>
                          </span>
                        : <button className="egresos-del" onClick={() => setConfirmDel(e.name)}>✕</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
