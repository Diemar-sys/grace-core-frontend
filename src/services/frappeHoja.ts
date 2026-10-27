// Hoja del día: captura y cobro por destino (backend `hoja_api.py`).
// El navegador manda SOLO cantidades: el precio lo pone el servidor.
// Camioneta en tres pasos (23-sep): confirmarEnvio (Héctor) → guardarRegreso
// (repartidor) → guardarMerma + confirmar (Héctor). `etapa` dice en cuál va.
import FrappeBase from './FrappeBase';

const API = '/api/method/gestion_panaderia.api.hoja_api.';

export interface RenglonHoja {
  item_code: string; producto: string; departamento: string; categoria: string; impuesto: string;
  pedido: number; enviado: number; merma: number; precio: number; importe: number;
  /** Piezas por charola del catálogo (bolillo 16, telera 12); 0 = va por pieza. 06-oct */
  por_charola?: number;
  /** 08-oct: su ENVIADO sale de las tandas de «Bolillo»; en la Captura se ve, no se teclea */
  de_bolillo?: boolean;
  /** 20-oct: lo que el destino anotó que le LLEGÓ (Mi cuenta). null = todavía no dice. Solo lectura aquí */
  llego?: number | null;
  /** Pasó el cierre sin que lo anotara: es lo enviado, no una confirmación */
  llego_supuesto?: boolean;
}
export interface Factura { name: string; grand_total: number; outstanding_amount: number }
/** '' = capturando lo enviado · 'enviado' = en ruta · 'liquidado' = ya entregó su regreso */
export type EtapaCamioneta = '' | 'enviado' | 'liquidado';
export interface Hoja {
  destino: string; camioneta: boolean; renglones: RenglonHoja[]; etapa: EtapaCamioneta;
  total: number; comision: number; se_debe: number; factura: Factura | null;
  /** Vendió menos que su sueldo (10% + $200): la comisión se topó a lo vendido y esto
   *  es lo que la panadería le debe al repartidor (excepción 23-sep). */
  a_favor: number;
  /** Cobrada, dentro de la ventana y sin abono: «Corregir» cancela la factura (06-oct).
   *  La regla vive en el servidor; aquí solo se lee. */
  corregible?: boolean;
  /** 15-oct: descuento a cliente (DELI 40%, ZAKIA 20%) sobre el total ya con impuesto, del
   *  servidor. 0 para quien no lleva o para pedidos antes del 12-oct. */
  descuento?: number; descuento_pct?: number;
  /** 20-oct: el destino anota lo que le llegó (hoy: cuenta de cliente, Puerta Real) → columna LLEGÓ */
  con_llegada?: boolean;
}
export interface DestinoDia {
  destino: string; grupo: string; camioneta: boolean; total: number; comision: number; se_debe: number;
  descuento?: number;
  estado: 'sin_capturar' | 'sin_confirmar' | 'en_ruta' | 'regreso' | 'confirmado'; factura: Factura | null;
}

/** Bolillo por tandas (08-oct). Spec: gestion_panaderia/docs/superpowers/specs/2026-10-08-bolillo-tandas-design.md */
export interface CeldaTanda { pedido: number; salio: number }
export interface Tanda { tanda: number; tipo: string; segundo: string; horario: string; celdas: Record<string, CeldaTanda> }
export interface ItemBolillo { item_code: string; unidad: 'charolas' | 'piezas'; por_charola: number }
/** 17-oct: `cerrado` = camioneta con su bloque propio y el envío ya confirmado (tandas fijas). */
export interface DestinoBolillo { destino: string; cobrado: boolean; cerrado?: boolean; tandas: Tanda[] }
export interface CamionetaBolillo { destino: string; cerrada: boolean; cobrada: boolean; cantidades: Record<string, number> }
export interface BolilloDia {
  items: ItemBolillo[];
  destinos: DestinoBolillo[];
  /** La bolsa común (bloque CAMIONETA del Excel) y las camionetas que salen; null si no hay */
  camionetas: { tandas: Tanda[]; salen: CamionetaBolillo[] } | null;
}
export interface CeldaPorGuardar { destino: string; tanda: number; item_code: string; salio: number }
export interface CamionetaPorGuardar { destino: string; item_code: string; cantidad: number }

export interface DeudorHoja { destino: string; grupo: string; cliente: string; camioneta: boolean }
export interface DiaCuenta {
  fecha: string; factura: string; estado: 'liquidado' | 'abono' | 'pendiente';
  venta: number; comision: number; ayudante: number; sueldo: number; recibir: number; pagado: number; debe: number;
  a_favor: number;
  /** 15-oct: descuento a cliente (renglón de la factura). La venta lo incluye; recibir no. */
  descuento?: number;
  /** 09-oct: lo que Eva le entregó a Luis (null = sin liquidar) y pagado − liquidado (null igual). */
  liquidado: number | null; eva_debe: number | null;
  /** 27-oct: lo que Eva pagó de egresos con lo cobrado, acomodado a este día (eva_debe ya lo resta). */
  egreso?: number; egresos?: EgresoDeCobro[];
  /** 27-oct: sin liquidar, lo que Luis debe esperar (cobrado − egresos del día); null si ya liquidó o sin cobro. */
  por_entregar?: number | null;
}
export interface EgresoDeCobro {
  egreso: string; cobro: string; subcategoria: string | null; concepto: string | null;
  monto: number; capturo: string; cuando: string;
}
export interface EstadoCuenta {
  destino: string; cliente: string; camioneta: boolean; desde: string; hasta: string; dias: DiaCuenta[];
  /** solo Administrator y luis.th: lo decide el servidor */
  puede_liquidar: boolean;
  total: Omit<DiaCuenta, 'fecha' | 'factura' | 'estado' | 'liquidado' | 'eva_debe'> & { liquidado: number; eva_debe: number; egreso?: number; por_entregar?: number };
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
  deudores() { return this._get<DeudorHoja[]>('deudores', {}); }
  estadoCuenta(destino: string, desde: string, hasta: string) {
    return this._get<EstadoCuenta>('estado_cuenta', { destino, desde, hasta });
  }
  hoja(fecha: string, destino: string) { return this._get<Hoja>('hoja', { fecha, destino }); }
  miHoja(fecha: string) { return this._get<Hoja>('mi_hoja', { fecha }); }
  guardar(fecha: string, destino: string, renglones: { item_code: string; enviado: number }[]) {
    return this._post<Hoja>('guardar', { fecha, destino, renglones });
  }
  /** «Guardar todo» (25-sep): la ronda completa en un solo save, todo o nada. Devuelve los destinos guardados. */
  guardarTodo(fecha: string, capturas: Record<string, { item_code: string; enviado: number }[]>) {
    return this._post<string[]>('guardar_todo', { fecha, capturas });
  }
  /** Solo REGRESO: la merma ya no es del repartidor (la pone Héctor). */
  /** 30-sep: el repartidor manda la MERMA (lo que regresa); ya no hay «regreso» aparte. */
  guardarRegreso(fecha: string, renglones: { item_code: string; merma: number }[], destino?: string) {
    return this._post<Hoja>('guardar_regreso', { fecha, renglones, destino });
  }
  confirmarEnvio(fecha: string, destino: string) { return this._post<Hoja>('confirmar_envio', { fecha, destino }); }
  reabrirEnvio(fecha: string, destino: string) { return this._post<Hoja>('reabrir_envio', { fecha, destino }); }
  corregir(fecha: string, destino: string) { return this._post<Hoja>('corregir', { fecha, destino }); }
  /** 09-oct: lo que Eva le entregó a Luis de esa factura (solo Administrator y luis.th). */
  liquidar(factura: string, monto: number) {
    return this._post<{ factura: string; liquidado: number; eva_debe: number }>('liquidar', { factura, monto });
  }
  vistaBolillo(fecha: string) { return this._get<BolilloDia>('vista_bolillo', { fecha }); }
  guardarBolillo(fecha: string, tandas: CeldaPorGuardar[], camionetas: CamionetaPorGuardar[]) {
    return this._post<BolilloDia>('guardar_bolillo', { fecha, tandas, camionetas });
  }
  guardarMerma(fecha: string, destino: string, renglones: { item_code: string; enviado?: number; merma?: number }[]) {
    return this._post<Hoja>('guardar_merma', { fecha, destino, renglones });
  }
  confirmar(fecha: string, destino: string) {
    return this._post<{ factura: string; total: number; comision: number; se_debe: number }>('confirmar', { fecha, destino });
  }
}

export const hojaService = new HojaService();
