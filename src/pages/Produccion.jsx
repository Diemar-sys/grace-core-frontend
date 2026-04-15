// src/pages/Produccion.jsx
// Módulo de Producción: Recetas + Registro de producción
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NuevaReceta from '../components/NuevaReceta';
import ModalError from '../components/ModalError';
import { produccionService } from '../services/frappeProduccion';
import { stockService } from '../services/frappeStock';
import '../styles/global.css';
import '../styles/Produccion.css';
import '../styles/Panel.css';

const DEPARTAMENTOS = stockService.getAlmacenesDepartamento();

// ─── Icono alerta ──────────────────────────────────────
const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/><path d="M12 17h.01"/>
  </svg>
);

function Produccion() {
  const [searchParams] = useSearchParams();
  const soloLectura = searchParams.get('modo') === 'consulta';

  // 'menu' | 'recetas' | 'registro'
  const [vistaActiva, setVistaActiva] = useState(soloLectura ? 'recetas' : 'menu');

  // ── Recetas tab ──────────────────────────────────────
  const [recetas, setRecetas] = useState([]);
  const [loadingRecetas, setLoadingRecetas] = useState(true);
  const [searchReceta, setSearchReceta] = useState('');
  const [showNuevaReceta, setShowNuevaReceta] = useState(false);
  const [editBOM, setEditBOM] = useState(null);

  // ── Registro tab ──────────────────────────────────────
  const [regBOM, setRegBOM] = useState('');
  const [regCantidad, setRegCantidad] = useState('');
  const [regDepartamento, setRegDepartamento] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingReg, setLoadingReg] = useState(false);
  const [regSuccess, setRegSuccess] = useState('');

  // ── Global ────────────────────────────────────────────
  const [stockBajo, setStockBajo] = useState([]);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });

  // Cargar recetas
  const cargarRecetas = useCallback(async () => {
    setLoadingRecetas(true);
    try {
      const data = await produccionService.getBOMs(searchReceta);
      setRecetas(data);
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message });
    } finally {
      setLoadingRecetas(false);
    }
  }, [searchReceta]);

  useEffect(() => {
    cargarRecetas();
  }, []);

  // Preview de consumo + costo estimado
  useEffect(() => {
    const cargarPreview = async () => {
      if (!regBOM || !regCantidad || parseFloat(regCantidad) <= 0) { setPreview(null); return; }
      try {
        const bom = await produccionService.getBOMDetalle(regBOM);
        const factor = parseFloat(regCantidad) / (parseFloat(bom.quantity) || 1);

        // Traer precios de cada ingrediente desde el catálogo
        const itemCodes = (bom.items || []).map(i => i.item_code);
        const precios   = await produccionService.getPreciosIngredientes(itemCodes);

        const ingredientes = (bom.items || []).map(i => {
          const qty          = parseFloat(i.qty) * factor;
          const precioPorUnd = precios[i.item_code] || parseFloat(i.rate) || 0;
          return {
            item_code: i.item_code,
            item_name: i.item_name,
            qty:       qty.toFixed(4),
            uom:       i.stock_uom || i.uom,
            precio_und: precioPorUnd,
            costo:      qty * precioPorUnd,
          };
        });

        const costoTotal    = ingredientes.reduce((s, i) => s + i.costo, 0);
        const costoUnitario = costoTotal / parseFloat(regCantidad);

        // Si la receta tiene precio de venta, calcular margen
        const recetaInfo    = recetas.find(r => r.name === regBOM);
        const precioVenta   = parseFloat(recetaInfo?.custom_precio_de_venta) || 0;

        setPreview({ item_name: bom.item_name, ingredientes, costoTotal, costoUnitario, precioVenta });
      } catch { setPreview(null); }
    };
    cargarPreview();
  }, [regBOM, regCantidad, recetas]);

  // Registrar producción
  const handleRegistrar = async () => {
    if (!regBOM) { setErrorModal({ isOpen: true, message: 'SELECCIONA UNA RECETA PARA REGISTRAR LA PRODUCCIÓN.' }); return; }
    if (!regCantidad || parseFloat(regCantidad) <= 0) { setErrorModal({ isOpen: true, message: 'INGRESA UNA CANTIDAD PRODUCIDA MAYOR A CERO.' }); return; }
    if (!regDepartamento) { setErrorModal({ isOpen: true, message: 'SELECCIONA EL DEPARTAMENTO (ALMACÉN DE ORIGEN DEL CONSUMO).' }); return; }

    setLoadingReg(true);
    try {
      await produccionService.registrarProduccion({
        bomName: regBOM,
        cantidadProducida: parseFloat(regCantidad),
        almacenOrigen: regDepartamento,
      });
      setRegSuccess(`PRODUCCIÓN REGISTRADA: ${regCantidad} ${preview?.item_name || ''} → INSUMOS DESCONTADOS DEL ALMACÉN.`);
      setRegBOM(''); setRegCantidad(''); setRegDepartamento(''); setPreview(null);
      setTimeout(() => setRegSuccess(''), 4000);
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message || 'Error al registrar la producción' });
    } finally {
      setLoadingReg(false);
    }
  };

  return (
    <Layout title="Producción" subtitle="Recetas y registro de producción">
      <ModalError
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
      />

      {/* Modal Nueva Receta */}
      {showNuevaReceta && (
        <NuevaReceta
          editBOM={editBOM}
          onSuccess={() => { setShowNuevaReceta(false); setEditBOM(null); cargarRecetas(); }}
          onCancel={() => { setShowNuevaReceta(false); setEditBOM(null); }}
        />
      )}

      {/* Alerta stock bajo */}
      {stockBajo.length > 0 && (
        <div className="prod-stock-alert">
          <AlertIcon />
          <span><strong>{stockBajo.length} insumo(s)</strong> con stock bajo mínimo en el almacén seleccionado: {stockBajo.map(s => s.item_name).join(', ')}</span>
        </div>
      )}
      {/*2220*/}

      {/* ── MENÚ PRINCIPAL ───────────────────────────────── */}
      {vistaActiva === 'menu' && (
        <div className="panel-grid" style={{ padding: '20px 0' }}>
          <button className="panel-module" onClick={() => { cargarRecetas(); setVistaActiva('recetas'); }}>
            <div className="module-icon" style={{ background: '#fff7ed', color: '#7a3f0a' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 11h.01" /><path d="M11 15h.01" />
                <path d="M16 16h.01" />
                <path d="m2 16 20 6-6-20A20 20 0 0 0 2 16" />
                <path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4" />
              </svg>
            </div>
            <h3>Recetas</h3>
            <p>Ver y gestionar recetas</p>
          </button>

          <button className="panel-module" onClick={() => setVistaActiva('registro')}>
            <div className="module-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 12H3" /><path d="M16 6H3" /><path d="M16 18H3" />
                <path d="M18 9v6" /><path d="M21 12h-6" />
              </svg>
            </div>
            <h3>Registro de Producción</h3>
            <p>Registrar producción del día</p>
          </button>
        </div>
      )}

      {/* ── SECCIÓN: RECETAS ────────────────────────────── */}
      {vistaActiva === 'recetas' && (
        <>
          <div className="prod-lista-header">
            <h3>Recetas Registradas</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="filtro-group search">
                <input
                  type="text"
                  placeholder="Buscar receta..."
                  value={searchReceta}
                  onChange={e => setSearchReceta(e.target.value)}
                />
              </div>
              <button className="btn-refresh" onClick={cargarRecetas}>↻ Buscar</button>
              {!soloLectura && (
                <button className="btn-new-item" onClick={() => { setEditBOM(null); setShowNuevaReceta(true); }}>
                  + Nueva Receta
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Producto Final</th>
                  <th>Cantidad que produce</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  {!soloLectura && <th className="col-actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loadingRecetas ? (
                  <tr><td colSpan={5} className="loading">Cargando recetas...</td></tr>
                ) : recetas.length === 0 ? (
                  <tr><td colSpan={5} className="no-data">No hay recetas registradas. Crea la primera con "+ Nueva Receta".</td></tr>
                ) : (
                  recetas.map(r => (
                    <tr key={r.name}>
                      <td className="cell-name">{r.item_name || r.item}</td>
                      <td className="cell-qty">{r.quantity} {r.uom}</td>
                      <td className="cell-code">{r.custom_departamento || '—'}</td>
                      <td>
                        {r.is_active
                          ? <span className="prod-badge-activa">Activa</span>
                          : <span className="prod-badge-borrador">Borrador</span>
                        }
                      </td>
                      {!soloLectura && (
                        <td className="col-actions">
                          <button className="btn-edit-row" onClick={async () => {
                            try {
                              const detalle = await produccionService.getBOMDetalle(r.name);
                              setEditBOM(detalle);
                              setShowNuevaReceta(true);
                            } catch (err) {
                              setErrorModal({ isOpen: true, message: err.message });
                            }
                          }}>Ver / Editar</button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── SECCIÓN: REGISTRO ───────────────────────────── */}
      {vistaActiva === 'registro' && (
        <div className="registro-form">
          <h3>Registrar Producción del Día</h3>

          {regSuccess && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>{regSuccess}</div>
          )}

          <div className="registro-grid">
            <div className="registro-field">
              <label>Receta (BOM) *</label>
              <select value={regBOM} onChange={e => setRegBOM(e.target.value)}>
                <option value="">— Selecciona una receta —</option>
                {recetas.filter(r => r.is_active).map(r => (
                  <option key={r.name} value={r.name}>{r.item_name || r.item}</option>
                ))}
              </select>
            </div>

            <div className="registro-field">
              <label>Departamento (Almacén) *</label>
              <select value={regDepartamento} onChange={e => {
                setRegDepartamento(e.target.value);
                if (e.target.value) {
                  produccionService.getStockBajoMinimo(e.target.value).then(setStockBajo).catch(() => {});
                }
              }}>
                <option value="">— Selecciona departamento —</option>
                {DEPARTAMENTOS.map(d => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="registro-field">
              <label>Cantidad Producida *</label>
              <input type="number" value={regCantidad}
                onChange={e => setRegCantidad(e.target.value)}
                min="0.001" step="0.001" placeholder="50" />
            </div>
          </div>

          {/* Preview de consumo + costo estimado */}
          {preview && preview.ingredientes.length > 0 && (
            <div className="registro-preview">
              <h4>Insumos a descontar — Costo estimado de {preview.item_name}</h4>

              <table className="preview-cost-table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>$/unid</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.ingredientes.map(i => (
                    <tr key={i.item_code}>
                      <td>{i.item_name}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                        -{i.qty} {i.uom}
                      </td>
                      <td style={{ textAlign: 'right', color: '#6b7280' }}>
                        {i.precio_und > 0 ? `$${i.precio_und.toFixed(4)}` : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {i.costo > 0 ? `$${i.costo.toFixed(2)}` : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Resumen de costos */}
              {preview.costoTotal > 0 && (
                <div className="preview-cost-summary">
                  <div className="preview-cost-row">
                    <span>Costo total del lote ({regCantidad} {preview.item_name})</span>
                    <span>${preview.costoTotal.toFixed(2)}</span>
                  </div>
                  <div className="preview-cost-row highlight">
                    <span>📦 Costo por unidad</span>
                    <span>${preview.costoUnitario.toFixed(4)}</span>
                  </div>
                  {preview.precioVenta > 0 && (
                    <div className="preview-cost-row margin" style={{
                      color: preview.precioVenta > preview.costoUnitario ? '#065f46' : '#991b1b'
                    }}>
                      <span>
                        {preview.precioVenta > preview.costoUnitario ? '✅' : '⚠️'} Margen por unidad
                        ({(((preview.precioVenta - preview.costoUnitario) / preview.precioVenta) * 100).toFixed(1)}%)
                      </span>
                      <span>${(preview.precioVenta - preview.costoUnitario).toFixed(4)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button className="btn-guardar-receta" disabled={loadingReg} onClick={handleRegistrar}
            style={{ width: '100%', padding: '12px' }}>
            {loadingReg ? 'Registrando...' : '✓ Confirmar Producción'}
          </button>
        </div>
      )}
    </Layout>
  );
}

export default Produccion;