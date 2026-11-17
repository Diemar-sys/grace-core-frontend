// Comparaciones de precio del alta de pan (salen de components/NuevoPan.jsx el 07-oct, sin cambios de lógica).
type Num = number | string | null | undefined;

/** Margen contra el costo estimado. Sin costo no hay nada que comparar. */
export function margen(precio: Num, costo: Num): { ganancia: number; porcentaje: number } | null {
  const p = parseFloat(String(precio)) || 0;
  const c = parseFloat(String(costo)) || 0;
  if (!(p > 0) || !(c > 0)) return null;
  return { ganancia: p - c, porcentaje: ((p - c) / c) * 100 };
}

/**
 * Compara un canal contra el precio de Sucursal, que es la base.
 *
 * Existe para que capturar un precio SIEMPRE responda algo, aunque no haya
 * costo estimado: sin esto el formulario se queda mudo justo cuando el usuario
 * acaba de teclear. Además delata el error silencioso — poner en Pueblos el
 * mismo precio que en Sucursal deja el canal sin efecto.
 */
export function comparaConSucursal(precioCanal: Num, precioSucursal: Num): { dif: number; igual: boolean } | null {
  const p = parseFloat(String(precioCanal)) || 0;
  const s = parseFloat(String(precioSucursal)) || 0;
  if (!(p > 0) || !(s > 0)) return null;
  const dif = p - s;
  // Medio centavo: por debajo de eso son el mismo precio en la caja.
  return { dif, igual: Math.abs(dif) < 0.005 };
}
