// src/components/egresos/GasForm.tsx
import React, { ReactNode } from 'react';
import { EgresoFormState } from './egresosTypes';
import { SUCURSALES_RECIBO, FACTURA_OPTIONS, IVA_RATE, fmtN, n } from './egresosConstants';

interface GasFormProps {
  form: EgresoFormState;
  setForm: React.Dispatch<React.SetStateAction<EgresoFormState>>;
  subcatField: ReactNode;
  proveedorField: ReactNode;
}

export const GasForm: React.FC<GasFormProps> = ({
  form,
  setForm,
  subcatField,
  proveedorField,
}) => {
  const gasSubtotal = n(form.gas_litros) * n(form.gas_precio);
  const aditivoSubtotal = n(form.aditivo_litros) * n(form.aditivo_precio);
  const subtotal = gasSubtotal + aditivoSubtotal;
  const descuento = n(form.descuento_gas);
  const baseGravable = subtotal - descuento;
  const iva = baseGravable * IVA_RATE;
  const total = baseGravable + iva;

  const set = (k: keyof EgresoFormState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="gas-form">
      <div className="gas-form-grid">
        {proveedorField}
        {subcatField}
        <label>
          Sucursal
          <select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
            <option value="">Seleccionar...</option>
            {SUCURSALES_RECIBO.map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </label>
        <label>
          Factura
          <select
            value={form.factura_key || 'SIN FACTURA'}
            onChange={e => set('factura_key', e.target.value)}
          >
            {FACTURA_OPTIONS.map(o => (
              <option key={o.label} value={o.facturado_a}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {form.factura_key && form.factura_key !== 'SIN FACTURA' && (
          <label>
            No. Factura
            <input
              type="text"
              placeholder="Folio CFDI"
              value={form.no_factura}
              onChange={e => set('no_factura', e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="gas-lineas">
        {/* Línea Gas */}
        <div className="gas-linea-header">Gas</div>
        <div className="gas-linea-grid">
          <label>
            Litros
            <input
              type="number"
              step="0.001"
              placeholder="0.000"
              value={form.gas_litros}
              onChange={e => set('gas_litros', e.target.value)}
            />
          </label>
          <label>
            Precio unitario
            <input
              type="number"
              step="0.000001"
              placeholder="0.000000"
              value={form.gas_precio}
              onChange={e => set('gas_precio', e.target.value)}
            />
          </label>
          <label>
            Subtotal
            <input type="text" readOnly value={fmtN(gasSubtotal)} className="gas-calc-field" />
          </label>
        </div>

        {/* Línea Aditivo */}
        <div className="gas-linea-header">Aditivo</div>
        <div className="gas-linea-grid">
          <label>
            Litros
            <input
              type="number"
              step="0.001"
              placeholder="0.000"
              value={form.aditivo_litros}
              onChange={e => set('aditivo_litros', e.target.value)}
            />
          </label>
          <label>
            Precio unitario
            <input
              type="number"
              step="0.000001"
              placeholder="0.000000"
              value={form.aditivo_precio}
              onChange={e => set('aditivo_precio', e.target.value)}
            />
          </label>
          <label>
            Subtotal
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
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.descuento_gas}
              onChange={e => set('descuento_gas', e.target.value)}
              className="gas-descuento-input"
            />
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
};
