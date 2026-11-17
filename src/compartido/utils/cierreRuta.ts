/**
 * cierreRuta — lógica PURA del cierre de ruta de una camioneta.
 *
 * Vive aparte del componente para poder probarla sin red ni React: aquí se
 * decide cuánto se le cobra al repartidor, y eso no se prueba a ojo.
 *
 * Lo que se teclea son CADENAS, no números: un input vacío, un "1." a medio
 * escribir y un "0" son tres cosas distintas y solo la última es una cantidad.
 * Convertir demasiado pronto fue el bug del campo dual el 04-sep.
 */

import { calcularLiquidacion, type Liquidacion, type MovimientoItem } from './liquidacion';

export interface CapturaRenglon {
  regresa: string;
  tiro: string;
}
/** Lo tecleado, por item_code. Un item ausente = nada capturado. */
export type Captura = Record<string, CapturaRenglon>;

export interface RenglonCaptura {
  item_code: string;
  regresa: number;
  tiro: number;
}

export interface ResumenRuta {
  salidas: MovimientoItem[];
  regresos: MovimientoItem[];
  mermas: MovimientoItem[];
}

/** Número desde lo tecleado. Vacío, basura o negativo cuentan como 0. */
export function cantidad(texto: string | undefined): number {
  const n = parseFloat(texto ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Solo los renglones con algo capturado. Mandar ceros infla la petición. */
export function renglonesCaptura(captura: Captura): RenglonCaptura[] {
  return Object.entries(captura)
    .map(([item_code, c]) => ({
      item_code,
      regresa: cantidad(c?.regresa),
      tiro: cantidad(c?.tiro),
    }))
    .filter(r => r.regresa > 0 || r.tiro > 0);
}

/**
 * Renglones donde se capturó más de lo que salió.
 *
 * El backend también corta, y a propósito: esto es para avisar ANTES de que el
 * repartidor apriete y se coma un error del servidor. La verdad la sigue
 * teniendo el servidor — este chequeo es cortesía, no la defensa.
 */
export function excesos(salidas: MovimientoItem[], captura: Captura): string[] {
  const salio = new Map(salidas.map(s => [s.item_code, Number(s.qty) || 0]));
  const malos: string[] = [];

  for (const [item_code, c] of Object.entries(captura)) {
    const capturado = cantidad(c?.regresa) + cantidad(c?.tiro);
    if (capturado <= 0) continue;
    const disponible = salio.get(item_code);
    if (disponible === undefined) { malos.push(item_code); continue; }
    // El margen absorbe el polvo binario de sumar dos decimales tecleados.
    if (capturado > disponible + 1e-9) malos.push(item_code);
  }
  return malos;
}

/**
 * La liquidación como quedaría si se confirmara lo tecleado AHORA.
 *
 * Suma lo ya registrado en el servidor con lo que está en pantalla: si el
 * repartidor cerró en dos tandas, la segunda no puede ignorar la primera o le
 * cobraría dos veces el mismo pan.
 */
export function previsualizar(resumen: ResumenRuta, captura: Captura): Liquidacion {
  const capturados = renglonesCaptura(captura);
  const comoMovimiento = (campo: 'regresa' | 'tiro'): MovimientoItem[] =>
    capturados.filter(r => r[campo] > 0).map(r => ({ item_code: r.item_code, qty: r[campo] }));

  return calcularLiquidacion(
    resumen.salidas ?? [],
    [...(resumen.regresos ?? []), ...comoMovimiento('regresa')],
    [...(resumen.mermas ?? []), ...comoMovimiento('tiro')],
  );
}
