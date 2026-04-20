/**
 * Abre una ventana emergente, inyecta HTML y dispara la impresión.
 * La responsabilidad de imprimir vive aquí: el HTML del template
 * NO necesita incluir su propio <script>window.print()</script>.
 *
 * @param {string} html   - Documento HTML completo
 * @param {number} w      - Ancho de la ventana (px)
 * @param {number} h      - Alto de la ventana (px)
 */
export function imprimirHTML(html, w = 500, h = 700) {
  const win = window.open('', '_blank', `width=${w},height=${h}`);
  if (!win) {
    console.warn('[imprimirHTML] El popup fue bloqueado por el navegador.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
