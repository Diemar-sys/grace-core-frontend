import React, { useState } from 'react';
import { calcVariacion, fmt } from './compraUtils';

function ModalSugerenciaPrecios({ cambios, onAceptar, onOmitir }) {
  const [seleccionados, setSeleccionados] = useState(
    () => Object.fromEntries(cambios.map(c => [c.item_code, true]))
  );

  const toggle = (code) =>
    setSeleccionados(prev => ({ ...prev, [code]: !prev[code] }));

  const hayAlguno = Object.values(seleccionados).some(Boolean);

  return (
    <div className="nc-modal-overlay">
      <div className="nc-sugerencia-modal">
        <div className="nc-sugerencia-header">
          <span className="nc-sugerencia-icon">📊</span>
          <div>
            <h3>Actualizar precios en Catálogo</h3>
            <p>Los siguientes productos se compraron a un precio diferente al registrado.</p>
          </div>
        </div>

        <div className="nc-sugerencia-tabla-wrap">
          <table className="nc-sugerencia-tabla">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Producto</th>
                <th>Precio catálogo</th>
                <th>Precio compra</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map(c => {
                const v = calcVariacion(c);
                const sube = v && v.diff > 0;
                return (
                  <tr key={c.item_code} className={seleccionados[c.item_code] ? 'nc-row-sel' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="nc-checkbox"
                        checked={!!seleccionados[c.item_code]}
                        onChange={() => toggle(c.item_code)}
                      />
                    </td>
                    <td className="nc-sug-nombre">{c.item_name}</td>
                    <td className="nc-sug-monto">${fmt(v?.catalogo)}</td>
                    <td className="nc-sug-monto nc-sug-nuevo">${fmt(v?.actual)}</td>
                    <td>
                      <span className={`nc-var-badge ${sube ? 'nc-var-sube' : 'nc-var-baja'}`}>
                        {sube ? '▲' : '▼'} {Math.abs(v?.pct).toFixed(1)}%
                        {' '}({sube ? '+' : ''}${fmt(v?.diff)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="nc-sug-nota">
          Se actualizará <strong>Precio de Compra</strong> y <strong>Precio por KG</strong> en el Catálogo.
        </p>

        <div className="nc-sugerencia-actions">
          <button className="nc-btn-secondary" onClick={onOmitir}>
            Omitir, no actualizar
          </button>
          <button
            className="nc-btn-primary"
            onClick={() => onAceptar(cambios.filter(c => seleccionados[c.item_code]))}
            disabled={!hayAlguno}
          >
            Actualizar seleccionados
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalSugerenciaPrecios;
