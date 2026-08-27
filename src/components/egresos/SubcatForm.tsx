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
import { IMPUESTOS_LIST, IMPUESTOS_MAP } from '../../config/impuestos';
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
  const { calc, ef } = calcTotalesPartidas(partidas, form.ajuste, form.ajuste_manual);
  const ajusteShown = form.ajuste_manual
    ? form.ajuste
    : ef.ajusteSAT
    ? ef.ajusteSAT.toFixed(2)
    : '0.00';

  // Ruta simple (sin partidas): un solo impuesto sobre el monto.
  const impKey = form.impuesto_key || 'tasa0';
  const impEntry = IMPUESTOS_MAP[impKey] || IMPUESTOS_MAP['tasa0'];
  const montoImp = n(form.monto) * impEntry.rate;
  const total = n(form.monto) + montoImp;

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

      {!usaPartidas && montoImp > 0 && (
        <label>
          Monto impuesto
          <input type="text" readOnly value={fmtN(montoImp)} className="gas-calc-field" />
        </label>
      )}

      {!usaPartidas && n(form.monto) > 0 && (
        <label>
          Total
          <input
            type="text"
            readOnly
            value={fmtN(total)}
            className="gas-calc-field"
            style={{ fontWeight: 700, color: 'var(--tv-marca)' }}
          />
        </label>
      )}

      {usaPartidas && (
        <div className="egresos-form-full egresos-totales">
          {calc.subtotalIva16 > 0 && (
            <div className="egresos-total-row muted">
              <span>Subtotal IVA 16%</span>
              <span>{fmtN(calc.subtotalIva16)}</span>
            </div>
          )}
          {calc.subtotalIeps > 0 && (
            <div className="egresos-total-row muted">
              <span>Subtotal IEPS 8%</span>
              <span>{fmtN(calc.subtotalIeps)}</span>
            </div>
          )}
          {calc.subtotalTasa0 > 0 && (
            <div className="egresos-total-row muted">
              <span>Subtotal Tasa 0</span>
              <span>{fmtN(calc.subtotalTasa0)}</span>
            </div>
          )}
          <div className="egresos-total-row">
            <span>Subtotal</span>
            <span>{fmtN(ef.subtotalEfectivo)}</span>
          </div>
          {ef.iva > 0 && (
            <div className="egresos-total-row">
              <span>IVA 16%</span>
              <span>{fmtN(ef.iva)}</span>
            </div>
          )}
          {ef.ieps > 0 && (
            <div className="egresos-total-row">
              <span>IEPS 8%</span>
              <span>{fmtN(ef.ieps)}</span>
            </div>
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
