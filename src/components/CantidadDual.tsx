import { useState } from 'react';
import type { RefObject } from 'react';

/**
 * Cantidad capturable en sus DOS unidades: base (Kg/Lt/PZA) y presentación
 * (BULTO/CAJA). Se teclea en la que se tenga en la cabeza y la otra se calcula,
 * igual que margen ↔ precio de venta en el alta de producto.
 *
 * 🔴 Existe porque el renglón chiquito "= 4.88 BULTO" debajo del input no se ve:
 * quien surte teclea `2` pensando bultos y salen 2 Kg. El error de UOM que costó
 * $8,846.23 en julio entró exactamente así, por la puerta de la captura.
 *
 * NO hay dos verdades. `valor` es la única, y `capturaEn` dice en qué unidad la
 * guarda cada pantalla: compras guarda BULTOS (su rate es por bulto), ventas y
 * traspasos guardan la unidad BASE (no siempre se manda el bulto entero). El
 * campo contrario es una vista derivada en el render — nunca estado espejo, que
 * es como `precio_final` se fue desfasado al servidor el 17-ago.
 */

/** Decimales a los que se corta la conversión. Los mismos que ya usan el catálogo
 *  (`custom_cantidad_por_presentación`) y el input de precio (`step 0.000001`). */
export const DECIMALES = 6;

/**
 * Mata el ruido binario de la división. Sin esto, 122 / 25 * 25 imprime
 * 121.99999999999999 y el renglón se ve corrupto aunque el número esté bien.
 */
export function redondear(n: number, dec: number = DECIMALES): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

/** Factor usable: 1 cuando no hay presentación o viene basura. 1 = sin conversión. */
export function factorSeguro(factor: unknown): number {
  const f = parseFloat(String(factor));
  return Number.isFinite(f) && f > 0 ? f : 1;
}

/**
 * Convierte el texto de un campo al del otro. Devuelve TEXTO, no número: es lo
 * que se pinta en un input, y '' tiene que sobrevivir como '' — un 0 metido a la
 * fuerza en el campo vacío haría que borrar la cantidad capture un cero.
 */
export function convertir(txt: string, factor: unknown, hacia: 'base' | 'pres'): string {
  const n = parseFloat(txt);
  if (!Number.isFinite(n)) return '';
  const f = factorSeguro(factor);
  return String(redondear(hacia === 'base' ? n * f : n / f));
}

interface Props {
  /** La verdad del renglón, cruda como se teclea. */
  valor: string;
  /** Recibe la verdad ya en la unidad de `capturaEn`. */
  onValor: (v: string) => void;
  /** Unidades base por presentación (BULTO de 25 Kg → 25). */
  factor: unknown;
  /** Etiqueta de la unidad base: Kg, Lt, PZA. */
  uomBase: string;
  /** Etiqueta de la presentación: BULTO, CAJA. Vacío = no hay segundo campo. */
  presentacion?: string;
  /** En qué unidad guarda ESTA pantalla. Compras: 'presentacion'. Resto: 'base'. */
  capturaEn?: 'base' | 'presentacion';
  disabled?: boolean;
  alerta?: boolean;
  placeholder?: string;
  title?: string;
  inputRef?: RefObject<HTMLInputElement>;
  onEnter?: () => void;
}

export default function CantidadDual({
  valor, onValor, factor, uomBase, presentacion = '',
  capturaEn = 'base', disabled = false, alerta = false,
  placeholder = '0', title = '', inputRef, onEnter,
}: Props) {
  // Mientras se teclea, el campo muestra lo tecleado TAL CUAL. Sin esto, escribir
  // "1.5" muere en el punto: "1." se convierte a 1, regresa "1" y se come el punto
  // antes de poder teclear el 5.
  const [borrador, setBorrador] = useState<{ campo: 'base' | 'pres'; txt: string } | null>(null);

  const f = factorSeguro(factor);
  const dual = f !== 1 && !!presentacion;

  const guardaBase = capturaEn === 'base';
  const derivado = (hacia: 'base' | 'pres') => convertir(valor, f, hacia);

  const txtBase = borrador?.campo === 'base' ? borrador.txt : (guardaBase ? valor : derivado('base'));
  const txtPres = borrador?.campo === 'pres' ? borrador.txt : (guardaBase ? derivado('pres') : valor);

  const teclear = (campo: 'base' | 'pres', txt: string) => {
    setBorrador({ campo, txt });
    const esLaVerdad = (campo === 'base') === guardaBase;
    onValor(esLaVerdad ? txt : convertir(txt, f, guardaBase ? 'base' : 'pres'));
  };

  const props = (campo: 'base' | 'pres') => ({
    className: `nc-input cantidad${alerta ? ' nc-input-alerta' : ''}`,
    type: 'number' as const,
    min: '0',
    step: '0.000001',
    disabled,
    title,
    placeholder,
    onBlur: () => setBorrador(null),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => teclear(campo, e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); }
    },
  });

  // Sin presentación real no hay nada que convertir: un solo campo, como siempre.
  if (!dual) {
    return (
      <div className="nc-dual">
        <label className="nc-dual-campo">
          <input {...props(guardaBase ? 'base' : 'pres')} ref={inputRef}
            value={guardaBase ? txtBase : txtPres} />
          <span className="nc-dual-unidad">{guardaBase ? uomBase : presentacion || uomBase}</span>
        </label>
      </div>
    );
  }

  return (
    <div className="nc-dual">
      <label className="nc-dual-campo">
        <input {...props('base')} ref={guardaBase ? inputRef : undefined} value={txtBase} />
        <span className="nc-dual-unidad">{uomBase}</span>
      </label>
      <span className="nc-dual-igual" aria-hidden="true">=</span>
      <label className="nc-dual-campo">
        <input {...props('pres')} ref={guardaBase ? undefined : inputRef} value={txtPres} />
        <span className="nc-dual-unidad">{presentacion}</span>
      </label>
      <span className="nc-dual-factor">1 {presentacion} = {redondear(f, 4)} {uomBase}</span>
    </div>
  );
}
