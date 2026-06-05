import Dexie from 'dexie';
export const db = new Dexie('grace_pos');

db.version(1).stores({
    catalogo: 'item_code, custom_departamento',
    stock: 'item_code',
    outbox: 'uuid, estado',
});