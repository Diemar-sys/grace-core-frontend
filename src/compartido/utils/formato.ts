/**
 * Formato de números para México: coma de miles, punto decimal.
 *
 * Existe porque el 60% de la app imprime con `.toFixed(2)` y `1234567.89` sin
 * separadores se lee mal justo donde importa: un total de compra, un valor de
 * inventario, una nómina. `toFixed` no separa miles y nunca lo va a hacer.
 *
 * 🔴 `style: 'currency'` NO se usa: en Node da "$1,234.56" pero el ICU de
 * algunos navegadores devuelve "MX$1,234.56" para es-MX, y el símbolo saldría
 * distinto según quién abra la pantalla. El "$" se pone aquí y no se discute.
 */

/** Miles con coma. `dec` fija los decimales (2 para dinero, 0 para piezas). */
export function numero(valor: unknown, dec = 2): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return (0).toFixed(dec);
  // 🔴 -0.004 redondea a "-0.00" y en pantalla parece un adeudo. El cero no
  // tiene signo: se normaliza antes de formatear.
  const limpio = Object.is(n, -0) || Math.abs(n) < 0.5 / 10 ** dec ? 0 : n;
  return limpio.toLocaleString('es-MX', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/**
 * Dinero: `$1,234.56`, y el negativo como `-$5,181.10`.
 *
 * 🔴 El signo va ANTES del símbolo. Pegar "$" al frente daba "$-5,181.10", que
 * no es como se escribe un adeudo aquí.
 */
export function pesos(valor: unknown): string {
  const texto = numero(valor, 2);
  return texto.startsWith('-') ? `-$${texto.slice(1)}` : `$${texto}`;
}

/**
 * Cantidades de inventario: hasta `dec` decimales pero sin ceros de relleno,
 * para que 140 kg se lea "140" y no "140.000".
 */
export function cantidad(valor: unknown, dec = 3): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-MX', { maximumFractionDigits: dec });
}
