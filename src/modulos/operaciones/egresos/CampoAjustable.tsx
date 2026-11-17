// src/components/egresos/CampoAjustable.tsx
import React from 'react';

/**
 * Renglon de total que el sistema calcula pero la persona puede corregir.
 *
 * El calculo es una suposicion razonable; el papel que tienen enfrente es la
 * verdad. Cuando no coinciden gana el papel, y el badge deja ver de un vistazo
 * cual de los dos esta mandando. La flecha devuelve el control al calculo, que
 * si no, un ajuste tecleado por error se queda para siempre sin que se note.
 *
 * `manual` vacio = automatico. Es el mismo trato que ya usaba GasolinaForm.
 */
interface CampoAjustableProps {
  label: string;
  /** Valor que sale del calculo. Se muestra mientras nadie lo pise. */
  auto: number;
  /** Override tecleado. Cadena vacia = usar el automatico. */
  manual: string;
  onChange: (v: string) => void;
  step?: string;
  destacado?: boolean;
  /** Prefijo de clases CSS: 'gas' (formularios de combustible) o 'egresos'. */
  skin?: 'gas' | 'egresos';
}

export const CampoAjustable: React.FC<CampoAjustableProps> = ({
  label, auto, manual, onChange, step = '0.01', destacado = false, skin = 'gas',
}) => {
  const esManual = manual !== '';
  const fila = skin === 'egresos' ? 'egresos-total-row' : 'gas-total-row';
  return (
    <div className={`${fila}${destacado ? (skin === 'egresos' ? ' final' : ' gas-total-final') : ''}`}>
      <span>
        {label}{' '}
        <span className={`gas-badge ${esManual ? 'manual' : 'auto'}`}>
          {esManual ? 'Manual' : 'Auto'}
        </span>
      </span>
      <span className="gas-ajuste">
        {esManual && (
          <button
            type="button"
            className="gas-btn-reset"
            title={`Restaurar ${label.toLowerCase()} calculado`}
            onClick={() => onChange('')}
          >
            ↺
          </button>
        )}
        <input
          type="number"
          step={step}
          className="gas-input-ajuste"
          value={esManual ? manual : auto.toFixed(2)}
          onChange={e => onChange(e.target.value)}
        />
      </span>
    </div>
  );
};
