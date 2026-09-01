// src/components/egresos/LuzForm.tsx
import React, { ReactNode } from 'react';
import { EgresoFormState } from './egresosTypes';
import { SUCURSALES_RECIBO, FACTURA_OPTIONS, fmtN } from './egresosConstants';
import { calcLuz } from './luzCalc';
import { CampoAjustable } from './CampoAjustable';

/**
 * Recibo de CFE. No es "monto + 16%": el IVA grava SOLO la energia, el DAP va
 * exento, y lo que se paga son pesos cerrados porque CFE no cobra centavos.
 * Ver luzCalc.ts para el porque de cada regla, verificado contra el papel.
 */
interface LuzFormProps {
  form: EgresoFormState;
  setForm: React.Dispatch<React.SetStateAction<EgresoFormState>>;
  subcatField: ReactNode;
  proveedorField: ReactNode;
}

export const LuzForm: React.FC<LuzFormProps> = ({ form, setForm, subcatField, proveedorField }) => {
  const l = calcLuz({
    energia: form.luz_energia, dap: form.luz_dap,
    iva: form.luz_iva, totalPagar: form.luz_total,
  });

  const set = (k: keyof EgresoFormState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="gas-form">
      <div className="gas-form-grid">
        {proveedorField}
        {subcatField}
        <label>
          Panadería
          <select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
            <option value="">Seleccionar...</option>
            {SUCURSALES_RECIBO.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </label>
        <label>
          Factura
          <select value={form.factura_key || 'SIN FACTURA'} onChange={e => set('factura_key', e.target.value)}>
            {FACTURA_OPTIONS.map(o => (
              <option key={o.label} value={o.facturado_a}>{o.label}</option>
            ))}
          </select>
        </label>
        {form.factura_key && form.factura_key !== 'SIN FACTURA' && (
          <label>
            No. Factura
            <input type="text" placeholder="Folio CFDI" value={form.no_factura}
              onChange={e => set('no_factura', e.target.value)} />
          </label>
        )}
      </div>

      <div className="gas-lineas">
        <div className="gas-linea-header">Desglose del importe a pagar</div>
        <div className="gas-linea-grid">
          <label>
            Energía
            <input type="number" step="0.01" placeholder="0.00"
              value={form.luz_energia} onChange={e => set('luz_energia', e.target.value)} />
          </label>
          <label>
            DAP (alumbrado público)
            <input type="number" step="0.01" placeholder="0.00"
              value={form.luz_dap} onChange={e => set('luz_dap', e.target.value)} />
          </label>
          <label>
            Fac. del Periodo
            <input type="text" readOnly value={fmtN(l.facPeriodo)} className="gas-calc-field" />
          </label>
        </div>

        <div className="gas-totales">
          {/* El IVA grava la energia sola. Metiendole el DAP daria 212.75 donde el
              recibo dice 196.99 — el alumbrado publico no causa IVA. */}
          <CampoAjustable label="IVA 16% (solo energía)" auto={l.iva}
            manual={form.luz_iva} onChange={v => set('luz_iva', v)} />

          <div className="gas-total-row">
            <span>Total del recibo</span>
            <span>{fmtN(l.totalFactura)}</span>
          </div>

          {Math.abs(l.redondeo) >= 0.005 && (
            <div className="gas-total-row">
              <span>Ajuste por redondeo</span>
              <span>{fmtN(l.redondeo)}</span>
            </div>
          )}

          {/* Lo que de verdad sale del banco, y lo que se guarda como el gasto.
              CFE no cobra centavos: se trunca. Redondear pagaria un peso de mas. */}
          <CampoAjustable label="Total a pagar" auto={l.totalPagar} step="1" destacado
            manual={form.luz_total} onChange={v => set('luz_total', v)} />
        </div>
      </div>
    </div>
  );
};
