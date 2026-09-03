import { useState, useEffect } from 'react';
import ModalError from './modals/ModalError';
import useInsumoForm from '../hooks/useInsumoForm';
import '../styles/NuevoPan.css';
import { claveImpuesto } from '../config/impuestos';
import { produccionService } from '../services/frappeProduccion';
import { numero } from '../utils/formato';

/**
 * Alta y precios del pan.
 *
 * Es la rama de PRODUCTO TERMINADO del alta de insumos, sacada a su propia
 * pantalla: el que registra pan no tiene por qué ver presentaciones, bultos ni
 * precios de compra. Por dentro usa el MISMO hook y la misma creación de Item
 * que Nuevo Insumo — si fueran dos altas distintas acabaríamos con dos panes
 * iguales a dos precios y nadie sabría cuál es el bueno.
 */

const CANALES = [
  {
    campo: 'custom_precio_de_venta',
    titulo: 'Sucursal',
    sub: 'Tiendas propias en zona urbana',
    hint: 'Es el precio base: si un canal se queda vacío, cobra éste.',
    placeholder: 'Ej: 20.00',
    tono: 'canal-sucursal',
    obligatorio: true,
    esBase: true,
  },
  {
    campo: 'custom_precio_de_venta_pueblos',
    titulo: 'Pueblos',
    sub: 'Puntos fijos: Milagro, Lagunillas, Vegil',
    hint: 'Vacío = cobra el precio de Sucursal.',
    placeholder: 'Ej: 18.00',
    tono: 'canal-pueblos',
    obligatorio: false,
  },
  {
    campo: 'custom_precio_de_venta_camioneta',
    titulo: 'Camioneta',
    sub: 'Rutas que salen a ranchos',
    hint: 'Se congela al enviar el pan a la ruta.',
    placeholder: 'Ej: 17.00',
    tono: 'canal-camioneta',
    obligatorio: false,
  },
];

/** Margen contra el costo estimado. Sin costo no hay nada que comparar. */
export function margen(precio, costo) {
  const p = parseFloat(precio) || 0;
  const c = parseFloat(costo) || 0;
  if (!(p > 0) || !(c > 0)) return null;
  return { ganancia: p - c, porcentaje: ((p - c) / c) * 100 };
}

/**
 * Compara un canal contra el precio de Sucursal, que es la base.
 *
 * Existe para que capturar un precio SIEMPRE responda algo, aunque no haya
 * costo estimado: sin esto el formulario se queda mudo justo cuando el usuario
 * acaba de teclear. Además delata el error silencioso — poner en Pueblos el
 * mismo precio que en Sucursal deja el canal sin efecto.
 */
export function comparaConSucursal(precioCanal, precioSucursal) {
  const p = parseFloat(precioCanal) || 0;
  const s = parseFloat(precioSucursal) || 0;
  if (!(p > 0) || !(s > 0)) return null;
  const dif = p - s;
  // Medio centavo: por debajo de eso son el mismo precio en la caja.
  return { dif, igual: Math.abs(dif) < 0.005 };
}

function NuevoPan({ onSuccess, onCancel, editItem = null }) {
  const {
    formData,
    loading,
    infoModal, setInfoModal,
    isEditing,
    categoriasFiltradas,
    unidadesBase,
    IMPUESTOS,
    handleChange,
    handleItemGroupChange,
    generateCode,
    handleSubmit,
  } = useInsumoForm({ editItem, onSuccess, tipoFijo: 'PRODUCTO TERMINADO' });

  const costo = formData.custom_costo_estimado;

  // La receta es la fuente de la verdad del costo: si el pan tiene BOM activo,
  // ese número sale de los ingredientes y sus precios de compra reales. Dejarlo
  // editable daría dos costos para el mismo pan y nadie sabría cuál manda, así
  // que el campo se bloquea y solo muestra lo que dice la receta.
  // Aquí sí se puede consultar: es UN pan (3 peticiones), no los 227 de la lista.
  const [costoReceta, setCostoReceta] = useState(null);
  const codigoEditado = editItem?.item_code;

  useEffect(() => {
    if (!codigoEditado) { setCostoReceta(null); return; }
    let cancel = false;
    produccionService.calcularCostoBOM(codigoEditado)
      .then(r => { if (!cancel) setCostoReceta(r); })
      .catch(() => { /* sin receta o sin permiso: el campo queda editable */ });
    return () => { cancel = true; };
  }, [codigoEditado]);
  // El campo guarda UNA clave; las casillas son la cara amable de esa clave.
  const conIva  = formData.custom_impuesto === 'iva16' || formData.custom_impuesto === 'iva16_ieps';
  const conIeps = formData.custom_impuesto === 'ieps'  || formData.custom_impuesto === 'iva16_ieps';
  const setImpuestos = (iva, ieps) => handleChange({
    target: { name: 'custom_impuesto', type: 'select-one', value: claveImpuesto(iva, ieps) },
  });
  const impuesto = IMPUESTOS.find(i => i.key === formData.custom_impuesto);
  const tasa = impuesto?.rate ?? 0;
  const precioPublico = parseFloat(formData.custom_precio_de_venta) || 0;
  const base = precioPublico > 0 ? precioPublico / (1 + tasa) : 0;

  return (
    <div className="pan-modal">
      <ModalError
        isOpen={infoModal.isOpen}
        message={infoModal.message}
        type={infoModal.type}
        onClose={() => {
          setInfoModal({ isOpen: false, message: '', type: 'error' });
          if (infoModal.type.startsWith('success')) onSuccess?.();
        }}
      />

      <div className="pan-container">
        <header className="pan-header">
          <div>
            <span className="pan-eyebrow">Catálogo · Pan</span>
            <h2>{isEditing ? 'Editar pan' : 'Registrar pan'}</h2>
            <p>{isEditing
              ? 'Ajusta los datos y los precios de cada canal.'
              : 'Un pan, tres precios según a dónde va.'}</p>
          </div>
          <button type="button" className="pan-close" onClick={onCancel} aria-label="Cerrar">×</button>
        </header>

        <form onSubmit={handleSubmit} className="pan-form">

          {/* ── IDENTIDAD ─────────────────────────────────────────────── */}
          <section className="pan-card">
            <div className="pan-card-head">
              <h3>¿Qué pan es?</h3>
              <span>Cómo lo va a ver quien cobra</span>
            </div>

            <div className="pan-field">
              <label htmlFor="pan-nombre">Nombre del pan *</label>
              <input id="pan-nombre" type="text" name="item_name" value={formData.item_name}
                onChange={handleChange} style={{ textTransform: 'uppercase' }}
                placeholder="Ej: CONCHA, BOLILLO, CUERNITO" required />
            </div>

            {/* El pan no trae código de barras: se produce en casa. Su ID propio
                ES el item_code — el identificador que ERPNext exige y el que
                sale en kardex, POS, tickets y reportes. Un solo campo a
                propósito: si el ID viviera también en `custom_código_interno`,
                tarde o temprano los dos números dirían cosas distintas. */}
            <div className="pan-field">
              <label htmlFor="pan-codigo">ID del pan {!isEditing && '*'}</label>
              <div className="pan-input-group">
                <input id="pan-codigo" type="text" name="item_code" value={formData.item_code}
                  onChange={handleChange} placeholder="La clave que ustedes le dan. Ej: 101"
                  style={{ textTransform: 'uppercase' }} required />
                {!isEditing && (
                  <button type="button" onClick={generateCode} className="pan-btn-auto">Auto</button>
                )}
              </div>
              <small>
                {isEditing
                  ? 'Cambiarlo renombra el pan y arrastra todo su historial. Cámbialo solo si de verdad hace falta.'
                  : 'Es con lo que se busca el pan en la caja y con lo que sale en los reportes. Si no manejan clave, «Auto» arma una con el nombre.'}
              </small>
            </div>
          </section>

          {/* ── CLASIFICACIÓN ─────────────────────────────────────────── */}
          <section className="pan-card">
            <div className="pan-card-head">
              <h3>¿De qué tipo y cómo se vende?</h3>
              <span>De aquí salen el departamento y el corte de caja</span>
            </div>

            <div className="pan-grid-2">
              <div className="pan-field">
                <label htmlFor="pan-categoria">Tipo de pan *</label>
                <select id="pan-categoria" name="item_group" value={formData.item_group}
                  onChange={handleItemGroupChange} required>
                  <option value="">Selecciona…</option>
                  {categoriasFiltradas.map(g => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
                <small>Pan blanco, pan dulce, repostería, panquelería…</small>
              </div>

              <div className="pan-field">
                <label htmlFor="pan-uom">Se vende por *</label>
                <select id="pan-uom" name="stock_uom" value={formData.stock_uom}
                  onChange={handleChange} required>
                  <option value="">Selecciona…</option>
                  {unidadesBase.map(u => (
                    <option key={u.name} value={u.name}>{u.name}</option>
                  ))}
                </select>
                <small>Pieza, kilo, docena…</small>
              </div>
            </div>

            <div className="pan-derivado">
              <span className="pan-derivado-label">Departamento</span>
              <span className="pan-derivado-valor">
                {formData.item_group || <em>se toma del tipo de pan</em>}
              </span>
              <small>El pan hereda el departamento de su categoría, así el corte de caja y el reporte de ventas cuadran solos.</small>
            </div>
          </section>

          {/* ── LOS TRES PRECIOS ──────────────────────────────────────── */}
          <section className="pan-card pan-card-precios">
            <div className="pan-card-head">
              <h3>Los tres precios</h3>
              <span>El mismo pan vale distinto según a dónde va</span>
            </div>

            <div className="pan-canales">
              {CANALES.map(canal => {
                const m = margen(formData[canal.campo], costo);
                const cmp = canal.esBase
                  ? null
                  : comparaConSucursal(formData[canal.campo], formData.custom_precio_de_venta);
                return (
                  <div key={canal.campo} className={`pan-canal ${canal.tono}`}>
                    <div className="pan-canal-head">
                      <strong>{canal.titulo}</strong>
                      <span>{canal.sub}</span>
                    </div>
                    <div className="pan-canal-input">
                      <span className="pan-signo">$</span>
                      <input type="number" name={canal.campo}
                        value={formData[canal.campo]} onChange={handleChange}
                        placeholder={canal.placeholder} min="0" step="0.01"
                        required={canal.obligatorio} />
                    </div>
                    {/* Siempre responde algo en cuanto hay precio: el margen si
                        se conoce el costo, y si no, cómo queda contra Sucursal. */}
                    {m || cmp ? (
                      <div className="pan-canal-avisos">
                        {m && (
                          <span className={`pan-margen ${m.ganancia <= 0 ? 'pan-margen-mal' : ''}`}>
                            {m.ganancia > 0
                              ? `Gana $${numero(m.ganancia, 2)} · ${numero(m.porcentaje, 0)}%`
                              : `Pierde $${numero(Math.abs(m.ganancia), 2)} por pieza`}
                          </span>
                        )}
                        {cmp && (
                          <span className={`pan-comparativa ${cmp.igual ? 'pan-comparativa-ojo' : ''}`}>
                            {cmp.igual
                              ? 'Igual que Sucursal — este canal no cambia nada'
                              : cmp.dif < 0
                                ? `$${numero(Math.abs(cmp.dif), 2)} menos que Sucursal`
                                : `$${numero(cmp.dif, 2)} más que Sucursal`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="pan-canal-hint">{canal.hint}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pan-grid-2 pan-fiscal">
              {/* Un pan puede causar los dos: IEPS 8% si pasa de 275 kcal/100 g, y el
                  IVA según cómo se venda. Por eso son casillas y no un select: sin
                  ninguna marcada es tasa 0, que no es un impuesto sino su ausencia. */}
              <div className="pan-field">
                <label>Impuestos incluidos en el precio</label>
                <div className="pan-impuestos">
                  <label className="pan-check">
                    <input type="checkbox" checked={conIva}
                      onChange={e => setImpuestos(e.target.checked, conIeps)} />
                    IVA 16%
                  </label>
                  <label className="pan-check">
                    <input type="checkbox" checked={conIeps}
                      onChange={e => setImpuestos(conIva, e.target.checked)} />
                    IEPS 8%
                  </label>
                </div>
                <small>
                  {!conIva && !conIeps
                    ? 'Sin marcar nada es tasa 0: el bolillo y el pan blanco van así.'
                    : conIva && conIeps
                      ? 'El IEPS entra primero y el IVA se calcula sobre base + IEPS: 25.28% en total, no 24%.'
                      : conIeps
                        ? 'IEPS 8%: pan de más de 275 kcal por cada 100 g.'
                        : 'IVA 16%: pan para consumo en el local.'}
                </small>
              </div>

              <div className="pan-field">
                <label htmlFor="pan-costo">
                  Costo por pieza ($){' '}
                  <span className="pan-opcional">{costoReceta ? 'de la receta' : 'opcional'}</span>
                </label>
                <input id="pan-costo" type="number" name="custom_costo_estimado"
                  value={costoReceta ? costoReceta.costoPorUnidad.toFixed(2) : formData.custom_costo_estimado}
                  onChange={handleChange} readOnly={Boolean(costoReceta)}
                  placeholder="Déjalo en blanco si aún no lo sabes" min="0" step="0.01" />
                <small>
                  {costoReceta
                    ? `Sale de la receta: ${costoReceta.cantidadProducida} ${costoReceta.uom} cuestan $${numero(costoReceta.costoTotal, 2)} de materia prima. Para cambiarlo, edita la receta en Producción — aquí no se toca para que no haya dos costos del mismo pan.`
                    : parseFloat(formData.custom_costo_estimado) > 0
                      ? 'Lo que cuesta producir una pieza. Con esto se valúa la entrada de pan sin receta y se calcula el margen de arriba. En cuanto el pan tenga receta, el costo sale de ahí y este campo se bloquea.'
                      : 'Si todavía no lo sacas, guárdalo así y captúralo después en Editar. Mientras tanto: la entrada de pan te va a pedir el costo cada vez, y no se puede calcular el margen. El pan queda marcado en la lista como «falta costo» para que lo encuentres.'}
                </small>
              </div>
            </div>

            {precioPublico > 0 && (
              <div className="pan-desglose">
                {tasa > 0
                  ? <>Sucursal: <strong>${numero(base, 2)}</strong> base + <strong>${numero((precioPublico - base), 2)}</strong> de {impuesto.label} = <strong>${numero(precioPublico, 2)}</strong> al público</>
                  : <>Sucursal: <strong>${numero(precioPublico, 2)}</strong> al público, sin impuesto</>}
              </div>
            )}
          </section>

          {/* ── NOTAS ─────────────────────────────────────────────────── */}
          <section className="pan-card">
            <div className="pan-card-head">
              <h3>Notas</h3>
              <span>Opcional</span>
            </div>
            <div className="pan-field">
              <textarea name="description" value={formData.description}
                onChange={handleChange} rows="2"
                placeholder="Cualquier detalle que valga la pena recordar de este pan" />
            </div>
            <label className="pan-check">
              <input type="checkbox" name="disabled" checked={formData.disabled} onChange={handleChange} />
              <span>Ya no se vende (deshabilitar)</span>
            </label>
          </section>

          <footer className="pan-actions">
            <button type="button" onClick={onCancel} className="pan-btn-secundario" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="pan-btn-primario" disabled={loading}>
              {loading ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Registrar pan'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default NuevoPan;
