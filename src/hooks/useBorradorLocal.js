import { useEffect, useMemo, useRef, useState } from 'react';
import { guardarBorradorForm, cargarBorradorForm, borrarBorradorForm } from '../db/borradorLocal';
import { auth } from '../services/frappeAuth';

/**
 * IndexedDB es del navegador, no del usuario: en una PC compartida el borrador
 * de quien capturó antes le aparecería al siguiente. La clave lleva el correo
 * para que cada quien vea el suyo.
 *
 * ponytail: NO separa dos pestañas del MISMO usuario — ahí gana la última que
 * teclea y la otra se pierde. Es el techo conocido de un borrador local; quien
 * capture dos compras a la vez tiene que usar "Guardar borrador" (servidor),
 * que sí crea dos documentos. Separar por pestaña exige elegir cuál restaurar,
 * y eso ya es una lista de borradores, no un respaldo.
 */
const claveUsuario = (key) => {
  if (!key) return null;
  const email = auth.getUser()?.email;
  return email ? `${key}|${email}` : key;
};

/**
 * Autosave local de un formulario largo.
 *
 * Uso:
 *   const { restaurado, descartar } = useBorradorLocal('envio-sucursal', datos, restaurar);
 *
 * - `datos`: el estado serializable del formulario, o `null` cuando no hay nada
 *   capturado (entonces el borrador se borra en vez de guardarse vacío).
 * - `restaurar(datos)`: se llama UNA vez al montar, si había borrador.
 * - `restaurado`: fecha ISO del guardado recuperado, o null. Sirve para avisar
 *   en pantalla — restaurar en silencio asusta más que perder la captura.
 * - `descartar()`: borra el borrador. Llamarlo al confirmar el documento.
 *
 * `key = null` apaga el hook. Sirve para los formularios que ya editan un
 * documento existente del servidor: ahí la verdad es el doc, no un respaldo
 * local que lo pisaría al montar.
 *
 * Nada de esto bloquea al usuario: si IndexedDB falla (modo privado, cuota),
 * se loguea y el formulario sigue vivo.
 */
export default function useBorradorLocal(keyBase, datos, restaurar, { delay = 600 } = {}) {
  const key = useMemo(() => claveUsuario(keyBase), [keyBase]);

  // Hasta que termine de cargarse el borrador NO se guarda: si no, el estado
  // inicial vacío del primer render pisa lo que se iba a restaurar. El autosave
  // se comería su propio respaldo.
  const hidratado = useRef(false);
  const restaurarRef = useRef(restaurar);
  restaurarRef.current = restaurar;
  const [restaurado, setRestaurado] = useState(null);

  useEffect(() => {
    if (!key) return;
    let vivo = true;
    cargarBorradorForm(key)
      .then(prev => {
        if (!vivo || !prev) return;
        restaurarRef.current?.(prev.datos);
        setRestaurado(prev.actualizado);
      })
      .catch(e => console.error('borrador form:', e))
      .finally(() => { if (vivo) hidratado.current = true; });
    return () => { vivo = false; };
  }, [key]);

  // Serializar aquí sirve doble: es lo que se va a guardar, y es una dependencia
  // estable (el objeto `datos` se reconstruye en cada render, la cadena no).
  const serial = JSON.stringify(datos ?? null);

  useEffect(() => {
    if (!key || !hidratado.current) return;
    const t = setTimeout(() => {
      guardarBorradorForm(key, JSON.parse(serial)).catch(e => console.error('borrador form:', e));
    }, delay);
    return () => clearTimeout(t);
  }, [key, serial, delay]);

  const descartar = () => {
    if (!key) return Promise.resolve();
    setRestaurado(null);
    return borrarBorradorForm(key).catch(e => console.error('borrador form:', e));
  };

  return { restaurado, descartar };
}
