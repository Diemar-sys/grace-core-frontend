// src/hooks/useAvisoSinGuardar.ts
// 26-oct: lo tecleado en la Hoja vive en la tablet (IndexedDB) y NO llega al sistema hasta
// «Guardar». Los churros de P.REAL del 22-oct: el chico juraba que los puso, en el servidor
// nunca existieron (21 guardados sin ellos y un cobro). Con algo sin guardar, salir pregunta.
//   - cerrar / recargar / escribir otra URL: `beforeunload` (el navegador pone su texto).
//   - menú de arriba y «Salir»: `confirm`. BrowserRouter no tiene `useBlocker`, así que el clic
//     se corta en `document` (captura) antes de que React Router navegue.
// ponytail: cerrar la pestaña desde el selector de pestañas del celular no avisa (el navegador
// no lo permite); el borrador sigue en la tablet y el selector de destino dice «sin guardar».
import { useEffect } from 'react';
import type { BorradorHoja } from '../utils/hojaDia';

export const MENSAJE_SIN_GUARDAR =
  'Tienes cambios SIN GUARDAR en la Hoja del día. Si sales así, NO llegan al sistema.\n\n¿Salir de todos modos?';

// Lo mismo que marca «· sin guardar» en el selector de destino, para la fecha que se ve.
export const haySinGuardar = (borrador: BorradorHoja, fecha: string): boolean =>
  Object.keys(borrador[fecha] ?? {}).length > 0;

// Lo que saca de la pantalla: un link o algo marcado con `data-sale` (el botón «Salir»).
const SALE = 'a[href], [data-sale]';

export default function useAvisoSinGuardar(sinGuardar: boolean) {
  useEffect(() => {
    if (!sinGuardar) return;
    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome viejo de las tablets lo exige además del preventDefault
    };
    const alClic = (e: MouseEvent) => {
      const destino = (e.target as Element | null)?.closest?.(SALE);
      if (!destino || (destino as HTMLAnchorElement).target === '_blank') return;
      if (window.confirm(MENSAJE_SIN_GUARDAR)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('beforeunload', alCerrar);
    document.addEventListener('click', alClic, true);
    return () => {
      window.removeEventListener('beforeunload', alCerrar);
      document.removeEventListener('click', alClic, true);
    };
  }, [sinGuardar]);
}
