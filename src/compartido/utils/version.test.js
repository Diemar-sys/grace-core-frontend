import { describe, it, expect } from 'vitest';
import { bundleDeHtml, bundleCargado, hayVersionNueva } from './version';

// HTML como el que sirve Caddy en prod (verificado el 14-ago).
const HTML_PROD = `<!doctype html><html><head>
  <link rel="stylesheet" href="/static/index-BxixKVU6.css">
  <script type="module" crossorigin src="/static/index-B1GM4OP4.js"></script>
</head><body><div id="root"></div></body></html>`;

describe('bundleDeHtml', () => {
  it('saca el bundle del html de prod', () => {
    expect(bundleDeHtml(HTML_PROD)).toBe('index-B1GM4OP4.js');
  });

  it('no confunde el css con el js', () => {
    // El css va primero en el html y tiene la misma forma de nombre.
    expect(bundleDeHtml(HTML_PROD)).not.toContain('.css');
  });

  it('aguanta rutas con o sin /static', () => {
    expect(bundleDeHtml('<script src="/index-ABC123.js">')).toBe('index-ABC123.js');
    expect(bundleDeHtml('<script src="static/index-ABC123.js">')).toBe('index-ABC123.js');
  });

  it('sin bundle con hash devuelve null, no revienta', () => {
    expect(bundleDeHtml('<script src="/src/main.jsx"></script>')).toBeNull();
    expect(bundleDeHtml('')).toBeNull();
    expect(bundleDeHtml(null)).toBeNull();
    expect(bundleDeHtml(undefined)).toBeNull();
  });
});

describe('bundleCargado', () => {
  const docCon = (srcs) => ({
    querySelectorAll: () => srcs.map(src => ({ getAttribute: () => src })),
  });

  it('lee el bundle de los script de la propia página', () => {
    expect(bundleCargado(docCon(['/static/index-B1GM4OP4.js']))).toBe('index-B1GM4OP4.js');
  });

  it('se salta los scripts que no son el bundle', () => {
    expect(bundleCargado(docCon(['/otro.js', '/static/index-XYZ789.js'])))
      .toBe('index-XYZ789.js');
  });

  it('en desarrollo (sin hash) devuelve null', () => {
    expect(bundleCargado(docCon(['/src/main.jsx']))).toBeNull();
    expect(bundleCargado(docCon([]))).toBeNull();
  });
});

describe('hayVersionNueva', () => {
  it('avisa solo cuando el hash cambió', () => {
    expect(hayVersionNueva('index-AAA.js', 'index-BBB.js')).toBe(true);
    expect(hayVersionNueva('index-AAA.js', 'index-AAA.js')).toBe(false);
  });

  it('ante la duda NO molesta', () => {
    // Sin uno de los dos lados no se puede afirmar nada. Un banner que sale de
    // más en cada pestaña es el que la gente aprende a ignorar.
    expect(hayVersionNueva(null, 'index-BBB.js')).toBe(false);
    expect(hayVersionNueva('index-AAA.js', null)).toBe(false);
    expect(hayVersionNueva(null, null)).toBe(false);
  });
});
