/**
 * Charolas y piezas sueltas. Espejo de `_charolas` en pedido_api.py.
 *
 * El backend la necesita para el PDF y la pantalla para la vista del día, que
 * suma varias pestañas y por eso no puede reusar el texto que vino calculado
 * por pestaña. Son dos implementaciones de la misma regla a propósito: el test
 * de abajo repite exactamente los casos del test de Python, así que si una se
 * mueve sin la otra, truena.
 */
export function charolas(piezas: number, porCharola: number): string {
  // lo que no va en charola (pasteles, gelatinas) no se reparte
  if (!porCharola || porCharola <= 1 || !piezas) return '';

  const enteras = Math.floor(piezas / porCharola);
  const sueltas = Math.round(piezas - enteras * porCharola);

  // el residuo se deja en piezas: redondear a charola completa cambiaría el pedido
  return [
    ...(enteras ? [`${enteras} char`] : []),
    ...(sueltas ? [`${sueltas} pz`] : []),
  ].join(' + ');
}
