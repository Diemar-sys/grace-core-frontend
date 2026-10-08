// src/utils/reloj.ts
// Texto del reloj de la barra de arriba, en hora LOCAL (la de la panadería).
// ponytail: listas fijas en vez de Intl — Intl cambia puntos y espacios entre navegadores
// («a. m.» vs «a.m.») y el reloj se vería distinto en la tablet y en la PC.

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface TextoReloj { fecha: string; hora: string }

/** `jue 08 oct` · `6:05 p.m.` (12 horas, como se dice en la panadería). */
export function textoReloj(d: Date = new Date()): TextoReloj {
  const h = d.getHours();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return {
    fecha: `${DIAS[d.getDay()]} ${dd} ${MESES[d.getMonth()]}`,
    hora: `${h % 12 || 12}:${mm} ${h < 12 ? 'a.m.' : 'p.m.'}`,
  };
}
