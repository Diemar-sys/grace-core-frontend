import Dexie, { type Table } from 'dexie';

// Producto del catálogo cacheado para POS offline. Campos extra del backend
// se toleran (index signature) — solo item_code/departamento se consultan.
export interface CatalogoItem {
  item_code: string;
  custom_departamento?: string;
  [k: string]: unknown;
}

export interface StockRow {
  item_code: string;
  qty: number;
}

// Venta encolada. Lleva su propio uuid (idempotencia server-side) + el payload
// de la venta (campos extra tolerados). estado gobierna el drain.
export interface OutboxVenta {
  uuid: string;
  estado: 'pendiente' | 'error';
  created_at?: string;
  error?: string;
  [k: string]: unknown;
}

// Borrador del conteo físico: un renglón por almacén y día. Contar 244
// productos es una jornada con interrupciones, no un formulario de un jalón;
// sin esto, cerrar el modal tira todo lo capturado.
export interface ConteoBorrador {
  key: string;                          // `${fecha}|${warehouse}`
  warehouse: string;
  valores: Record<string, string>;      // item_code -> lo tecleado (en presentación)
  actualizado: string;
}

// Borrador genérico de un formulario largo (envío, compra, venta B2B). Un
// renglón por formulario: `datos` es el estado serializado tal cual lo dejó
// quien capturaba. A diferencia de `conteo`, aquí no hay clave por día — un
// envío a medias se retoma el mismo rato, no mañana.
export interface BorradorForm {
  key: string;                          // id del formulario, ej. 'envio-sucursal'
  datos: unknown;
  actualizado: string;
}

class GraceDB extends Dexie {
  catalogo!: Table<CatalogoItem, string>;
  stock!: Table<StockRow, string>;
  outbox!: Table<OutboxVenta, string>;
  conteo!: Table<ConteoBorrador, string>;
  borradores!: Table<BorradorForm, string>;

  constructor() {
    super('grace_pos');
    this.version(1).stores({
      catalogo: 'item_code, custom_departamento',
      stock: 'item_code',
      outbox: 'uuid, estado',
    });
    this.version(2).stores({
      conteo: 'key',
    });
    this.version(3).stores({
      borradores: 'key',
    });
  }
}

export const db = new GraceDB();
