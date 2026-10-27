// src/services/frappeCliente.ts
// «Mi cuenta» del cliente (16-oct): lo suyo, solo de lectura. El servidor saca el
// cliente de la SESIÓN; aquí no viaja ningún cliente ni almacén.
// 20-oct: lo único que escribe es cuánto le LLEGÓ de cada pan (confirmarLlegada).
import FrappeBase from './FrappeBase';

const RUTA = '/api/method/gestion_panaderia.api.cliente_api';

export interface DiaPedido { fecha: string; piezas: number; enviado: number }
export interface FacturaCliente {
  factura: string; fecha: string; tipo: 'pan' | 'abarrote'; total: number; pagado: number; debe: number;
}
export interface EnvioCliente {
  envio: string; fecha: string; item_code: string; producto: string; cantidad: number; unidad: string; almacen: string;
}
export interface TramoSaldo { tramo: string; monto: number }
export interface MiCuenta {
  cliente: string; desde: string; hasta: string; saldo: number; antiguedad: TramoSaldo[];
  pedidos: DiaPedido[]; facturas: FacturaCliente[]; envios: EnvioCliente[]; envios_truncados: boolean;
}
export interface RenglonPedido {
  item_code: string; producto: string; piezas: number; enviado: number; precio: number;
  /** Lo que anotó que le llegó (acumulado del día). null = todavía no dice. 20-oct */
  llego: number | null;
  /** Pasó el cierre sin que lo anotara: se tomó lo que se mandó */
  llego_supuesto: boolean;
}
/** `abierta`: hoy y antes de `cierre` (hora de la torre) todavía puede anotar lo que llegó */
export interface DetallePedido { renglones: RenglonPedido[]; abierta: boolean; cierre: number }

class FrappeClienteService extends FrappeBase {
  async miCuenta(desde: string, hasta: string): Promise<MiCuenta> {
    const r = await this._fetch(`${RUTA}.mi_cuenta`, { method: 'POST', body: JSON.stringify({ desde, hasta }) });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return { cliente: '', desde, hasta, saldo: 0, antiguedad: [], pedidos: [], facturas: [], envios: [], envios_truncados: false, ...(r.message ?? {}) };
  }

  async miPedido(fecha: string): Promise<DetallePedido> {
    const r = await this._fetch(`${RUTA}.mi_pedido`, { method: 'POST', body: JSON.stringify({ fecha }) });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return { renglones: [], abierta: false, cierre: 19, ...(r.message ?? {}) };
  }

  /** Manda el TOTAL que llegó de cada pan (no lo de esta entrega): un reintento escribe lo mismo. */
  async confirmarLlegada(fecha: string, renglones: { item_code: string; llego: number }[]): Promise<DetallePedido> {
    const r = await this._fetch(`${RUTA}.confirmar_llegada`, { method: 'POST', body: JSON.stringify({ fecha, renglones }) });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return { renglones: [], abierta: false, cierre: 19, ...(r.message ?? {}) };
  }
}

export const clienteService = new FrappeClienteService();
