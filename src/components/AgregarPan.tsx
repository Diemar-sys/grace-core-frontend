// 02-nov (Diemar): en una hoja CORREGIDA, Luis y Administrator agregan cualquier pan habilitado que
// no venía en el Excel de ese destino. Solo se pinta si el servidor manda `puede_agregar`; el
// precio lo pone el servidor (catálogo por canal), aquí solo se elige el pan. Entra en 0 y se
// captura como cualquier otro.
import { useEffect, useState } from 'react';
import { hojaService, type PanParaAgregar } from '../services/frappeHoja';

interface Props {
  /** Devuelve true si se agregó (y entonces se vacía la casilla). */
  onAgregar: (itemCode: string) => Promise<boolean>;
  disabled: boolean;
}

export default function AgregarPan({ onAgregar, disabled }: Props) {
  const [panes, setPanes] = useState<PanParaAgregar[]>([]);
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    hojaService.panesParaAgregar().then(setPanes).catch(() => { /* ponytail: sin lista igual se teclea la clave */ });
  }, []);

  const agregar = async () => {
    if (await onAgregar(codigo.trim())) setCodigo('');
  };

  return (
    <div className="hoja-agregar-pan">
      <input list="hoja-panes-catalogo" className="buscador-pan" placeholder="Clave del pan a agregar"
        aria-label="Pan a agregar" value={codigo} disabled={disabled}
        onChange={e => setCodigo(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && codigo.trim()) agregar(); }} />
      <datalist id="hoja-panes-catalogo">
        {panes.map(p => <option key={p.item_code} value={p.item_code}>{p.item_name}</option>)}
      </datalist>
      <button type="button" className="hoja-btn hoja-btn--secundario" onClick={agregar} disabled={disabled || !codigo.trim()}>
        + Agregar pan
      </button>
    </div>
  );
}
