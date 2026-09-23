// Hoja del día: captura y cobro por destino (backend `hoja_api.py`).
// El navegador manda SOLO cantidades: el precio lo pone el servidor.
import FrappeBase from './FrappeBase';

const API = '/api/method/gestion_panaderia.api.hoja_api.';

export interface RenglonHoja {
  item_code: string; producto: string; departamento: string; categoria: string; impuesto: string;
  pedido: number; enviado: number; regreso: number; merma: number; precio: number; importe: number;
}
export interface Factura { name: string; grand_total: number; outstanding_amount: number }
export interface Hoja {
  destino: string; camioneta: boolean; renglones: RenglonHoja[];
  total: number; comision: number; se_debe: number; factura: Factura | null;
}
export interface DestinoDia {
  destino: string; grupo: string; camioneta: boolean; total: number; comision: number; se_debe: number;
  estado: 'sin_capturar' | 'sin_confirmar' | 'confirmado'; factura: Factura | null;
}

class HojaService extends FrappeBase {
  private async _get<T>(metodo: string, params: Record<string, string>): Promise<T> {
    const res = await this._fetch(API + metodo + '?' + new URLSearchParams(params));
    if (res === null) throw new Error('Sin conexión');
    return res.message;
  }
  private async _post<T>(metodo: string, body: object): Promise<T> {
    const res = await this._fetch(API + metodo, { method: 'POST', body: JSON.stringify(body) });
    if (res === null) throw new Error('Sin conexión');
    return res.message;
  }
  destinos(fecha: string) { return this._get<DestinoDia[]>('destinos', { fecha }); }
  hoja(fecha: string, destino: string) { return this._get<Hoja>('hoja', { fecha, destino }); }
  miHoja(fecha: string) { return this._get<Hoja>('mi_hoja', { fecha }); }
  guardar(fecha: string, destino: string, renglones: { item_code: string; enviado: number }[]) {
    return this._post<Hoja>('guardar', { fecha, destino, renglones });
  }
  guardarRegreso(fecha: string, renglones: { item_code: string; regreso: number; merma: number }[], destino?: string) {
    return this._post<Hoja>('guardar_regreso', { fecha, renglones, destino });
  }
  confirmar(fecha: string, destino: string) {
    return this._post<{ factura: string; total: number; comision: number; se_debe: number }>('confirmar', { fecha, destino });
  }
}

export const hojaService = new HojaService();
