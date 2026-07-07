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

class GraceDB extends Dexie {
  catalogo!: Table<CatalogoItem, string>;
  stock!: Table<StockRow, string>;
  outbox!: Table<OutboxVenta, string>;

  constructor() {
    super('grace_pos');
    this.version(1).stores({
      catalogo: 'item_code, custom_departamento',
      stock: 'item_code',
      outbox: 'uuid, estado',
    });
  }
}

export const db = new GraceDB();
