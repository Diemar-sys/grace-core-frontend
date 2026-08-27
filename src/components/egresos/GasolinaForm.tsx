// src/components/egresos/GasolinaForm.tsx
import React, { ReactNode } from 'react';
import { EgresoFormState } from './egresosTypes';
import { VEHICULOS, FACTURA_OPTIONS, fmtN } from './egresosConstants';
import { calcGasolina } from '../compras/compraUtils';

interface GasolinaFormProps {
  form: EgresoFormState;
  setForm: React.Dispatch<React.SetStateAction<EgresoFormState>>;
  subcatField: ReactNode;
  proveedorField: ReactNode;
}

export const GasolinaForm: React.FC<GasolinaFormProps> = ({
  form,
  setForm,
  subcatField,
  proveedorField,
}) => {
  const { base, ieps, baseGravable, iva, total } = calcGasolina({
    litros: form.gasolina_litros,
    precio: form.gasolina_precio,
    iva: form.gasolina_iva,
    total: form.gasolina_total,
  });

  const ivaManual = form.gasolina_iva !== '';
  const totalManual = form.gasolina_total !== '';
  const alerta = ieps < -0.005 ? 'El total es menor que base + IVA — revisa la factura' : null;

  const set = (k: keyof EgresoFormState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="gas-form">
      <div className="gas-form-grid">
        {proveedorField}
        {subcatField}
        <label>
          Vehículo
          <select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
            <option value="">Seleccionar...</option>
            {VEHICULOS.map(v => (
              <option key={v}>{v}</option>
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
        <div className="gas-linea-header">Combustible</div>
        <div className="gas-linea-grid">
          <label>
            Litros
            <input
              type="number"
              step="0.001"
              placeholder="0.000"
              value={form.gasolina_litros}
              onChange={e => set('gasolina_litros', e.target.value)}
            />
          </label>
          <label>
            Precio unitario
            <input
              type="number"
              step="0.000001"
              placeholder="0.000000"
              value={form.gasolina_precio}
              onChange={e => set('gasolina_precio', e.target.value)}
            />
          </label>
          <label>
            Base
            <input type="text" readOnly value={fmtN(base)} className="gas-calc-field" />
          </label>
        </div>

        {alerta && <div className="gas-alerta">⚠ {alerta}</div>}

        <div className="gas-totales">
          <div className="gas-total-row">
            <span>Base gravable</span>
            <span>{fmtN(baseGravable)}</span>
          </div>
          {Math.abs(ieps) > 0.005 && (
            <div className="gas-total-row">
              <span>IEPS (derivado)</span>
              <span>{fmtN(ieps)}</span>
            </div>
          )}
          <div className="gas-total-row">
            <span>
              IVA{' '}
              <span className={`gas-badge ${ivaManual ? 'manual' : 'auto'}`}>
                {ivaManual ? 'Manual' : 'Auto'}
              </span>
            </span>
            <span className="gas-ajuste">
              {ivaManual && (
                <button
                  type="button"
                  className="gas-btn-reset"
                  title="Restaurar IVA calculado"
                  onClick={() => set('gasolina_iva', '')}
                >
                  ↺
                </button>
              )}
              <input
                type="number"
                step="0.01"
                className="gas-input-ajuste"
                value={ivaManual ? form.gasolina_iva : iva.toFixed(2)}
                onChange={e => set('gasolina_iva', e.target.value)}
              />
            </span>
          </div>
          <div className="gas-total-row gas-total-final">
            <span>
              Total{' '}
              <span className={`gas-badge ${totalManual ? 'manual' : 'auto'}`}>
                {totalManual ? 'Manual' : 'Auto'}
              </span>
            </span>
            <span className="gas-ajuste">
              {totalManual && (
                <button
                  type="button"
                  className="gas-btn-reset"
                  title="Restaurar total calculado"
                  onClick={() => set('gasolina_total', '')}
                >
                  ↺
                </button>
              )}
              <input
                type="number"
                step="0.01"
                className="gas-input-ajuste"
                value={totalManual ? form.gasolina_total : total.toFixed(2)}
                onChange={e => set('gasolina_total', e.target.value)}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
