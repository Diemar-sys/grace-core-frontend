import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { egresosService } from '../services/frappeEgresos';
import { imprimirEgresoTicket } from '../services/printService';
import { IMPUESTOS_LIST, IMPUESTOS_MAP } from '../config/impuestos';
import { calcularTotalesEfectivos } from '../components/compras/compraUtils';
import BuscadorProveedor from '../components/compras/BuscadorProveedor';
import '../styles/NuevaCompra.css';
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
const TIPOS_AGUA  = ['Agua para consumo humano', 'Pipa de agua', 'Agua de uso diario - CEA'];

// Proveedor (supplier_name) → autocompleta Agua. Match por substring, sin acentos/caso.
const AUTO_AGUA = [
  { match: 'bonafont',          concepto: 'Agua para consumo humano' },
  { match: 'pipa de agua',      concepto: 'Pipa de agua' },
];
export function autoAgua(label) {
  const t = (label || '').toLowerCase();
  const hit = AUTO_AGUA.find(a => t.includes(a.match));
  return hit ? { subcategoria: 'Agua', concepto: hit.concepto } : null;
}

// Subcategorías que por defecto llevan IVA 16% (servicios facturables).
const SUBCAT_IVA = ['Control de plagas'];
const impuestoDefault = (subcat) => SUBCAT_IVA.includes(subcat) ? 'iva16' : 'tasa0';

// ── Categorías ────────────────────────────────────────────────────
const CATEGORIAS = [
  { key: 'Gasto',        label: 'Gastos',      sub: 'Operativos',       icon: <IconGasto />,      color: '#dc2626', bg: '#fee2e2',
    subcategorias: ['Gasolina','Gas','Agua','Internet','Teléfono','Mantenimiento','Uniformes','Papelería','Artículos de limpieza','Refacciones','Control de plagas'] },
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

// Agrupa bases por tasa (estilo Compras) y deriva total + ajuste SAT vía la
// misma función pura que usa Compras. ajusteManual sobrescribe el redondeo auto.
export function calcTotalesPartidas(partidas, ajuste, ajusteManual) {
  const calc = (partidas || []).reduce((a, p) => {
    const base = n(p.cantidad) * n(p.precio);
    const key  = p.impuesto_key || 'tasa0';
    const rate = IMPUESTOS_MAP[key]?.rate || 0;
    a.subtotal += base;
    if (key === 'iva16')     { a.iva  += base * rate; a.subtotalIva16 += base; }
    else if (key === 'ieps') { a.ieps += base * rate; a.subtotalIeps  += base; }
    else                       a.subtotalTasa0 += base;
    return a;
  }, { subtotal: 0, iva: 0, ieps: 0, subtotalIva16: 0, subtotalIeps: 0, subtotalTasa0: 0 });
  const ef = calcularTotalesEfectivos({ calc, manual: { ajuste: !!ajusteManual }, ajuste: ajuste || 0 });
  return { calc, ef };
}

// ── FORM_INIT ─────────────────────────────────────────────────────
const FORM_INIT = {
  fecha: new Date().toISOString().split('T')[0],
  proveedor: { name: '', label: '' },
  subcategoria: '', concepto: '', descripcion: '',
  partidas: [],
  ajuste: '', ajuste_manual: false,
  monto: '', impuesto_key: 'tasa0', impuesto_tipo: '', monto_impuesto: '',
  factura_key: 'SIN FACTURA', no_factura: '',
  // Gas-specific
  gas_litros: '', gas_precio: '',
  aditivo_litros: '', aditivo_precio: '',
  descuento_gas: '',
};

// ── Formulario Gas con cálculo automático ─────────────────────────
function GasForm({ form, setForm, subcatField, proveedorField }) {
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
        {proveedorField}
        {subcatField}
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
        {form.factura_key && form.factura_key !== 'SIN FACTURA' && (
          <label>No. Factura
            <input type="text" placeholder="Folio CFDI" value={form.no_factura} onChange={e => set('no_factura', e.target.value)} />
          </label>
        )}
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
function SubcatForm({ subcategoria, form, setForm, subcatField, proveedorField }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Partidas (desglose opcional) ──
  const partidas    = form.partidas || [];
  const usaPartidas = partidas.length > 0;
  const sumPartidas = partidas.reduce((s, p) => s + n(p.cantidad) * n(p.precio), 0);
  const setPartida  = (i, k, v) => setForm(f => {
    const arr = [...(f.partidas || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...f, partidas: arr };
  });
  const addPartida = () => setForm(f => ({ ...f, partidas: [...(f.partidas || []), { concepto: '', cantidad: 1, precio: '', impuesto_key: 'tasa0' }] }));
  const delPartida = i => setForm(f => ({ ...f, partidas: (f.partidas || []).filter((_, j) => j !== i) }));

  // Con partidas: desglose por tasa estilo Compras + ajuste global (cuadrar CFDI).
  const { calc, ef } = calcTotalesPartidas(partidas, form.ajuste, form.ajuste_manual);
  const ajusteShown  = form.ajuste_manual ? form.ajuste : (ef.ajusteSAT ? ef.ajusteSAT.toFixed(2) : '0.00');

  // Ruta simple (sin partidas): un solo impuesto sobre el monto.
  const impKey   = form.impuesto_key || 'tasa0';
  const impEntry = IMPUESTOS_MAP[impKey] || IMPUESTOS_MAP['tasa0'];
  const montoImp = n(form.monto) * impEntry.rate;
  const total    = n(form.monto) + montoImp;

  // Sync impuesto calculado SOLO en ruta simple (con partidas lo arma buildPayload).
  useEffect(() => {
    if (usaPartidas) return;
    setForm(f => ({
      ...f,
      monto_impuesto: montoImp > 0 ? montoImp.toFixed(2) : '',
      impuesto_tipo:  impKey === 'tasa0' ? '' : impEntry.label,
    }));
  }, [form.monto, usaPartidas, impKey]); // eslint-disable-line

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
      {proveedorField}
      {subcatField}
      <label>Fecha
        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
      </label>

      {subcategoria === 'Gasolina'     && conceptoSelect(VEHICULOS,   'Seleccionar vehículo...')}
      {subcategoria === 'Teléfono'     && conceptoSelect(TELEFONOS,   'Seleccionar persona...')}
      {subcategoria === 'Mantenimiento'&& conceptoSelect(TIPOS_MANT,  'Seleccionar tipo...')}
      {subcategoria === 'Refacciones'  && conceptoSelect(TIPOS_REFAC, 'Seleccionar tipo...')}
      {subcategoria === 'Agua'         && conceptoSelect(TIPOS_AGUA,  'Seleccionar tipo...')}
      {!['Gasolina','Teléfono','Mantenimiento','Refacciones','Agua'].includes(subcategoria) && (
        <label>Concepto
          <input type="text" placeholder="Descripción breve" value={form.concepto} onChange={e => set('concepto', e.target.value)} />
        </label>
      )}

      <label>Factura
        <select value={form.factura_key || 'SIN FACTURA'} onChange={e => set('factura_key', e.target.value)}>
          {FACTURA_OPTIONS.map(o => (
            <option key={o.label} value={o.facturado_a}>{o.label}</option>
          ))}
        </select>
      </label>

      {form.factura_key && form.factura_key !== 'SIN FACTURA' && (
        <label>No. Factura
          <input type="text" placeholder="Folio CFDI" value={form.no_factura} onChange={e => set('no_factura', e.target.value)} />
        </label>
      )}

      {/* Desglose por partidas (opcional). Si hay partidas, el monto base = suma. */}
      <div className="egresos-form-full egresos-partidas">
        <div className="egresos-partidas-head">
          <span>Desglose por artículo {usaPartidas && <em>(monto = suma de partidas)</em>}</span>
          <button type="button" className="egresos-partida-add" onClick={addPartida}>+ Agregar partida</button>
        </div>
        {usaPartidas && (
          <table className="egresos-partidas-tabla">
            <thead>
              <tr><th>Cant.</th><th>Concepto</th><th>Precio</th><th>Impuesto</th><th className="cell-right">Importe</th><th></th></tr>
            </thead>
            <tbody>
              {partidas.map((p, i) => (
                <tr key={i}>
                  <td><input type="number" min="0" step="0.001" value={p.cantidad} onChange={e => setPartida(i, 'cantidad', e.target.value)} className="egresos-partida-num" /></td>
                  <td><input type="text" placeholder="Artículo" value={p.concepto} onChange={e => setPartida(i, 'concepto', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.01" placeholder="0.00" value={p.precio} onChange={e => setPartida(i, 'precio', e.target.value)} className="egresos-partida-num" /></td>
                  <td>
                    <select value={p.impuesto_key || 'tasa0'} onChange={e => setPartida(i, 'impuesto_key', e.target.value)}>
                      {IMPUESTOS_LIST.map(imp => <option key={imp.key} value={imp.key}>{imp.label}</option>)}
                    </select>
                  </td>
                  <td className="cell-right egresos-partida-imp">{fmtN(n(p.cantidad) * n(p.precio))}</td>
                  <td><button type="button" className="egresos-partida-del" title="Quitar" onClick={() => delPartida(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} className="cell-right">Subtotal partidas</td><td className="cell-right egresos-partida-sub">{fmtN(sumPartidas)}</td><td></td></tr>
            </tfoot>
          </table>
        )}
        {!usaPartidas && (
          <p className="egresos-partidas-hint">Sin partidas — captura el monto abajo, o agrega artículos uno por uno.</p>
        )}
      </div>

      <label className="egresos-form-full">Descripción / Justificación
        <textarea rows={2} placeholder="Nota adicional (opcional)" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
      </label>

      {!usaPartidas && (
        <label>Monto base
          <input type="number" min="0" step="0.01" placeholder="0.00" value={form.monto} onChange={e => set('monto', e.target.value)} />
        </label>
      )}

      {!usaPartidas && (
        <label>Impuesto
          <select value={impKey} onChange={e => set('impuesto_key', e.target.value)}>
            {IMPUESTOS_LIST.map(imp => (
              <option key={imp.key} value={imp.key}>{imp.label}</option>
            ))}
          </select>
        </label>
      )}

      {!usaPartidas && montoImp > 0 && (
        <label>Monto impuesto
          <input type="text" readOnly value={fmtN(montoImp)} className="gas-calc-field" />
        </label>
      )}

      {!usaPartidas && n(form.monto) > 0 && (
        <label>Total
          <input type="text" readOnly value={fmtN(total)} className="gas-calc-field" style={{ fontWeight: 700, color: 'var(--tv-marca)' }} />
        </label>
      )}

      {usaPartidas && (
        <div className="egresos-form-full egresos-totales">
          {calc.subtotalIva16 > 0 && (
            <div className="egresos-total-row muted"><span>Subtotal IVA 16%</span><span>{fmtN(calc.subtotalIva16)}</span></div>
          )}
          {calc.subtotalIeps > 0 && (
            <div className="egresos-total-row muted"><span>Subtotal IEPS 8%</span><span>{fmtN(calc.subtotalIeps)}</span></div>
          )}
          {calc.subtotalTasa0 > 0 && (
            <div className="egresos-total-row muted"><span>Subtotal Tasa 0</span><span>{fmtN(calc.subtotalTasa0)}</span></div>
          )}
          <div className="egresos-total-row"><span>Subtotal</span><span>{fmtN(ef.subtotalEfectivo)}</span></div>
          {ef.iva  > 0 && <div className="egresos-total-row"><span>IVA 16%</span><span>{fmtN(ef.iva)}</span></div>}
          {ef.ieps > 0 && <div className="egresos-total-row"><span>IEPS 8%</span><span>{fmtN(ef.ieps)}</span></div>}
          <div className="egresos-total-row egresos-ajuste-row">
            <span>Ajuste (cuadre CFDI)</span>
            <input type="number" step="0.01" className="egresos-ajuste-input" value={ajusteShown}
              onChange={e => setForm(f => ({ ...f, ajuste: e.target.value, ajuste_manual: true }))} />
          </div>
          <div className="egresos-total-row final"><span>Total</span><span>{fmtN(ef.total)}</span></div>
        </div>
      )}
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
  const [busqueda, setBusqueda]         = useState('');

  const cat = CATEGORIAS.find(c => c.key === categoriaKey);

  const egresosFiltrados = (() => {
    const t = busqueda.toLowerCase().trim();
    const tn = t.replace(/^#/, '');
    const base = !t ? egresos : egresos.filter(e =>
      (e.no_factura || '').toLowerCase().includes(t) ||
      (e.concepto || '').toLowerCase().includes(t) ||
      (e.subcategoria || '').toLowerCase().includes(t) ||
      String(e.no_de_compra ?? '').includes(tn)
    );
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

  useEffect(() => { if (categoriaKey) cargar(categoriaKey); }, [categoriaKey, cargar]);

  const initForm = (subcat) => {
    const sc = subcat || cat?.subcategorias?.[0] || '';
    setForm({ ...FORM_INIT, subcategoria: sc, impuesto_key: impuestoDefault(sc) });
    setShowForm(true);
  };

  const buildPayload = () => {
    const facturaOpt = FACTURA_OPTIONS.find(o => o.facturado_a === (form.factura_key || 'SIN FACTURA'))
                    || FACTURA_OPTIONS[0];
    const up = s => (s || '').toUpperCase();
    const prov = form.proveedor?.name || '';  // pagado se marca en la lista, no al crear

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

    // Ruta partidas: impuesto por renglón + desglose por tasa + ajuste global (estilo Compras).
    if (rawPart.length) {
      const { ef } = calcTotalesPartidas(rawPart, form.ajuste, form.ajuste_manual);
      const partidas = rawPart.map(p => ({
        concepto: up(p.concepto), cantidad: n(p.cantidad), precio: n(p.precio),
        impuesto: (IMPUESTOS_MAP[p.impuesto_key || 'tasa0'] || {}).label || 'Tasa 0',
      }));
      // impuesto_tipo es Select acotado en el doctype → un solo valor válido (la verdad
      // por renglón vive en cada partida).
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

    // Ruta simple: un solo impuesto sobre el monto.
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

  const handlePagado = async (e) => {
    const nuevo = e.pagado ? 0 : 1;
    setEgresos(prev => prev.map(x => x.name === e.name ? { ...x, pagado: nuevo } : x)); // optimista
    try { await egresosService.marcarPagado(e.name, nuevo); }
    catch { setError('Error al marcar pagado'); cargar(categoriaKey); }
  };

  // ── Tiles ─────────────────────────────────────────────────────
  if (!categoriaKey) {
    const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <Layout>
        <div className="egresos-page">
          <div className="panel-greeting"><h2>Egresos</h2><p>{fecha}</p></div>
          <div className="egresos-tiles">
            {CATEGORIAS.map(c => (
              <button key={c.key} className="egresos-tile"
                onClick={() => setCategoriaKey(c.key)}>
                <div className="egresos-tile-icon">{c.icon}</div>
                <div className="egresos-tile-text">
                  <span className="egresos-tile-name">{c.label}</span>
                  <span className="egresos-tile-sub">{c.sub}</span>
                </div>
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
          <div className="egresos-list-title">{cat?.label}
            {cat?.esVista && <span className="egreso-vista-badge">vista</span>}
          </div>
          <input className="egresos-buscar" type="search"
            placeholder="Buscar factura, concepto, #compra…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
                  <th>No. compra</th><th>Fecha</th><th>Proveedor</th><th>Subcategoría</th><th>Concepto</th>
                  <th className="cell-right">Monto</th><th>Impuesto</th><th>Factura</th><th>Pago</th><th></th>
                </tr>
              </thead>
              <tbody>
                {egresosFiltrados.length === 0
                  ? <tr><td colSpan={10} className="egresos-empty" style={{ padding: '32px' }}>Sin resultados para “{busqueda}”.</td></tr>
                  : egresosFiltrados.map(e => (
                  <tr key={e.name}>
                    <td className="egresos-nocompra">{e.no_de_compra ? `#${e.no_de_compra}` : <span className="text-muted">—</span>}</td>
                    <td>{e.fecha}</td>
                    <td>{e.proveedor || <span className="text-muted">—</span>}</td>
                    <td>{e.subcategoria || '—'}</td>
                    <td>{e.concepto || <span className="text-muted">{e.descripcion ? '(ver detalle)' : '—'}</span>}</td>
                    <td className="egresos-monto cell-right">{fmtN(e.monto)}</td>
                    <td className="text-muted">{e.impuesto_tipo ? `${e.impuesto_tipo} ${fmtN(e.monto_impuesto)}` : '—'}</td>
                    <td>
                      {e.facturado_a && e.facturado_a !== 'SIN FACTURA'
                        ? <span className="egresos-factura-badge">{e.facturado_a}</span>
                        : <span className="egresos-sinfactura-badge">Sin factura</span>}
                      {e.no_factura && <div className="egresos-folio">{e.no_factura}</div>}
                    </td>
                    <td>
                      <button className={'egresos-pago-toggle' + (e.pagado ? ' pagado' : '')}
                        onClick={() => handlePagado(e)}
                        title={e.pagado ? 'Pagado — clic para revertir' : 'Marcar como pagado'}>
                        {e.pagado ? '✓ Pagado' : 'Por pagar'}
                      </button>
                    </td>
                    <td className="egresos-td-acciones">
                      <button className="egresos-print" title="Imprimir ticket" onClick={() => handleImprimir(e)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      {confirmDel === e.name
                        ? <span className="egresos-confirm-del">
                            ¿Seguro?{' '}
                            <button className="egresos-del-si" onClick={() => handleEliminar(e.name)}>Sí</button>
                            <button className="egresos-del-no" onClick={() => setConfirmDel(null)}>No</button>
                          </span>
                        : <button className="egresos-del" title="Eliminar" onClick={() => setConfirmDel(e.name)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="egresos-modal" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="egresos-modal-card">
            <div className="egresos-modal-header">
              <h3>Nuevo egreso — {cat?.label}</h3>
              <button className="egresos-modal-close" onClick={() => setShowForm(false)} title="Cerrar">✕</button>
            </div>

            <div className="egresos-modal-body">
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
                return form.subcategoria === 'Gas'
                  ? <GasForm form={form} setForm={setForm} subcatField={subcatField} proveedorField={proveedorField} />
                  : <SubcatForm subcategoria={form.subcategoria} form={form} setForm={setForm} subcatField={subcatField} proveedorField={proveedorField} />;
              })()}
            </div>

            <div className="egresos-form-actions">
              <button className="egresos-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="egresos-guardar" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar egreso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
