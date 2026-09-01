// src/components/egresos/SubcatForm.tsx
import React, { ReactNode } from 'react';
import { EgresoFormState, PartidaItem } from './egresosTypes';
import {
  VEHICULOS,
  TELEFONOS,
  TIPOS_MANT,
  TIPOS_REFAC,
  TIPOS_AGUA,
  SUCURSALES_RECIBO,
  FACTURA_OPTIONS,
  fmtN,
  n,
} from './egresosConstants';
import { IMPUESTOS_LIST } from '../../config/impuestos';
import { calcSimple } from './simpleCalc';
import { CampoAjustable } from './CampoAjustable';
import { calcTotalesPartidas } from '../../utils/egresosUtils';

interface SubcatFormProps {
  subcategoria: string;
  form: EgresoFormState;
  setForm: React.Dispatch<React.SetStateAction<EgresoFormState>>;
  subcatField: ReactNode;
  proveedorField: ReactNode;
}

export const SubcatForm: React.FC<SubcatFormProps> = ({
  subcategoria,
  form,
  setForm,
  subcatField,
  proveedorField,
}) => {
  const set = (k: keyof EgresoFormState, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // ── Partidas (desglose opcional) ──
  const partidas = form.partidas || [];
  const usaPartidas = partidas.length > 0;
  const sumPartidas = partidas.reduce(
    (s: number, p: PartidaItem) => s + n(p.cantidad) * n(p.precio),
    0
  );

  const setPartida = (i: number, k: string, v: unknown) =>
    setForm(f => {
      const arr = [...(f.partidas || [])];
      arr[i] = { ...arr[i], [k]: v };
      return { ...f, partidas: arr };
    });

  const addPartida = () =>
    setForm(f => ({
      ...f,
      partidas: [
        ...(f.partidas || []),
        {
          id: String(Date.now()),
          concepto: '',
          cantidad: 1,
          precio: '',
          monto: '',
          impuesto_key: 'tasa0',
        },
      ],
    }));

  const delPartida = (i: number) =>
    setForm(f => ({
      ...f,
      partidas: (f.partidas || []).filter((_, j) => j !== i),
    }));

  // Con partidas: desglose por tasa estilo Compras + ajuste global (cuadrar CFDI).
  const ov = form.totales_override || {};
  const { calc, ef } = calcTotalesPartidas(partidas, form.ajuste, form.ajuste_manual, ov);
  // Un solo mapa para los cinco campos: mas simple que cinco banderas sueltas,
  // y no puede quedar un booleano diciendo 'manual' sin valor que lo respalde.
  const setOv = (k: string, v: string) =>
    setForm(f => ({ ...f, totales_override: { ...(f.totales_override || {}), [k]: v } }));
  const ajusteShown = form.ajuste_manual
    ? form.ajuste
    : ef.ajusteSAT
    ? ef.ajusteSAT.toFixed(2)
    : '0.00';

  // Ruta simple (sin partidas): un solo impuesto sobre el monto. La cuenta vive
  // en calcSimple y la comparte con Egresos.jsx — antes cada uno hacia la suya.
  const impKey = form.impuesto_key || 'tasa0';
  const simple = calcSimple({
    monto: form.monto, impuestoKey: impKey,
    impuestoManual: form.impuesto_manual, totalManual: form.total_manual,
  });

  const conceptoSelect = (opciones: string[], placeholder: string) => (
    <label>
      Concepto
      <select value={form.concepto} onChange={e => set('concepto', e.target.value)}>
        <option value="">{placeholder}</option>
        {opciones.map(o => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="egresos-form-grid">
      {proveedorField}
      {subcatField}
      <label>
        Fecha
        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
      </label>

      {subcategoria === 'Gasolina' && conceptoSelect(VEHICULOS, 'Seleccionar vehículo...')}
      {subcategoria === 'Teléfono' && conceptoSelect(TELEFONOS, 'Seleccionar persona...')}
      {subcategoria === 'Mantenimiento' && conceptoSelect(TIPOS_MANT, 'Seleccionar tipo...')}
      {subcategoria === 'Refacciones' && conceptoSelect(TIPOS_REFAC, 'Seleccionar tipo...')}
      {subcategoria === 'Agua' && conceptoSelect(TIPOS_AGUA, 'Seleccionar tipo...')}
      {subcategoria === 'Luz' && conceptoSelect(SUCURSALES_RECIBO, 'Seleccionar panadería...')}
      {!['Gasolina', 'Teléfono', 'Mantenimiento', 'Refacciones', 'Agua', 'Luz'].includes(
        subcategoria
      ) && (
        <label>
          Concepto
          <input
            type="text"
            placeholder="Descripción breve"
            value={form.concepto}
            onChange={e => set('concepto', e.target.value)}
          />
        </label>
      )}

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

      {/* Desglose por partidas (opcional) */}
      <div className="egresos-form-full egresos-partidas">
        <div className="egresos-partidas-head">
          <span>
            Desglose por artículo {usaPartidas && <em>(monto = suma de partidas)</em>}
          </span>
          <button type="button" className="egresos-partida-add" onClick={addPartida}>
            + Agregar partida
          </button>
        </div>
        {usaPartidas && (
          <table className="egresos-partidas-tabla">
            <thead>
              <tr>
                <th>Cant.</th>
                <th>Concepto</th>
                <th>Precio</th>
                <th>Impuesto</th>
                <th className="cell-right">Importe</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p: PartidaItem, i: number) => (
                <tr key={i}>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={String(p.cantidad ?? '')}
                      onChange={e => setPartida(i, 'cantidad', e.target.value)}
                      className="egresos-partida-num"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Artículo"
                      value={String(p.concepto ?? '')}
                      onChange={e => setPartida(i, 'concepto', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={String(p.precio ?? '')}
                      onChange={e => setPartida(i, 'precio', e.target.value)}
                      className="egresos-partida-num"
                    />
                  </td>
                  <td>
                    <select
                      value={String(p.impuesto_key || 'tasa0')}
                      onChange={e => setPartida(i, 'impuesto_key', e.target.value)}
                    >
                      {IMPUESTOS_LIST.map(imp => (
                        <option key={imp.key} value={imp.key}>
                          {imp.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="cell-right egresos-partida-imp">
                    {fmtN(n(p.cantidad) * n(p.precio))}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="egresos-partida-del"
                      title="Quitar"
                      onClick={() => delPartida(i)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="cell-right">
                  Subtotal partidas
                </td>
                <td className="cell-right egresos-partida-sub">{fmtN(sumPartidas)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
        {!usaPartidas && (
          <p className="egresos-partidas-hint">
            Sin partidas — captura el monto abajo, o agrega artículos uno por uno.
          </p>
        )}
      </div>

      <label className="egresos-form-full">
        Descripción / Justificación
        <textarea
          rows={2}
          placeholder="Nota adicional (opcional)"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
        />
      </label>

      {!usaPartidas && (
        <label>
          Monto base
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.monto}
            onChange={e => set('monto', e.target.value)}
          />
        </label>
      )}

      {!usaPartidas && (
        <label>
          Impuesto
          <select value={impKey} onChange={e => set('impuesto_key', e.target.value)}>
            {IMPUESTOS_LIST.map(imp => (
              <option key={imp.key} value={imp.key}>
                {imp.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Impuesto y total se pueden corregir: el recibo manda sobre el calculo. */}
      {!usaPartidas && n(form.monto) > 0 && (
        <div className="egresos-form-full">
          <div className="gas-totales">
            <CampoAjustable
              label="Monto impuesto"
              auto={simple.impuesto}
              manual={form.impuesto_manual}
              onChange={v => set('impuesto_manual', v)}
            />
            <CampoAjustable
              label="Total"
              auto={simple.total}
              manual={form.total_manual}
              onChange={v => set('total_manual', v)}
              destacado
            />
          </div>
        </div>
      )}

      {usaPartidas && (
        <div className="egresos-form-full egresos-totales">
          {calc.subtotalIva16 > 0 && (
            <CampoAjustable skin="egresos" label="Subtotal IVA 16%"
              auto={calc.subtotalIva16} manual={ov.subtotalIva16 || ''}
              onChange={v => setOv('subtotalIva16', v)} />
          )}
          {calc.subtotalIeps > 0 && (
            <CampoAjustable skin="egresos" label="Subtotal IEPS 8%"
              auto={calc.subtotalIeps} manual={ov.subtotalIeps || ''}
              onChange={v => setOv('subtotalIeps', v)} />
          )}
          {calc.subtotalTasa0 > 0 && (
            <CampoAjustable skin="egresos" label="Subtotal Tasa 0"
              auto={calc.subtotalTasa0} manual={ov.subtotalTasa0 || ''}
              onChange={v => setOv('subtotalTasa0', v)} />
          )}
          <div className="egresos-total-row">
            <span>Subtotal</span>
            <span>{fmtN(ef.subtotalEfectivo)}</span>
          </div>
          {ef.iva > 0 && (
            <CampoAjustable skin="egresos" label="IVA 16%"
              auto={ef.iva} manual={ov.iva || ''}
              onChange={v => setOv('iva', v)} />
          )}
          {ef.ieps > 0 && (
            <CampoAjustable skin="egresos" label="IEPS 8%"
              auto={ef.ieps} manual={ov.ieps || ''}
              onChange={v => setOv('ieps', v)} />
          )}
          <div className="egresos-total-row egresos-ajuste-row">
            <span>Ajuste (cuadre CFDI)</span>
            <input
              type="number"
              step="0.01"
              className="egresos-ajuste-input"
              value={ajusteShown}
              onChange={e =>
                setForm(f => ({ ...f, ajuste: e.target.value, ajuste_manual: true }))
              }
            />
          </div>
          <div className="egresos-total-row final">
            <span>Total</span>
            <span>{fmtN(ef.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
