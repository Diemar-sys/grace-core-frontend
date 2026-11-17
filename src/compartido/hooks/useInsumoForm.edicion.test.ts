// 🔴 Editar un item no puede borrarle nada. Cada campo que el PUT de
// `inventory.updateItem` manda tiene que volver con el valor que el item traía.
// El 21-sep el costo del pan se perdía en CADA edición: `formularioDeEdicion` no
// copiaba `custom_costo_estimado`, el campo arrancaba vacío y el PUT lo mandaba
// en null. Este test mira el viaje completo item → formulario → PUT, así que
// también caza al próximo campo que alguien agregue al PUT y olvide cargar.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formularioDeEdicion } from './useInsumoForm';
import { inventory } from '../services/frappeInventory';

const PAN = {
  item_code: '10237', item_name: 'CUERNITO', item_group: 'GALLETAS', stock_uom: 'Pza',
  custom_código_interno: '10237', custom_departamento: 'PAN DULCE',
  custom_tipo_item: 'PRODUCTO TERMINADO', custom_impuesto: 'ieps8',
  custom_presentación: null, custom_cantidad_por_presentación: null,
  custom_precio_de_compra: null, custom_precio_por_kg: null,
  custom_precio_final: 2.78, custom_precio_de_venta: 3, custom_precio_de_venta_pueblos: 2.5,
  custom_precio_de_venta_camioneta: 2.8, custom_costo_estimado: 1.05,
  custom_porcentaje_de_ganancia: 185.7, custom_ganancia: 1.95,
  custom_vendible_b2b: 0, disabled: 0, description: 'galleta',
};

const INSUMO = {
  ...PAN, item_code: 'MP_HARINA', item_name: 'HARINA', custom_tipo_item: 'MATERIA PRIMA',
  stock_uom: 'Kg', custom_presentación: 'BULTO', custom_cantidad_por_presentación: 44,
  custom_precio_de_compra: 520, custom_precio_por_kg: 11.82, custom_precio_final: 11.82,
  custom_impuesto: 'tasa0', custom_costo_estimado: null, custom_vendible_b2b: 1,
};

async function putDeEditar(item: Record<string, unknown>) {
  const fetch = vi.spyOn(inventory as any, '_fetch').mockResolvedValue({ data: {} });
  await inventory.updateItem(String(item.item_code), formularioDeEdicion(item));
  return JSON.parse((fetch.mock.calls[0][1] as { body: string }).body);
}

// Vacío, null, 0 y false son el mismo «nada» para Frappe; true viaja como 1.
const normal = (v: unknown) => (v === '' || v == null || v === false || v === 0 ? null : v === true ? 1 : v);

describe('editar un item no le borra nada', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([['pan', PAN], ['insumo', INSUMO]])('%s: todo campo del PUT vuelve igual', async (_n, item) => {
    const payload = await putDeEditar(item);
    for (const [campo, valor] of Object.entries(payload)) {
      if (!(campo in item)) continue;                 // taxes, is_stock_item: derivados
      expect(normal(valor), campo).toEqual(normal((item as any)[campo]));
    }
  });

  it('🔴 el costo del pan sobrevive a la edición', async () => {
    const payload = await putDeEditar(PAN);
    expect(payload.custom_costo_estimado).toBe(1.05);
  });
});
