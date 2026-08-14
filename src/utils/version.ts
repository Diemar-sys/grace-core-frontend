/**
 * Detección de versión nueva desplegada.
 *
 * El problema: alguien deja el sistema abierto, se deploya, y sigue trabajando
 * con el bundle viejo sin enterarse. Los cambios "no le aparecen" y parece que
 * el deploy no sirvió.
 *
 * No hace falta inventar un número de versión: Vite ya le pone un hash de
 * contenido al bundle (`index-B1GM4OP4.js`) y ese hash ES la versión — cambia si
 * y solo si el código cambió. Basta comparar el que tiene cargado la pestaña
 * contra el que anuncia el `index.html` de prod.
 *
 * Funciona porque el `index.html` se sirve con `Cache-Control: no-cache`, así que
 * pedirlo de nuevo trae el de verdad y no una copia del navegador. Si algún día
 * se pierde esa cabecera, esto deja de avisar (y el deploy vuelve a salir
 * invisible, que es el mismo bug de siempre).
 */

/** El hash vive en el nombre del archivo que genera Vite. */
const RE_BUNDLE = /\/?(?:static\/)?(index-[A-Za-z0-9_-]+\.js)/;

/** Nombre del bundle que anuncia un HTML. `null` si no se puede leer. */
export function bundleDeHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const m = RE_BUNDLE.exec(html);
  return m ? m[1] : null;
}

/**
 * Nombre del bundle que esta pestaña tiene cargado, leído de sus propios
 * `<script>`. En desarrollo no hay bundle con hash (Vite sirve `/src/main.jsx`)
 * y devuelve `null`: sin versión conocida no hay nada que comparar.
 */
export function bundleCargado(doc: Document): string | null {
  const scripts = Array.from(doc.querySelectorAll('script[src]'));
  for (const s of scripts) {
    const encontrado = bundleDeHtml((s as HTMLScriptElement).getAttribute('src'));
    if (encontrado) return encontrado;
  }
  return null;
}

/**
 * ¿Lo de prod es distinto a lo cargado?
 *
 * Si cualquiera de los dos no se pudo determinar responde `false`. Es a
 * propósito: ante la duda no se molesta al usuario. Un banner que no aparece
 * cuando debía es un deploy que alguien nota tarde; uno que aparece de más, en
 * cada pestaña y sin razón, es el que la gente aprende a ignorar.
 */
export function hayVersionNueva(cargado: string | null, enServidor: string | null): boolean {
  if (!cargado || !enServidor) return false;
  return cargado !== enServidor;
}
