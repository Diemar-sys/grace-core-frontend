import { useState, useEffect } from 'react';

/**
 * Estado de la conexión, para avisar en pantalla.
 *
 * El problema real (19-ago): se cayó el WiFi mientras se daba de alta un
 * producto y la pantalla escupió «Cannot read properties of null». Nadie puede
 * traducir eso a «revisa el internet». El sistema tiene que decirlo él.
 *
 * `volvio` es un estado aparte y no vuelve a `ok` solo: cuando la red regresa,
 * la pestaña quedó con datos viejos y con lo que se intentó guardar en el
 * limbo, así que se ofrece recargar. Quien decide es el que está en la pantalla
 * — recargar por su cuenta se lleva el formulario a medio llenar.
 *
 * ponytail: `navigator.onLine` y sus eventos, sin sondeo propio. Techo conocido:
 * detecta que se cayó el WiFi, NO que la torre esté caída con el WiFi arriba
 * (ahí `onLine` sigue en true). Si eso llega a pasar seguido, la subida es un
 * ping a /api/method/ping cada X seg — no antes.
 */
export type EstadoConexion = 'ok' | 'sin-conexion' | 'volvio';

export function useConexion(): EstadoConexion {
  const [estado, setEstado] = useState<EstadoConexion>(
    navigator.onLine ? 'ok' : 'sin-conexion'
  );

  useEffect(() => {
    const cayo = () => setEstado('sin-conexion');
    // Solo avisa que volvió si se cayó antes: abrir el sistema con red buena
    // no es noticia.
    const volvio = () => setEstado((e) => (e === 'sin-conexion' ? 'volvio' : e));

    window.addEventListener('offline', cayo);
    window.addEventListener('online', volvio);
    return () => {
      window.removeEventListener('offline', cayo);
      window.removeEventListener('online', volvio);
    };
  }, []);

  return estado;
}
