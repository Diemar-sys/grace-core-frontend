/**
 * FrappeCamionetaService — cierre de ruta de las camionetas.
 *
 * Lee lo que salió hoy hacia la camioneta y registra lo que regresó y lo que se
 * tiró. La venta NO se captura: sale por diferencia, y la aritmética vive en
 * `src/utils/liquidacion.ts` — aquí no se calcula nada de dinero.
 *
 * 🔴 El almacén NO se manda desde aquí en el cierre. El backend lo saca de la
 * sesión: si viajara en la petición, cerrar la ruta ajena sería cambiar una
 * cadena en el navegador.
 */

import FrappeBase from './FrappeBase';
import type { MovimientoItem } from '../utils/liquidacion';

const BASE = '/api/method/gestion_panaderia.api.camioneta_api';

export interface ResumenDia {
  camioneta: string;
  fecha: string;
  sucursal_regreso_sugerida: string | null;
  salidas: MovimientoItem[];
  regresos: MovimientoItem[];
  mermas: MovimientoItem[];
}

export interface RenglonCaptura {
  item_code: string;
  regresa: number;
  tiro: number;
}

class FrappeCamionetaService extends FrappeBase {
  /** Camioneta del usuario conectado. La pantalla no elige almacén. */
  async miRuta() {
    const res = await this._fetch(`${BASE}.mi_ruta`);
    return res?.message ?? res;
  }

  /**
   * Movimientos del día ya agrupados por producto (los agrupa el servidor).
   * `camioneta` solo lo obedece el backend si quien pregunta es de oficina.
   */
  async resumenDia(fecha?: string, camioneta?: string): Promise<ResumenDia> {
    const params = new URLSearchParams();
    if (fecha) params.set('fecha', fecha);
    if (camioneta) params.set('camioneta', camioneta);
    const q = params.toString();
    const res = await this._fetch(`${BASE}.resumen_dia${q ? `?${q}` : ''}`);
    return res?.message ?? res;
  }

  /**
   * Registra el cierre: un traspaso con lo que regresa y un Material Issue con
   * lo que se tiró. Los renglones en cero no se mandan — el backend los ignora,
   * pero mandarlos infla la petición sin decir nada.
   */
  async cerrarDia({ fecha, almacenRegreso, renglones, notas = '' }: {
    fecha?: string;
    almacenRegreso?: string;
    renglones: RenglonCaptura[];
    notas?: string;
  }) {
    const conCantidad = renglones.filter(r => r.regresa > 0 || r.tiro > 0);
    if (!conCantidad.length) throw new Error('No capturaste ninguna cantidad');

    const res = await this._fetch(`${BASE}.cerrar_dia`, {
      method: 'POST',
      body: JSON.stringify({
        fecha,
        almacen_regreso: almacenRegreso,
        renglones: conCantidad,
        notas,
      }),
    });
    return res?.message ?? res;
  }
}

export const camionetaService = new FrappeCamionetaService();
export default camionetaService;
