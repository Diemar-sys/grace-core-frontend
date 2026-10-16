// src/services/frappeCliente.ts
// «Mi cuenta» del cliente (16-oct): lo suyo, solo de lectura. El servidor saca el
// cliente de la SESIÓN; aquí no viaja ningún cliente ni almacén.
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
export interface RenglonPedido { item_code: string; producto: string; piezas: number; enviado: number; precio: number }

class FrappeClienteService extends FrappeBase {
  async miCuenta(desde: string, hasta: string): Promise<MiCuenta> {
    const r = await this._fetch(`${RUTA}.mi_cuenta`, { method: 'POST', body: JSON.stringify({ desde, hasta }) });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return { cliente: '', desde, hasta, saldo: 0, antiguedad: [], pedidos: [], facturas: [], envios: [], envios_truncados: false, ...(r.message ?? {}) };
  }

  async miPedido(fecha: string): Promise<RenglonPedido[]> {
    const r = await this._fetch(`${RUTA}.mi_pedido`, { method: 'POST', body: JSON.stringify({ fecha }) });
    if (!r) throw new Error('Sin conexión con el servidor.');
    return r.message ?? [];
  }
}

export const clienteService = new FrappeClienteService();
