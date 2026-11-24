// Reportes → Sucursales → P.REAL (24-nov, la tabla del jefe): lo que Luis teclea (tarjeta, banco, depósito,
// nómina, seguro, otro) antes de guardarlo. PURO.
// `previsualizar` = ESPEJO de `hoja_calculo.cuenta_preal` para ver las diferencias mientras se teclea (como
// `entregaPueblo.ts`). 🔴 Es cortesía: lo que queda es lo que calcula el servidor al guardar. Los dos se
// prueban con los mismos días reales (16 y 19-nov): si uno cambia sin el otro, truena.

/** «2026-11-19|nomina» → lo tecleado */
export type Escritas = Record<string, string>;
export type CapturaPuertaReal = { fecha: string } & Record<string, string | number | null>;

const SEP = '|';
export const claveCaptura = (fecha: string, campo: string) => `${fecha}${SEP}${campo}`;

/** Vacío = null (el servidor lo deja en 0); número ≥ 0 con a lo más 2 decimales; lo demás es inválido. */
export function leerMonto(texto: string): number | null | undefined {
  const t = texto.trim().replace(/,/g, '');
  if (t === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : undefined;
}

/** Lo tecleado agrupado por día, solo lo que cambió contra lo guardado. O(n) con un Map. */
export function capturasPorGuardar(escritas: Escritas, guardado: (fecha: string, campo: string) => number) {
  const porFecha = new Map<string, CapturaPuertaReal>();
  const invalidas = new Set<string>();
  for (const [clave, texto] of Object.entries(escritas)) {
    const [fecha, campo] = clave.split(SEP);
    const monto = leerMonto(texto);
    if (monto === undefined) { invalidas.add(clave); continue; }
    if ((monto ?? 0) === guardado(fecha, campo)) continue;
    const dia = porFecha.get(fecha) ?? { fecha };
    dia[campo] = monto;
    porFecha.set(fecha, dia);
  }
  return { capturas: [...porFecha.values()], invalidas };
}

export const CAMPOS_MANO = ['s_tarjeta', 'banco', 'c_tarjeta', 'deposito', 'nomina', 'seguro', 'otro'] as const;
type Fila = { fecha: string; nota: string } & Record<string, number | string | undefined | null>;

const cent = (n: unknown) => Math.round(Number(n ?? 0) * 100);

/** Un día con lo tecleado encima (lo inválido no cuenta: se queda lo guardado). Centavos enteros. */
export function cuentaDia(fila: Fila, escritas: Escritas): Record<string, number> {
  const c: Record<string, number> = {};
  for (const k of CAMPOS_MANO) {
    const texto = escritas[claveCaptura(fila.fecha, k)];
    const tecleado = texto === undefined ? undefined : leerMonto(texto);
    c[k] = tecleado === undefined ? cent(fila[k]) : cent(tecleado);
  }
  const monto = cent(fila.monto), descuento = cent(fila.descuento), abarrote = cent(fila.abarrote);
  const diferencia = monto - descuento;
  const difEfectivo = diferencia - c.c_tarjeta;
  const difDeposito = difEfectivo - c.deposito;
  const final = difDeposito + c.nomina + c.seguro + abarrote + c.otro;
  const r = { monto, descuento, diferencia, ...c, tarjeta_banco: c.s_tarjeta - c.banco, dif_efectivo: difEfectivo,
    dif_deposito: difDeposito, deuda_mas: Math.max(difDeposito, 0), deuda_menos: Math.max(-difDeposito, 0), abarrote,
    final, final_mas: Math.max(final, 0), final_menos: Math.min(final, 0) };
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v / 100]));
}

/** Los días y el TOTAL con lo tecleado encima. Sin nada tecleado regresa lo del servidor tal cual. O(días). */
export function previsualizar<T extends Fila>(dias: T[], total: Record<string, number>, escritas: Escritas) {
  if (!Object.keys(escritas).length) return { dias, total };
  const nuevos = dias.map((d) => ({ ...d, ...cuentaDia(d, escritas) }));
  const suma: Record<string, number> = {};
  for (const d of nuevos) for (const k of Object.keys(total)) suma[k] = (suma[k] ?? 0) + cent(d[k]);
  return { dias: nuevos, total: Object.fromEntries(Object.entries(suma).map(([k, v]) => [k, v / 100])) };
}
