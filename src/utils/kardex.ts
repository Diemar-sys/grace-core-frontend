// Consumo entre conteos del Kardex (sale de pages/Kardex.jsx el 07-oct, sin cambios de lógica).
type Fila = Record<string, any>;

/**
 * Cuánta materia prima se gastó entre los DOS últimos conteos físicos.
 *
 * Es la pregunta del jefe: "si al conteo había 100, compré 200 y el siguiente
 * conteo dio 50, gasté 250, ¿no?". Sí. Un conteo físico es la única verdad que
 * tiene el sistema, así que entre dos conteos todo lo que desapareció sin
 * documento (venta, traslado) se fue a producción.
 *
 * OJO al leerlo: ese número también se lleva la merma, lo que se echó a perder y
 * los errores de conteo. Sin BOM cargado no hay forma de separarlos — la etiqueta
 * de la vista lo dice.
 *
 * Devuelve null con menos de dos conteos: sin conteo de apertura no hay contra
 * qué medir, y adivinarlo con el saldo del rango daría un número inventado.
 */
export function consumoEntreConteos(filas: Fila[]) {
  const conteos: number[] = [];
  filas.forEach((f, i) => { if (f.voucher_type === 'Stock Reconciliation') conteos.push(i); });
  if (conteos.length < 2) return null;

  const [ini, fin] = conteos.slice(-2);
  let entradas = 0, salidas = 0;
  for (let i = ini + 1; i < fin; i++) {           // entre dos conteos seguidos no hay otro conteo
    entradas += parseFloat(filas[i].entrada) || 0;
    salidas  += parseFloat(filas[i].salida)  || 0;
  }
  const habia = parseFloat(filas[ini].resultado) || 0;
  const quedo = parseFloat(filas[fin].resultado) || 0;
  return {
    desde: filas[ini].fecha, hasta: filas[fin].fecha,
    habia, entradas, salidas, quedo,
    usado: habia + entradas - salidas - quedo,
  };
}
