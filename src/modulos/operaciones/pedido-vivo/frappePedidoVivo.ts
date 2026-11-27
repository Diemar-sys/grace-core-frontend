// Pedido en vivo (27-nov, adiós Drive): la rejilla del día y el guardado celda por celda.
// Quién edita qué columna lo decide el SERVIDOR por la sesión; aquí solo se pinta `editables`.
import FrappeBase from '../../../compartido/services/FrappeBase';

const RUTA = '/api/method/gestion_panaderia.api.pedido_vivo';

export interface PanPedido { item_code: string; producto: string; seccion: string | null; orden: number | null }
export interface Rejilla {
  fecha: string; pedido: string | null; cerrado: boolean; editables: string[];
  grupos: Record<string, string[]>; destinos: string[]; panes: PanPedido[];
  piezas: Record<string, Record<string, number>>;
  precios: Record<string, Record<string, number>>;
  totales: Record<string, number>;
}
export interface CeldaGuardada { destino: string; item_code: string; piezas: number; total: number; pedido: string }

class FrappePedidoVivoService extends FrappeBase {
  async abrir(fecha: string): Promise<Rejilla> {
    const r = await this._fetch(`${RUTA}.abrir`, { method: 'POST', body: JSON.stringify({ fecha }) });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return r.message;
  }

  async guardarCelda(fecha: string, destino: string, item_code: string, piezas: number): Promise<CeldaGuardada> {
    const r = await this._fetch(`${RUTA}.guardar_celda`, {
      method: 'POST', body: JSON.stringify({ fecha, destino, item_code, piezas }),
    });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return r.message;
  }
}

export const pedidoVivoService = new FrappePedidoVivoService();
